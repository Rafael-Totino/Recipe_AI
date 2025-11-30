import { useMemo } from 'react';
import type { RecipeMedia, RecipeSource } from '../../types';
import './recipes.css';

interface RecipePlayerProps {
  media?: RecipeMedia[];
  source?: RecipeSource;
}

const extractEmbedUrl = (media?: RecipeMedia[], source?: RecipeSource) => {
  const primary = media?.[0];
  if (!primary?.url && !source?.link) {
    return null;
  }
  const url = primary?.url ?? source?.link!;

  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const videoIdMatch = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu.be\/([\w-]+)/);
    const videoId = videoIdMatch?.[1];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }

  if (url.includes('instagram.com')) {
    const normalized = url.endsWith('/') ? url : `${url}/`;
    return `${normalized}embed`;
  }

  if (url.includes('tiktok.com')) {
    return url;
  }

  return url;
};

const RecipePlayer = ({ media, source }: RecipePlayerProps) => {
  const primary = media?.[0];
  const embedUrl = useMemo(() => extractEmbedUrl(media, source), [media, source]);
  const providerLabel = primary?.provider ?? source?.importedFrom ?? null;
  const posterImage =
    primary?.thumbnailUrl ?? (primary?.type === 'image' ? primary.url : undefined);

  if (!primary && !source?.link) {
    return null;
  }

  const isVideoEmbed =
    Boolean(embedUrl) &&
    (primary?.type === 'video' ||
      /youtube\.com|youtu\.be|instagram\.com|tiktok\.com/.test(embedUrl ?? ''));

  const isAudio = primary?.type === 'audio';

  return (
    <section className="surface-card recipe-player" aria-label="Recipe media player">
      <header className="recipe-player__header">
        <div>
          <h2 className="font-playfair">Recipe media</h2>
          <p className="text-muted">
            {providerLabel ? `Source: ${providerLabel}` : 'Follow along with the original content.'}
          </p>
        </div>
        {source?.link ? (
          <a
            className="recipe-player__external-link"
            href={source.link}
            target="_blank"
            rel="noreferrer"
          >
            Open original
          </a>
        ) : null}
      </header>

      <div className="recipe-player__media">
        {isVideoEmbed && embedUrl ? (
          <iframe
            src={embedUrl}
            title="Recipe media"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : null}

        {isAudio && embedUrl ? (
          <audio controls src={embedUrl}>
            Your browser does not support the audio element.
          </audio>
        ) : null}

        {!isVideoEmbed && !isAudio && posterImage ? (
          <img src={posterImage} alt="Recipe illustration" loading="lazy" />
        ) : null}

        {!isVideoEmbed && !isAudio && !posterImage && embedUrl ? (
          <a
            className="recipe-player__fallback-link"
            href={embedUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open media in new tab
          </a>
        ) : null}
      </div>
    </section>
  );
};

export default RecipePlayer;
