import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  createPlaylist as createPlaylistRequest,
  deletePlaylist as deletePlaylistRequest,
  fetchPlaylistDetail as fetchPlaylistDetailRequest,
  listPlaylists as listPlaylistsRequest,
  updatePlaylist as updatePlaylistRequest
} from '../services/playlists';
import type { PlaylistDetail, PlaylistItem, PlaylistSummary } from '../types';
import { ApiError } from '../services/api';
import { useAuth } from './AuthContext';

interface PlaylistContextValue {
  playlists: PlaylistSummary[];
  isLoading: boolean;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (payload: { name: string; description?: string }) => Promise<PlaylistSummary | null>;
  updatePlaylist: (
    playlistId: string,
    payload: { name?: string; description?: string | null }
  ) => Promise<PlaylistSummary | null>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  fetchPlaylistDetail: (playlistId: string) => Promise<PlaylistDetail | null>;
  playlistPreviews: Record<string, string[]>;
  getPlaylistPreview: (playlistId: string) => Promise<string[]>;
}

const PlaylistContext = createContext<PlaylistContextValue | undefined>(undefined);

export const PlaylistProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playlistPreviews, setPlaylistPreviews] = useState<Record<string, string[]>>({});

  const loadPlaylists = useCallback(async () => {
    if (!session?.access_token) {
      setPlaylists([]);
      setPlaylistPreviews({});
      return;
    }
    setIsLoading(true);
    try {
      const data = await listPlaylistsRequest(session.access_token);
      setPlaylists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Unable to load playlists', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token) {
      setPlaylistPreviews({});
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  const createPlaylist = useCallback(
    async (payload: { name: string; description?: string }) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        const created = await createPlaylistRequest(session.access_token, payload);
        setPlaylists((prev) => [created, ...prev]);
        return created;
      } catch (error) {
        console.error('Unable to create playlist', error);
        return null;
      }
    },
    [session?.access_token]
  );

  const updatePlaylist = useCallback(
    async (playlistId: string, payload: { name?: string; description?: string | null }) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        const updated = await updatePlaylistRequest(session.access_token, playlistId, payload);
        setPlaylists((prev) => prev.map((item) => (item.id === playlistId ? updated : item)));
        return updated;
      } catch (error) {
        console.error('Unable to update playlist', error);
        return null;
      }
    },
    [session?.access_token]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      if (!session?.access_token) {
        return;
      }
      try {
        await deletePlaylistRequest(session.access_token, playlistId);
        setPlaylists((prev) => prev.filter((item) => item.id !== playlistId));
        setPlaylistPreviews((prev) => {
          if (!prev[playlistId]) {
            return prev;
          }
          const { [playlistId]: _removed, ...rest } = prev;
          return rest;
        });
      } catch (error) {
        console.error('Unable to delete playlist', error);
      }
    },
    [session?.access_token]
  );

  const fetchPlaylistDetail = useCallback(
    async (playlistId: string) => {
      if (!session?.access_token) {
        return null;
      }
      try {
        return await fetchPlaylistDetailRequest(session.access_token, playlistId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    [session?.access_token]
  );

  const getPlaylistPreview = useCallback(
    async (playlistId: string) => {
      if (playlistPreviews[playlistId]) {
        return playlistPreviews[playlistId];
      }
      if (!session?.access_token) {
        return [];
      }
      try {
        const detail = await fetchPlaylistDetailRequest(session.access_token, playlistId);
        const sortedItems = [...(detail?.items ?? [])].sort((a: PlaylistItem, b: PlaylistItem) => {
          const dateA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const dateB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          if (dateA !== dateB) {
            return dateB - dateA;
          }
          const positionA = typeof a.position === 'number' ? a.position : Number.MAX_SAFE_INTEGER;
          const positionB = typeof b.position === 'number' ? b.position : Number.MAX_SAFE_INTEGER;
          return positionA - positionB;
        });
        const latestCovers = sortedItems.slice(0, 4).map((item) => {
          const mediaImage = item.recipe.media?.find((media) => media.type === 'image');
          return (
            item.recipe.coverImage ||
            mediaImage?.thumbnailUrl ||
            mediaImage?.url ||
            ''
          );
        });
        setPlaylistPreviews((prev) => ({ ...prev, [playlistId]: latestCovers }));
        return latestCovers;
      } catch (error) {
        console.error('Unable to load playlist preview', error);
        setPlaylistPreviews((prev) => ({ ...prev, [playlistId]: [] }));
        return [];
      }
    },
    [playlistPreviews, session?.access_token]
  );

  const value = useMemo(
    () => ({
      playlists,
      isLoading,
      loadPlaylists,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      fetchPlaylistDetail,
      playlistPreviews,
      getPlaylistPreview
    }),
    [
      createPlaylist,
      deletePlaylist,
      fetchPlaylistDetail,
      getPlaylistPreview,
      isLoading,
      loadPlaylists,
      playlistPreviews,
      playlists,
      updatePlaylist
    ]
  );

  return <PlaylistContext.Provider value={value}>{children}</PlaylistContext.Provider>;
};

export const usePlaylists = () => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylists must be used within a PlaylistProvider');
  }
  return context;
};
