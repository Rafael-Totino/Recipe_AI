import { apiRequest } from './api';

import type { PlaylistDetail, PlaylistSummary } from '../types';

export interface PlaylistCreatePayload {
  name: string;
  description?: string;
}

export interface PlaylistUpdatePayload {
  name?: string;
  description?: string | null;
}

export const listPlaylists = async (token: string) =>
  apiRequest<PlaylistSummary[]>('/playlists', {
    method: 'GET',
    authToken: token
  });

export const createPlaylist = async (token: string, payload: PlaylistCreatePayload) =>
  apiRequest<PlaylistSummary>('/playlists', {
    method: 'POST',
    authToken: token,
    body: JSON.stringify(payload)
  });

export const updatePlaylist = async (
  token: string,
  playlistId: string,
  payload: PlaylistUpdatePayload
) =>
  apiRequest<PlaylistSummary>(`/playlists/${playlistId}`, {
    method: 'PATCH',
    authToken: token,
    body: JSON.stringify(payload)
  });

export const deletePlaylist = async (token: string, playlistId: string) =>
  apiRequest<void>(`/playlists/${playlistId}`, {
    method: 'DELETE',
    authToken: token
  });

export const fetchPlaylistDetail = async (token: string, playlistId: string) =>
  apiRequest<PlaylistDetail>(`/playlists/${playlistId}/recipes`, {
    method: 'GET',
    authToken: token
  });

export const addRecipeToPlaylist = async (
  token: string,
  playlistId: string,
  recipeId: string
) =>
  apiRequest(`/playlists/${playlistId}/recipes`, {
    method: 'POST',
    authToken: token,
    body: JSON.stringify({ recipeId })
  });

export const removeRecipeFromPlaylist = async (
  token: string,
  playlistId: string,
  recipeId: string
) =>
  apiRequest<void>(`/playlists/${playlistId}/recipes/${recipeId}`, {
    method: 'DELETE',
    authToken: token
  });
