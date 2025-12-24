-- migrations/003_embedding_jobs.sql
-- Embedding jobs table for async embedding processing

CREATE TABLE IF NOT EXISTS embedding_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    recipe_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'RUNNING', 'DONE', 'FAILED')),
    payload TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    next_attempt_at TIMESTAMPTZ NULL,
    locked_at TIMESTAMPTZ NULL,
    locked_by TEXT NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ NULL,
    finished_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_queue
    ON embedding_jobs (status, next_attempt_at, created_at ASC)
    WHERE status = 'QUEUED';

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_user
    ON embedding_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_recipe
    ON embedding_jobs (recipe_id);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_locked
    ON embedding_jobs (locked_at)
    WHERE status = 'RUNNING';

CREATE OR REPLACE FUNCTION update_embedding_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_embedding_jobs_updated_at ON embedding_jobs;
CREATE TRIGGER trigger_embedding_jobs_updated_at
    BEFORE UPDATE ON embedding_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_embedding_jobs_updated_at();

CREATE OR REPLACE FUNCTION fetch_and_lock_embedding_job(
    p_worker_id TEXT,
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS SETOF embedding_jobs AS $$
DECLARE
    v_job embedding_jobs;
BEGIN
    SELECT * INTO v_job
    FROM embedding_jobs
    WHERE status = 'QUEUED'
      AND (next_attempt_at IS NULL OR next_attempt_at <= p_now)
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job.id IS NOT NULL THEN
        UPDATE embedding_jobs
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

COMMENT ON TABLE embedding_jobs IS 'Async embedding job queue for recipe embeddings';
COMMENT ON COLUMN embedding_jobs.payload IS 'Serialized payload used to build embeddings';
