-- migrations/002_usage_daily.sql
-- Daily usage tracking for quota management

-- Create usage_daily table
CREATE TABLE IF NOT EXISTS usage_daily (
    -- Composite primary key
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    
    -- Usage counters
    minutes_used INTEGER NOT NULL DEFAULT 0,
    jobs_count INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (user_id, date)
);

-- Index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_usage_daily_user 
    ON usage_daily (user_id, date DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_usage_daily_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_usage_daily_updated_at ON usage_daily;
CREATE TRIGGER trigger_usage_daily_updated_at
    BEFORE UPDATE ON usage_daily
    FOR EACH ROW
    EXECUTE FUNCTION update_usage_daily_updated_at();

-- RPC function for atomic check-and-reserve quota
CREATE OR REPLACE FUNCTION check_and_reserve_quota(
    p_user_id UUID,
    p_date DATE,
    p_minutes_to_reserve INTEGER,
    p_daily_limit INTEGER DEFAULT 60
)
RETURNS TABLE (
    allowed BOOLEAN,
    minutes_remaining INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_current_usage INTEGER;
    v_new_usage INTEGER;
BEGIN
    -- Get or create usage record
    INSERT INTO usage_daily (user_id, date, minutes_used, jobs_count)
    VALUES (p_user_id, p_date, 0, 0)
    ON CONFLICT (user_id, date) DO NOTHING;
    
    -- Get current usage with lock
    SELECT minutes_used INTO v_current_usage
    FROM usage_daily
    WHERE user_id = p_user_id AND date = p_date
    FOR UPDATE;
    
    v_new_usage := v_current_usage + p_minutes_to_reserve;
    
    -- Check if allowed
    IF v_new_usage > p_daily_limit THEN
        RETURN QUERY SELECT 
            FALSE,
            GREATEST(0, p_daily_limit - v_current_usage),
            'Daily limit exceeded'::TEXT;
        RETURN;
    END IF;
    
    -- Reserve the minutes
    UPDATE usage_daily
    SET 
        minutes_used = v_new_usage,
        jobs_count = jobs_count + 1
    WHERE user_id = p_user_id AND date = p_date;
    
    RETURN QUERY SELECT 
        TRUE,
        p_daily_limit - v_new_usage,
        NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- RPC function to adjust quota (reconcile estimated vs actual)
CREATE OR REPLACE FUNCTION adjust_quota_usage(
    p_user_id UUID,
    p_date DATE,
    p_minutes_delta INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE usage_daily
    SET minutes_used = GREATEST(0, minutes_used + p_minutes_delta)
    WHERE user_id = p_user_id AND date = p_date;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed)
-- GRANT ALL ON usage_daily TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_and_reserve_quota TO authenticated;
-- GRANT EXECUTE ON FUNCTION adjust_quota_usage TO service_role;

COMMENT ON TABLE usage_daily IS 'Daily transcription usage tracking per user';
COMMENT ON COLUMN usage_daily.minutes_used IS 'Total minutes of audio transcribed today';
COMMENT ON COLUMN usage_daily.jobs_count IS 'Number of transcription jobs created today';
