import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { fetchTranscriptionJob } from '../services/transcriptions';
import type { TranscriptionJob } from '../types';

const POLL_INTERVAL_MS = 10000;

export const useTranscriptionJob = (jobId?: string) => {
  const { session } = useAuth();
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRealtimeActive, setIsRealtimeActive] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchJob = useCallback(async () => {
    if (!session?.access_token || !jobId) {
      return;
    }

    const isInitialLoad = !hasLoadedRef.current;
    if (isInitialLoad) {
      setIsLoading(true);
    }

    try {
      const data = await fetchTranscriptionJob(session.access_token, jobId);
      setJob(data);
    } catch (error) {
      console.error('Failed to fetch transcription job', error);
    } finally {
      if (isInitialLoad) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }
  }, [jobId, session?.access_token]);

  useEffect(() => {
    if (!jobId || !session?.access_token) {
      return;
    }

    void fetchJob();
  }, [fetchJob, jobId, session?.access_token]);

  useEffect(() => {
    if (!jobId) {
      return undefined;
    }

    const channel = supabase
      .channel(`transcription_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcription_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          if (payload.new) {
            setJob(payload.new as TranscriptionJob);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeActive(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setIsRealtimeActive(false);
        }
      });

    return () => {
      void channel.unsubscribe();
    };
  }, [jobId]);

  useEffect(() => {
    if (!jobId || !session?.access_token || isRealtimeActive) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void fetchJob();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchJob, isRealtimeActive, jobId, session?.access_token]);

  return {
    job,
    isLoading,
    isRealtimeActive
  };
};
