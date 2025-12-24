# Prompt curto — iniciar implementação (MVP: Supabase Queue + R2 + Worker)

Você é um Engenheiro de Software Sênior. Contexto: o Recipe AI já funciona e transcreve via fast-whisper localmente, mas está acoplado e síncrono. Precisamos migrar para um fluxo **assíncrono** com upload direto via **signed URL** para **Cloudflare R2**, e usar o **Supabase Postgres** como **fila (jobs table)** + banco de resultados. O worker será separado e rodará local/VM hibernável. Arquitetura deve ser **modular** para futura migração para RabbitMQ.

Tarefas (entregar incrementalmente, sem quebrar o fluxo atual):
1) Criar interfaces:
   - `StorageProvider` e implementar `R2StorageProvider` (S3-compatible, presigned PUT).
   - `JobQueueRepository` e implementar `SupabaseJobQueueRepository` (Postgres queue com `FOR UPDATE SKIP LOCKED`).
2) Backend FastAPI:
   - `POST /media/signed-upload` → retorna `object_key` + `upload_url`.
   - `POST /transcriptions/jobs` → cria job `QUEUED` no Supabase (aplicar quota).
   - `GET /transcriptions/jobs/{id}` → status + resultado.
   - Colocar isso em rotas `/v2` ou feature flag para não quebrar o fluxo atual.
3) Worker separado:
   - polling loop (configurável).
   - pega 1 job por vez com lock; marca RUNNING; baixa do R2; roda `faster-whisper`; grava `transcript_text` + `segments_json`; marca DONE/FAILED com retries/backoff + lock TTL.
4) Frontend React:
   - usar signed PUT para upload direto no R2.
   - criar job e fazer polling do status até DONE.

Regras:
- Clean Code, tipagem, logs estruturados.
- Idempotência por `job_id`.
- SQL migrations para Supabase: `transcription_jobs` (+ `usage_daily` para quota) e índices.
- Manter código preparado para substituir o repositório de fila por RabbitMQ depois (não acoplar Supabase no domínio).

Comece implementando:
- `app/infra/storage/r2_provider.py`
- `app/infra/db/supabase_jobs_repo.py`
- `app/services/transcription_pipeline.py`
- `workers/transcriber/main.py`
- migrations SQL.
