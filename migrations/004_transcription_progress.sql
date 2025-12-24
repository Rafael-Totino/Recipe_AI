ALTER TABLE transcription_jobs
    ADD COLUMN IF NOT EXISTS stage text DEFAULT 'QUEUED';

ALTER TABLE transcription_jobs
    ADD COLUMN IF NOT EXISTS progress real DEFAULT 0;

ALTER TABLE transcription_jobs
    ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;
