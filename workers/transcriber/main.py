# workers/transcriber/main.py
"""
Transcription worker main entry point.

This worker:
1. Polls Supabase for queued transcription jobs
2. Locks a job using FOR UPDATE SKIP LOCKED
3. Downloads media from R2
4. Runs faster-whisper transcription
5. Saves results back to Supabase
6. Handles retries with exponential backoff
7. Releases stale locks from crashed workers
"""
from __future__ import annotations

import asyncio
import logging
import os
import signal
import sys
import tempfile
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional
from uuid import UUID

# Add project root to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from workers.transcriber.config import WorkerConfig, get_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("transcriber-worker")


class TranscriberWorker:
    """
    Transcription worker that processes jobs from the Supabase queue.
    """
    
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.running = False
        self.current_job_id: Optional[UUID] = None
        self.jobs_processed = 0
        self.last_job_time: Optional[datetime] = None
        self.last_stale_check: Optional[datetime] = None
        
        # These will be lazily initialized
        self._job_repo = None
        self._quota_repo = None
        self._storage = None
        self._pipeline = None
    
    @property
    def job_repo(self):
        """Lazy initialization of job repository."""
        if self._job_repo is None:
            from src.app.infra.db.supabase_jobs_repo import SupabaseJobQueueRepository
            self._job_repo = SupabaseJobQueueRepository()
        return self._job_repo
    
    @property
    def quota_repo(self):
        """Lazy initialization of quota repository."""
        if self._quota_repo is None:
            from src.app.infra.db.supabase_jobs_repo import SupabaseQuotaRepository
            self._quota_repo = SupabaseQuotaRepository()
        return self._quota_repo
    
    @property
    def storage(self):
        """Lazy initialization of storage provider."""
        if self._storage is None:
            from src.app.infra.storage.r2_provider import R2StorageProvider
            self._storage = R2StorageProvider()
        return self._storage
    
    @property
    def pipeline(self):
        """Lazy initialization of transcription pipeline."""
        if self._pipeline is None:
            from src.app.services.transcription_pipeline import TranscriptionPipeline
            self._pipeline = TranscriptionPipeline(language=self.config.default_language)
        return self._pipeline
    
    def start(self):
        """Start the worker."""
        logger.info(
            "Starting transcription worker: id=%s, poll_interval=%ds",
            self.config.worker_id,
            self.config.poll_interval_seconds,
        )
        
        # Validate configuration
        errors = self.config.validate()
        if errors:
            logger.error("Configuration errors: %s", errors)
            sys.exit(1)
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)
        
        self.running = True
        empty_polls = 0
        poll_interval = self.config.poll_interval_seconds
        
        while self.running:
            try:
                # Check for stale locks periodically
                self._maybe_release_stale_locks()
                
                # Try to fetch and process a job
                job = self.job_repo.fetch_and_lock_next_job(
                    worker_id=self.config.worker_id,
                )
                
                if job:
                    empty_polls = 0
                    poll_interval = self.config.poll_interval_seconds
                    self._process_job(job)
                    
                    # Check if we've hit max jobs
                    if (
                        self.config.max_jobs_per_run > 0
                        and self.jobs_processed >= self.config.max_jobs_per_run
                    ):
                        logger.info(
                            "Reached max jobs per run (%d), shutting down",
                            self.config.max_jobs_per_run,
                        )
                        break
                else:
                    empty_polls += 1
                    
                    # Exponential backoff on empty polls
                    poll_interval = min(
                        poll_interval * 1.5,
                        self.config.max_poll_interval_seconds,
                    )
                    
                    # Check for shutdown on empty queue
                    if self.config.shutdown_on_empty:
                        if self.last_job_time:
                            idle_time = datetime.now(timezone.utc) - self.last_job_time
                            if idle_time > timedelta(minutes=self.config.empty_queue_shutdown_minutes):
                                logger.info(
                                    "Queue empty for %d minutes, shutting down",
                                    self.config.empty_queue_shutdown_minutes,
                                )
                                break
                    
                    logger.debug(
                        "No jobs available, sleeping %.1fs (empty_polls=%d)",
                        poll_interval,
                        empty_polls,
                    )
                
                time.sleep(poll_interval)
                
            except KeyboardInterrupt:
                logger.info("Interrupted by user")
                break
            except Exception as e:
                logger.error("Error in worker loop: %s", e, exc_info=True)
                time.sleep(self.config.poll_interval_seconds)
        
        self._shutdown()
    
    def _process_job(self, job):
        """Process a single transcription job."""
        from src.app.domain.models import TranscriptionJob
        
        self.current_job_id = job.id
        self.last_job_time = datetime.now(timezone.utc)
        
        logger.info(
            "Processing job: id=%s, user=%s, object_key=%s, attempt=%d/%d",
            job.id,
            job.user_id,
            job.object_key,
            job.attempt_count + 1,
            job.max_attempts,
        )
        
        temp_file = None
        estimated_minutes = 0
        
        try:
            # Create temp directory
            temp_dir = Path(self.config.temp_dir)
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            # Download file from R2
            file_ext = Path(job.object_key).suffix or ".mp3"
            temp_file = temp_dir / f"{job.id}{file_ext}"
            
            logger.info("Downloading from R2: %s -> %s", job.object_key, temp_file)
            self.storage.download_to_path(job.object_key, temp_file)
            
            # Get estimated duration (if available from metadata)
            try:
                metadata = self.storage.get_object_metadata(job.object_key)
                # Rough estimation: assume 1 minute per MB for audio
                size_mb = (metadata.get("content_length", 0) or 0) / (1024 * 1024)
                estimated_minutes = max(1, int(size_mb))
            except Exception:
                estimated_minutes = 5  # Default estimate
            
            # Run transcription
            logger.info("Starting transcription...")
            result = self.pipeline.transcribe(temp_file)
            
            # Convert segments to JSON-serializable format
            segments_json = [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                }
                for seg in result.segments
            ]
            
            # Save results
            success = self.job_repo.mark_done(
                job_id=job.id,
                transcript_text=result.text,
                segments_json=segments_json,
                language=result.language,
                duration_sec=int(result.duration_sec),
                model_version=result.model_version,
            )
            
            if success:
                self.jobs_processed += 1
                logger.info(
                    "Job completed successfully: id=%s, duration=%ds, segments=%d",
                    job.id,
                    int(result.duration_sec),
                    len(segments_json),
                )
                
                # Reconcile quota
                actual_minutes = int(result.duration_sec / 60) + 1
                self.quota_repo.confirm_actual_minutes(
                    user_id=job.user_id,
                    estimated_minutes=estimated_minutes,
                    actual_minutes=actual_minutes,
                )
            else:
                logger.error("Failed to save job results: id=%s", job.id)
            
        except Exception as e:
            logger.error("Job failed: id=%s, error=%s", job.id, e, exc_info=True)
            
            # Determine if retryable
            from src.app.domain.errors import TranscriptionProcessingError, InvalidMediaError
            
            if isinstance(e, InvalidMediaError):
                # Don't retry invalid media
                self.job_repo.mark_failed(
                    job_id=job.id,
                    error_message=str(e),
                    permanent=True,
                )
            elif isinstance(e, TranscriptionProcessingError) and not e.retryable:
                self.job_repo.mark_failed(
                    job_id=job.id,
                    error_message=str(e),
                    permanent=True,
                )
            else:
                # Retry with backoff
                self.job_repo.mark_failed(
                    job_id=job.id,
                    error_message=str(e),
                    permanent=False,
                )
        
        finally:
            # Cleanup temp file
            if temp_file and temp_file.exists():
                try:
                    temp_file.unlink()
                    logger.debug("Cleaned up temp file: %s", temp_file)
                except Exception as e:
                    logger.warning("Failed to cleanup temp file: %s", e)
            
            self.current_job_id = None
    
    def _maybe_release_stale_locks(self):
        """Periodically check and release stale locks."""
        now = datetime.now(timezone.utc)
        
        if self.last_stale_check is None:
            self.last_stale_check = now
            return
        
        check_interval = timedelta(minutes=self.config.stale_lock_check_interval_minutes)
        if now - self.last_stale_check < check_interval:
            return
        
        self.last_stale_check = now
        
        released = self.job_repo.release_stale_locks(
            lock_ttl_minutes=self.config.lock_ttl_minutes,
        )
        
        if released > 0:
            logger.info("Released %d stale locks", released)
    
    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals."""
        logger.info("Received shutdown signal %d", signum)
        self.running = False
    
    def _shutdown(self):
        """Perform graceful shutdown."""
        logger.info(
            "Worker shutting down: jobs_processed=%d",
            self.jobs_processed,
        )
        
        # If we're in the middle of processing, wait
        if self.current_job_id:
            logger.info("Waiting for current job to complete: %s", self.current_job_id)
            # The job will complete in _process_job
        
        logger.info("Worker shutdown complete")


def main():
    """Main entry point."""
    config = get_config()
    worker = TranscriberWorker(config)
    worker.start()


if __name__ == "__main__":
    main()
