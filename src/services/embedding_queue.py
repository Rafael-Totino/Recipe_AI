from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, Dict, Optional

from starlette.concurrency import run_in_threadpool

from src.app.deps import get_supabase
from src.services.errors import RateLimitedError
from src.services.embedding import stringify_payload
from src.services.persist_supabase import (
    get_recipe_embedding_payload,
    update_recipe_embedding_status,
    save_embedding_payload,
    save_chunks,
)

log = logging.getLogger("embedding_queue")


STATUS_PENDING = "pending"
STATUS_PROCESSING = "processing"
STATUS_COMPLETED = "completed"
STATUS_FAILED = "failed"


@dataclass(slots=True)
class EmbeddingJob:
    recipe_id: str
    owner_id: str
    payload: str
    attempts: int = 0

    def next_attempt(self) -> "EmbeddingJob":
        return EmbeddingJob(
            recipe_id=self.recipe_id,
            owner_id=self.owner_id,
            payload=self.payload,
            attempts=self.attempts + 1,
        )


class EmbeddingQueue:
    def __init__(self) -> None:
        self._queue: "asyncio.Queue[Optional[EmbeddingJob]]" = asyncio.Queue()
        self._worker: Optional[asyncio.Task[None]] = None
        self._lock = asyncio.Lock()
        self._max_attempts = 5
        self._payload_cache: Dict[tuple[str, str], str] = {}

    async def start(self) -> None:
        async with self._lock:
            if self._worker and not self._worker.done():
                return
            self._worker = asyncio.create_task(self._run(), name="embedding-worker")

    async def stop(self) -> None:
        async with self._lock:
            if not self._worker:
                return
            await self._queue.put(None)
            try:
                await self._worker
            finally:
                self._worker = None

    async def enqueue(self, recipe_id: str, owner_id: str, payload: Dict[str, Any]) -> None:
        serialized = stringify_payload(payload)
        supa = get_supabase()
        await run_in_threadpool(save_embedding_payload, supa, recipe_id, owner_id, serialized)
        await run_in_threadpool(
            update_recipe_embedding_status,
            supa,
            recipe_id,
            owner_id,
            STATUS_PENDING,
            None,
        )
        job = EmbeddingJob(recipe_id=recipe_id, owner_id=owner_id, payload=serialized)
        self._payload_cache[(owner_id, recipe_id)] = serialized
        await self._queue.put(job)

    async def retry(self, recipe_id: str, owner_id: str) -> bool:
        supa = get_supabase()
        payload = await run_in_threadpool(
            get_recipe_embedding_payload,
            supa,
            recipe_id,
            owner_id,
        )
        if not payload:
            payload = self._payload_cache.get((owner_id, recipe_id))
            if not payload:
                return False
        self._payload_cache[(owner_id, recipe_id)] = payload
        job = EmbeddingJob(recipe_id=recipe_id, owner_id=owner_id, payload=payload)
        await run_in_threadpool(save_embedding_payload, supa, recipe_id, owner_id, payload)
        await run_in_threadpool(
            update_recipe_embedding_status,
            supa,
            recipe_id,
            owner_id,
            STATUS_PENDING,
            None,
        )
        await self._queue.put(job)
        return True

    async def _run(self) -> None:
        supa = get_supabase()
        while True:
            job = await self._queue.get()
            if job is None:
                self._queue.task_done()
                break
            try:
                await self._process_job(supa, job)
            except Exception:
                log.exception(
                    "embedding.worker_unexpected_error recipe=%s owner=%s", job.recipe_id, job.owner_id
                )
            finally:
                self._queue.task_done()

    async def _process_job(self, supa, job: EmbeddingJob) -> None:
        await run_in_threadpool(
            update_recipe_embedding_status,
            supa,
            job.recipe_id,
            job.owner_id,
            STATUS_PROCESSING,
            None,
        )
        try:
            await run_in_threadpool(save_chunks, supa, job.recipe_id, job.payload)
        except RateLimitedError as exc:
            await self._handle_rate_limit(supa, job, exc)
            return
        except Exception as exc:
            await run_in_threadpool(
                update_recipe_embedding_status,
                supa,
                job.recipe_id,
                job.owner_id,
                STATUS_FAILED,
                str(exc),
            )
            log.error(
                "embedding.worker_failed recipe=%s owner=%s error=%s",
                job.recipe_id,
                job.owner_id,
                exc,
            )
            return

        await run_in_threadpool(
            update_recipe_embedding_status,
            supa,
            job.recipe_id,
            job.owner_id,
            STATUS_COMPLETED,
            None,
        )
        self._payload_cache[(job.owner_id, job.recipe_id)] = job.payload
        log.info("embedding.worker_done recipe=%s owner=%s", job.recipe_id, job.owner_id)

    async def _handle_rate_limit(self, supa, job: EmbeddingJob, exc: RateLimitedError) -> None:
        log.warning(
            "embedding.worker_rate_limited recipe=%s owner=%s attempt=%s", job.recipe_id, job.owner_id, job.attempts
        )
        if job.attempts + 1 >= self._max_attempts:
            await run_in_threadpool(
                update_recipe_embedding_status,
                supa,
                job.recipe_id,
                job.owner_id,
                STATUS_FAILED,
                str(exc),
            )
            return

        delay = min(60 * (job.attempts + 1), 300)
        await run_in_threadpool(
            update_recipe_embedding_status,
            supa,
            job.recipe_id,
            job.owner_id,
            STATUS_PENDING,
            "Aguardando nova tentativa após limite da API",
        )
        asyncio.create_task(self._schedule_retry(job.next_attempt(), delay))

    async def _schedule_retry(self, job: EmbeddingJob, delay: int) -> None:
        await asyncio.sleep(delay)
        await self._queue.put(job)

def get_queue() -> EmbeddingQueue:
    global _EMBEDDING_QUEUE
    try:
        queue = _EMBEDDING_QUEUE
    except NameError:
        queue = _EMBEDDING_QUEUE = EmbeddingQueue()
    return queue


async def start_worker() -> None:
    await get_queue().start()


async def stop_worker() -> None:
    await get_queue().stop()


async def enqueue(recipe_id: str, owner_id: str, payload: Dict) -> None:
    await get_queue().enqueue(recipe_id, owner_id, payload)


async def retry(recipe_id: str, owner_id: str) -> bool:
    return await get_queue().retry(recipe_id, owner_id)
