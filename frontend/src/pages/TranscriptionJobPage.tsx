import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Loader from '../components/shared/Loader';
import { useTranscriptionJob } from '../hooks/useTranscriptionJob';
import { formatTime } from '../utils/formatDate';
import './transcription-job.css';

const TranscriptionJobPage = () => {
  const { jobId } = useParams();
  const { job, isLoading, isRealtimeActive } = useTranscriptionJob(jobId);

  const progressValue = useMemo(() => {
    if (!job) {
      return 0;
    }
    if (typeof job.progress === 'number') {
      return Math.max(0, Math.min(100, job.progress));
    }
    return job.status === 'DONE' ? 100 : 0;
  }, [job]);

  const lastHeartbeatLabel = useMemo(() => {
    if (!job?.last_heartbeat_at) {
      return null;
    }
    return formatTime(job.last_heartbeat_at);
  }, [job?.last_heartbeat_at]);

  if (!jobId) {
    return (
      <div className="transcription-job">
        <p className="transcription-job__error">ID da transcrição inválido.</p>
      </div>
    );
  }

  if (isLoading && !job) {
    return (
      <div className="transcription-job transcription-job--loading">
        <Loader />
      </div>
    );
  }

  return (
    <div className="transcription-job">
      <header className="transcription-job__header">
        <p className="transcription-job__eyebrow">Transcrição em tempo real</p>
        <h1 className="transcription-job__title">Acompanhe o progresso do áudio</h1>
        <p className="transcription-job__subtitle">
          {isRealtimeActive ? 'Realtime ativo' : 'Atualizações a cada 10s (fallback)'}
        </p>
      </header>

      <section className="transcription-job__card">
        <div className="transcription-job__row">
          <div>
            <p className="transcription-job__label">Status</p>
            <p className="transcription-job__value">{job?.status ?? '—'}</p>
          </div>
          <div>
            <p className="transcription-job__label">Etapa</p>
            <p className="transcription-job__value">{job?.stage ?? '—'}</p>
          </div>
        </div>

        <div className="transcription-job__progress">
          <div className="transcription-job__progress-track" aria-hidden="true">
            <div
              className="transcription-job__progress-fill"
              style={{ width: `${progressValue}%` }}
            />
          </div>
          <div className="transcription-job__progress-meta">
            <span>{Math.round(progressValue)}%</span>
            <span>{job?.stage ?? 'Processando...'}</span>
          </div>
        </div>

        <div className="transcription-job__row transcription-job__row--meta">
          <div>
            <p className="transcription-job__label">Último sinal</p>
            <p className="transcription-job__value">{lastHeartbeatLabel ?? '—'}</p>
          </div>
          <div>
            <p className="transcription-job__label">Tentativas</p>
            <p className="transcription-job__value">{job?.attempt_count ?? 0}</p>
          </div>
        </div>

        {job?.error_message ? (
          <div className="transcription-job__error">{job.error_message}</div>
        ) : null}
      </section>
    </div>
  );
};

export default TranscriptionJobPage;
