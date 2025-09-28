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
    const videoIdMatch = url.match(/[?&]v=([^&]+)/) ?? url.match(/youtu.be\/(\w+)/);
    const videoId = videoIdMatch?.[1];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }

  if (url.includes('instagram.com')) {
    return `${url}embed`;
  }

  if (url.includes('tiktok.com')) {
    return url;
  }

  return url;
};

const RecipePlayer = ({ media, source }: RecipePlayerProps) => {
  const embedUrl = extractEmbedUrl(media, source);

  if (!embedUrl) {
    return (
      <div className="surface-card recipe-player__empty" style={{ textAlign: 'center' }}>
        <p>Nenhuma mídia vinculada a esta receita.</p>
      </div>
    );
  }

  return (
    <div className="surface-card recipe-player">
      <iframe
        title="Player da receita"
        src={embedUrl}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
};

export default RecipePlayer;
