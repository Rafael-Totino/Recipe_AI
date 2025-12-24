# Async Transcription System - Setup Guide

This document explains how to set up and run the new async transcription system.

## Overview

The new architecture uses:
- **Cloudflare R2** for media storage (S3-compatible)
- **Supabase Postgres** as a job queue (with FOR UPDATE SKIP LOCKED)
- **Separate worker** for transcription processing
- **Signed URLs** for direct client-to-R2 uploads

## Prerequisites

1. **Cloudflare R2 Bucket**
   - Create a bucket in Cloudflare R2
   - Create an API token with read/write access
   - Note: R2 is S3-compatible and egress-free

2. **Supabase Project** (already configured)
   - Run the SQL migrations in `migrations/` folder

3. **Python Environment**
   - Install new dependency: `pip install boto3`
   - Or: `pip install -r requirements.txt`

## Database Setup

Run these migrations in your Supabase SQL Editor:

```sql
-- 1. Run migrations/001_transcription_jobs.sql
-- 2. Run migrations/002_usage_daily.sql
```

## Environment Variables

Add these to your `.env` file:

```env
# R2 Storage
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=recipe-ai-media

# Transcription settings
TRANSCRIPTION_DAILY_LIMIT_MINUTES=60
```

See `.env.example` for all available options.

## Running the System

### 1. Start the API Server

```bash
# Development
uvicorn src.app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Start the Transcription Worker

```bash
# In a separate terminal
python -m workers.transcriber.main
```

Or with environment variables:
```bash
WORKER_ID=worker-1 python -m workers.transcriber.main
```

## API Endpoints (V2)

### Media Upload

```http
POST /v2/media/signed-upload
Content-Type: application/json
Authorization: Bearer <token>

{
  "filename": "audio.mp3",
  "content_type": "audio/mpeg",
  "size_bytes": 1024000
}
```

Response:
```json
{
  "object_key": "users/{user_id}/media/2024/01/abc123_audio.mp3",
  "upload_url": "https://...",
  "expires_at": "2024-01-01T12:00:00Z"
}
```

Then upload directly to R2:
```bash
curl -X PUT -H "Content-Type: audio/mpeg" --data-binary @audio.mp3 "<upload_url>"
```

### Create Transcription Job

```http
POST /v2/transcriptions/jobs
Content-Type: application/json
Authorization: Bearer <token>

{
  "object_key": "users/{user_id}/media/2024/01/abc123_audio.mp3",
  "estimated_duration_sec": 300
}
```

Response:
```json
{
  "id": "uuid",
  "status": "QUEUED",
  "object_key": "...",
  "created_at": "..."
}
```

### Poll Job Status

```http
GET /v2/transcriptions/jobs/{job_id}
Authorization: Bearer <token>
```

Response (when complete):
```json
{
  "id": "uuid",
  "status": "DONE",
  "transcript_text": "Full transcription...",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "Hello"},
    {"start": 2.5, "end": 5.0, "text": "World"}
  ],
  "language": "pt",
  "duration_sec": 120
}
```

### Check Quota

```http
GET /v2/transcriptions/quota
Authorization: Bearer <token>
```

Response:
```json
{
  "minutes_used": 15,
  "minutes_remaining": 45,
  "daily_limit": 60,
  "jobs_count": 3
}
```

## Frontend Integration

Example React hook for the new flow:

```typescript
async function transcribeAudio(file: File) {
  // 1. Get signed upload URL
  const uploadResp = await fetch('/v2/media/signed-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type,
      size_bytes: file.size
    })
  });
  const { object_key, upload_url } = await uploadResp.json();
  
  // 2. Upload directly to R2
  await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file
  });
  
  // 3. Create transcription job
  const jobResp = await fetch('/v2/transcriptions/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ object_key })
  });
  const job = await jobResp.json();
  
  // 4. Poll for completion
  while (job.status === 'QUEUED' || job.status === 'RUNNING') {
    await new Promise(r => setTimeout(r, 3000));
    const statusResp = await fetch(`/v2/transcriptions/jobs/${job.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    Object.assign(job, await statusResp.json());
  }
  
  return job;
}
```

## Architecture Benefits

1. **Decoupled**: API server doesn't do heavy processing
2. **Scalable**: Add more workers as needed
3. **Resilient**: Jobs survive restarts, retries with backoff
4. **Cost-effective**: R2 has no egress fees, worker can hibernate
5. **Modular**: Easy to swap queue (RabbitMQ) or storage later

## Future Improvements

- [ ] Realtime updates via Supabase Realtime
- [ ] Push notifications (FCM) when job completes
- [ ] RabbitMQ migration for high volume
- [ ] GPU worker on cloud (Cloud Run, GKE)
- [ ] Auto-hibernating VM for worker
