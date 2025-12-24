-- migrations/001_transcription_jobs.sql
-- Transcription jobs table for async queue processing
-- This table serves as both the job queue and results storage

-- Create the transcription_jobs table
CREATE TABLE IF NOT EXISTS transcription_jobs (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Owner and associations
    user_id UUID NOT NULL,
    recipe_id UUID NULL,
    
    -- Storage reference
    object_key TEXT NOT NULL,
    
    -- Job status
    status TEXT NOT NULL DEFAULT 'QUEUED' 
        CHECK (status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED')),
    
    -- Queue management
    priority INTEGER NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ NULL,
    locked_by TEXT NULL,
    
    -- Retry handling
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ NULL,
    error_message TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL,
    
    -- Estimation (for quota)
    estimated_duration_sec INTEGER NULL,
    
    -- Results (populated when DONE)
    duration_sec INTEGER NULL,
    language TEXT NULL,
    transcript_text TEXT NULL,
    segments_json JSONB NULL,
    model_version TEXT NULL,
    
    -- Audit
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_transcription_jobs_queue 
    ON transcription_jobs (status, next_attempt_at, priority DESC, created_at ASC)
    WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_user 
    ON transcription_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_locked 
    ON transcription_jobs (locked_at)
    WHERE status = 'RUNNING';

CREATE INDEX IF NOT EXISTS idx_transcription_jobs_recipe 
    ON transcription_jobs (recipe_id)
    WHERE recipe_id IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_transcription_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_transcription_jobs_updated_at ON transcription_jobs;
CREATE TRIGGER trigger_transcription_jobs_updated_at
    BEFORE UPDATE ON transcription_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_transcription_jobs_updated_at();

-- RPC function for atomic fetch-and-lock (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION fetch_and_lock_transcription_job(
    p_worker_id TEXT,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS SETOF transcription_jobs AS $$
DECLARE
    v_job transcription_jobs;
BEGIN
    -- Select and lock one job atomically
    SELECT * INTO v_job
    FROM transcription_jobs
    WHERE status = 'QUEUED'
      AND (next_attempt_at IS NULL OR next_attempt_at <= p_now)
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    -- If we got a job, update it to RUNNING
    IF v_job.id IS NOT NULL THEN
        UPDATE transcription_jobs
        SET 
            status = 'RUNNING',
            locked_at = p_now,
            locked_by = p_worker_id,
            started_at = COALESCE(started_at, p_now),
            attempt_count = attempt_count + 1
        WHERE id = v_job.id
        RETURNING * INTO v_job;
        
        RETURN NEXT v_job;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust role names as needed for your Supabase setup)
-- GRANT ALL ON transcription_jobs TO authenticated;
-- GRANT EXECUTE ON FUNCTION fetch_and_lock_transcription_job TO service_role;

COMMENT ON TABLE transcription_jobs IS 'Async transcription job queue with results storage';
COMMENT ON COLUMN transcription_jobs.object_key IS 'R2 storage key for the media file';
COMMENT ON COLUMN transcription_jobs.status IS 'QUEUED=waiting, RUNNING=processing, DONE=success, FAILED=error, CANCELLED=user cancelled';
COMMENT ON COLUMN transcription_jobs.segments_json IS 'Array of {start, end, text} objects with timing info';
