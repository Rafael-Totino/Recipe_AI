# src/services/playlists.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable
from uuid import UUID

from supabase import Client

from src.services.slugify import slugify, unique_slug

ALL_SAVED_PLAYLIST_ID = "system:all-saved"
ALL_FAVORITES_PLAYLIST_ID = "system:all-favorites"

_SYSTEM_DEFINITIONS: dict[str, dict[str, str]] = {
    ALL_SAVED_PLAYLIST_ID: {"name": "Todos salvos", "slug": "all-saved"},
    ALL_FAVORITES_PLAYLIST_ID: {"name": "Todos favoritos", "slug": "all-favorites"},
}

SYSTEM_PLAYLIST_IDS = set(_SYSTEM_DEFINITIONS.keys())


class PlaylistNotFoundError(LookupError):
    """Raised when a playlist or recipe cannot be located."""


class PlaylistPermissionError(PermissionError):
    """Raised when an operation is not allowed for the playlist."""


class PlaylistConflictError(ValueError):
    """Raised when trying to create duplicated playlist data."""


def format_timestamp(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return str(value)


def stringify_id(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, UUID):
        return str(value)
    return str(value)


def system_playlist_metadata(playlist_id: str) -> dict[str, str]:
    try:
        return _SYSTEM_DEFINITIONS[playlist_id]
    except KeyError as exc:  # pragma: no cover - proteção extra
        raise PlaylistNotFoundError("Playlist do sistema desconhecida") from exc


def list_system_playlists(supa: Client, owner_id: str) -> list[dict[str, Any]]:
    owner = str(owner_id)
    saved_resp = (
        supa.table("recipes")
        .select("recipe_id", count="exact")
        .eq("owner_id", owner)
        .limit(1)
        .execute()
    )
    total_saved = getattr(saved_resp, "count", 0) or 0

    favorites_resp = (
        supa.table("recipes")
        .select("recipe_id", count="exact")
        .eq("owner_id", owner)
        .eq("is_favorite", True)
        .limit(1)
        .execute()
    )
    total_favorites = getattr(favorites_resp, "count", 0) or 0

    totals = {
        ALL_SAVED_PLAYLIST_ID: total_saved,
        ALL_FAVORITES_PLAYLIST_ID: total_favorites,
    }
    summaries: list[dict[str, Any]] = []
    for playlist_id, meta in _SYSTEM_DEFINITIONS.items():
        summaries.append(
            {
                "id": playlist_id,
                "name": meta["name"],
                "slug": meta["slug"],
                "description": None,
                "type": "system",
                "recipeCount": totals.get(playlist_id, 0),
                "createdAt": None,
                "updatedAt": None,
            }
        )
    return summaries


def list_custom_playlists(supa: Client, owner_id: str) -> list[dict[str, Any]]:
    owner = str(owner_id)
    response = (
        supa.table("playlists")
        .select("playlist_id,name,slug,description,type,created_at,updated_at")
        .eq("owner_id", owner)
        .eq("type", "custom")
        .order("created_at", desc=True)
        .execute()
    )
    rows = response.data or []
    playlist_ids = [
        stringify_id(row.get("playlist_id")) for row in rows if row.get("playlist_id")
    ]
    counts = _fetch_recipe_counts(supa, playlist_ids)
    return [
        serialize_playlist(row, counts.get(stringify_id(row.get("playlist_id")), 0))
        for row in rows
    ]


def create_playlist(
    supa: Client, owner_id: str, *, name: str, description: str | None
) -> dict[str, Any]:
    owner = str(owner_id)
    title = (name or "").strip()
    if not title:
        raise ValueError("Nome da playlist é obrigatório")
    base_slug = slugify(title)
    slug_value = _ensure_unique_slug(supa, owner, base_slug)
    payload = {
        "owner_id": owner,
        "name": title,
        "slug": slug_value,
        "description": description,
        "type": "custom",
    }
    response = supa.table("playlists").insert(payload).execute()
    rows = response.data or []
    if not rows:
        raise RuntimeError("Não foi possível criar a playlist")
    return serialize_playlist(rows[0], 0)


def update_playlist(
    supa: Client, owner_id: str, playlist_id: str, changes: dict[str, Any]
) -> dict[str, Any]:
    owner = str(owner_id)
    playlist_row = _get_playlist_row(supa, owner, playlist_id)
    if (playlist_row.get("type") or "custom") != "custom":
        raise PlaylistPermissionError("Playlists do sistema não podem ser editadas")

    payload: dict[str, Any] = {}
    if "name" in changes:
        new_name = (changes.get("name") or "").strip()
        if not new_name:
            raise ValueError("Nome da playlist é obrigatório")
        payload["name"] = new_name
        base_slug = slugify(new_name)
        payload["slug"] = _ensure_unique_slug(
            supa, owner, base_slug, ignore_playlist_id=playlist_id
        )
    if "description" in changes:
        payload["description"] = changes.get("description")

    if payload:
        response = (
            supa.table("playlists")
            .update(payload)
            .eq("owner_id", owner)
            .eq("playlist_id", playlist_id)
            .execute()
        )
        rows = response.data or []
        if rows:
            playlist_row = rows[0]
        else:  # fallback em clientes antigos do Supabase
            playlist_row = _get_playlist_row(supa, owner, playlist_id)

    counts = _fetch_recipe_counts(supa, [playlist_id])
    return serialize_playlist(playlist_row, counts.get(playlist_id, 0))


def delete_playlist(supa: Client, owner_id: str, playlist_id: str) -> None:
    owner = str(owner_id)
    playlist_row = _get_playlist_row(supa, owner, playlist_id)
    if (playlist_row.get("type") or "custom") != "custom":
        raise PlaylistPermissionError("Playlists do sistema não podem ser removidas")
    supa.table("playlist_recipes").delete().eq("playlist_id", playlist_id).execute()
    supa.table("playlists").delete().eq("owner_id", owner).eq("playlist_id", playlist_id).execute()


def add_recipe_to_playlist(
    supa: Client, owner_id: str, playlist_id: str, recipe_id: str
) -> dict[str, Any]:
    owner = str(owner_id)
    playlist_row = _get_playlist_row(supa, owner, playlist_id)
    if (playlist_row.get("type") or "custom") != "custom":
        raise PlaylistPermissionError("Não é possível modificar playlists do sistema")

    _validate_recipe_access(supa, owner, recipe_id)

    existing = (
        supa.table("playlist_recipes")
        .select("recipe_id")
        .eq("playlist_id", playlist_id)
        .eq("recipe_id", recipe_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise PlaylistConflictError("Receita já está na playlist")

    last_position_resp = (
        supa.table("playlist_recipes")
        .select("position")
        .eq("playlist_id", playlist_id)
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    last_position = 0
    last_rows = last_position_resp.data or []
    if last_rows:
        pos = last_rows[0].get("position")
        if isinstance(pos, int) and pos > 0:
            last_position = pos
    payload = {
        "playlist_id": playlist_id,
        "recipe_id": recipe_id,
        "position": last_position + 1,
    }
    response = supa.table("playlist_recipes").insert(payload).execute()
    rows = response.data or []
    inserted = rows[0] if rows else payload
    return {
        "recipeId": stringify_id(inserted.get("recipe_id") or recipe_id),
        "addedAt": format_timestamp(inserted.get("added_at")),
        "position": inserted.get("position"),
    }


def remove_recipe_from_playlist(
    supa: Client, owner_id: str, playlist_id: str, recipe_id: str
) -> None:
    owner = str(owner_id)
    playlist_row = _get_playlist_row(supa, owner, playlist_id)
    if (playlist_row.get("type") or "custom") != "custom":
        raise PlaylistPermissionError("Não é possível modificar playlists do sistema")

    existing = (
        supa.table("playlist_recipes")
        .select("recipe_id")
        .eq("playlist_id", playlist_id)
        .eq("recipe_id", recipe_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise PlaylistNotFoundError("Receita não encontrada na playlist")

    supa.table("playlist_recipes").delete().eq("playlist_id", playlist_id).eq(
        "recipe_id", recipe_id
    ).execute()


def fetch_custom_playlist_bundle(
    supa: Client, owner_id: str, playlist_id: str
) -> dict[str, Any]:
    owner = str(owner_id)
    playlist_row = _get_playlist_row(supa, owner, playlist_id)
    if (playlist_row.get("type") or "custom") != "custom":
        raise PlaylistPermissionError("Playlists do sistema são calculadas dinamicamente")

    join_resp = (
        supa.table("playlist_recipes")
        .select("recipe_id,added_at,position")
        .eq("playlist_id", playlist_id)
        .order("position")
        .order("added_at")
        .execute()
    )
    join_rows = join_resp.data or []
    items = [
        {
            "recipeId": stringify_id(row.get("recipe_id")),
            "addedAt": format_timestamp(row.get("added_at")),
            "position": row.get("position"),
        }
        for row in join_rows
        if row.get("recipe_id")
    ]
    recipe_ids = [item["recipeId"] for item in items]
    recipes = fetch_recipes_by_ids(supa, owner, recipe_ids)
    return {"playlist": playlist_row, "items": items, "recipes": recipes}


def fetch_system_playlist_recipes(
    supa: Client, owner_id: str, playlist_id: str
) -> list[dict[str, Any]]:
    owner = str(owner_id)
    query = (
        supa.table("recipes")
        .select("recipe_id,title,metadata,created_at,updated_at,is_favorite")
        .eq("owner_id", owner)
        .order("created_at", desc=True)
    )
    if playlist_id == ALL_FAVORITES_PLAYLIST_ID:
        query = query.eq("is_favorite", True)
    elif playlist_id != ALL_SAVED_PLAYLIST_ID:
        raise PlaylistNotFoundError("Playlist do sistema desconhecida")
    response = query.execute()
    return response.data or []


def fetch_recipes_by_ids(
    supa: Client, owner_id: str, recipe_ids: Iterable[str]
) -> list[dict[str, Any]]:
    ids = [str(rid) for rid in recipe_ids if rid]
    if not ids:
        return []
    response = (
        supa.table("recipes")
        .select("recipe_id,title,metadata,created_at,updated_at,is_favorite")
        .eq("owner_id", owner_id)
        .in_("recipe_id", ids)
        .execute()
    )
    return response.data or []


def serialize_playlist(row: dict[str, Any], recipe_count: int) -> dict[str, Any]:
    return {
        "id": stringify_id(row.get("playlist_id")),
        "name": str(row.get("name") or ""),
        "slug": str(row.get("slug") or ""),
        "description": row.get("description"),
        "type": row.get("type") or "custom",
        "recipeCount": recipe_count,
        "createdAt": format_timestamp(row.get("created_at")),
        "updatedAt": format_timestamp(row.get("updated_at")),
    }


def _get_playlist_row(supa: Client, owner_id: str, playlist_id: str) -> dict[str, Any]:
    response = (
        supa.table("playlists")
        .select("playlist_id,name,slug,description,type,created_at,updated_at")
        .eq("owner_id", owner_id)
        .eq("playlist_id", playlist_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise PlaylistNotFoundError("Playlist não encontrada")
    return rows[0]


def _ensure_unique_slug(
    supa: Client, owner_id: str, base_slug: str, *, ignore_playlist_id: str | None = None
) -> str:
    candidate = base_slug or "playlist"
    attempts = 0
    while True:
        query = (
            supa.table("playlists")
            .select("playlist_id")
            .eq("owner_id", owner_id)
            .eq("slug", candidate)
        )
        if ignore_playlist_id:
            query = query.neq("playlist_id", ignore_playlist_id)
        response = query.limit(1).execute()
        rows = response.data or []
        if not rows:
            return candidate
        candidate = unique_slug(base_slug or "playlist")
        attempts += 1
        if attempts >= 8:
            return candidate


def _fetch_recipe_counts(supa: Client, playlist_ids: Iterable[str]) -> dict[str, int]:
    ids = [str(pid) for pid in playlist_ids if pid]
    if not ids:
        return {}
    response = (
        supa.table("playlist_recipes")
        .select("playlist_id")
        .in_("playlist_id", ids)
        .execute()
    )
    counts: dict[str, int] = {}
    for row in response.data or []:
        pid = stringify_id(row.get("playlist_id"))
        if not pid:
            continue
        counts[pid] = counts.get(pid, 0) + 1
    return counts


def _validate_recipe_access(supa: Client, owner_id: str, recipe_id: str) -> None:
    response = (
        supa.table("recipes")
        .select("recipe_id")
        .eq("owner_id", owner_id)
        .eq("recipe_id", recipe_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    if not rows:
        raise PlaylistNotFoundError("Receita não encontrada")
