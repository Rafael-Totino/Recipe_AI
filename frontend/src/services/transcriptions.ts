import { apiRequest } from './api';
import type { TranscriptionJob } from '../types';

export const fetchTranscriptionJob = (token: string, jobId: string) =>
  apiRequest<TranscriptionJob>(`/v2/transcriptions/jobs/${jobId}`, {
    authToken: token
  });
