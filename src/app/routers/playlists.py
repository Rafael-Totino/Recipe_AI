# src/app/routers/playlists.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from supabase import Client

from src.app.deps import CurrentUser, get_current_user, get_supabase
from src.app.routers.ingest import _recipe_from_record
from src.app.schemas.playlists import (
    PlaylistAppendRequest,
    PlaylistCreate,
    PlaylistDetail,
    PlaylistItem,
    PlaylistSummary,
    PlaylistUpdate,
)
from src.services import playlists as playlist_service

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("/", response_model=list[PlaylistSummary])
async def list_playlists(
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> list[PlaylistSummary]:
    owner_id = str(user.id)
    system_payloads = playlist_service.list_system_playlists(supa, owner_id)
    custom_payloads = playlist_service.list_custom_playlists(supa, owner_id)
    combined = [*system_payloads, *custom_payloads]
    return [PlaylistSummary(**payload) for payload in combined]


@router.post("/", response_model=PlaylistSummary, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    payload: PlaylistCreate,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> PlaylistSummary:
    owner_id = str(user.id)
    try:
        summary = playlist_service.create_playlist(
            supa,
            owner_id,
            name=payload.name,
            description=payload.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - retorno de erro genérico
        raise HTTPException(status_code=500, detail=str(exc))
    return PlaylistSummary(**summary)


@router.patch("/{playlist_id}", response_model=PlaylistSummary)
async def update_playlist(
    playlist_id: str,
    payload: PlaylistUpdate,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> PlaylistSummary:
    owner_id = str(user.id)
    changes = payload.model_dump(exclude_unset=True)
    try:
        summary = playlist_service.update_playlist(supa, owner_id, playlist_id, changes)
    except playlist_service.PlaylistNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except playlist_service.PlaylistPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return PlaylistSummary(**summary)


@router.delete("/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_playlist(
    playlist_id: str,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> Response:
    owner_id = str(user.id)
    try:
        playlist_service.delete_playlist(supa, owner_id, playlist_id)
    except playlist_service.PlaylistNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except playlist_service.PlaylistPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{playlist_id}/recipes", response_model=PlaylistDetail)
async def get_playlist_recipes(
    playlist_id: str,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> PlaylistDetail:
    owner_id = str(user.id)
    if playlist_id in playlist_service.SYSTEM_PLAYLIST_IDS:
        meta = playlist_service.system_playlist_metadata(playlist_id)
        recipe_rows = playlist_service.fetch_system_playlist_recipes(
            supa, owner_id, playlist_id
        )
        recipes = [_recipe_from_record(row) for row in recipe_rows]
        items = [
            PlaylistItem(
                recipeId=recipe.id,
                recipe=recipe,
                addedAt=recipe.createdAt,
                position=index + 1,
            )
            for index, recipe in enumerate(recipes)
        ]
        return PlaylistDetail(
            id=playlist_id,
            name=meta["name"],
            slug=meta["slug"],
            type="system",
            description=None,
            recipeCount=len(items),
            createdAt=None,
            updatedAt=None,
            items=items,
        )
    try:
        bundle = playlist_service.fetch_custom_playlist_bundle(
            supa, owner_id, playlist_id
        )
    except playlist_service.PlaylistPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except playlist_service.PlaylistNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    recipe_map = {
        playlist_service.stringify_id(row.get("recipe_id")): _recipe_from_record(row)
        for row in bundle["recipes"]
    }
    items: list[PlaylistItem] = []
    for item in bundle["items"]:
        recipe = recipe_map.get(item["recipeId"])
        if not recipe:
            continue
        items.append(
            PlaylistItem(
                recipeId=item["recipeId"],
                recipe=recipe,
                addedAt=item["addedAt"],
                position=item["position"],
            )
        )
    detail_payload = playlist_service.serialize_playlist(
        bundle["playlist"], len(items)
    )
    detail_payload["items"] = items
    return PlaylistDetail(**detail_payload)


@router.post(
    "/{playlist_id}/recipes",
    response_model=PlaylistItem,
    status_code=status.HTTP_201_CREATED,
)
async def add_recipe_to_playlist(
    playlist_id: str,
    payload: PlaylistAppendRequest,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> PlaylistItem:
    owner_id = str(user.id)
    if playlist_id in playlist_service.SYSTEM_PLAYLIST_IDS:
        raise HTTPException(
            status_code=403, detail="Playlists do sistema não aceitam modificações."
        )
    try:
        item_data = playlist_service.add_recipe_to_playlist(
            supa, owner_id, playlist_id, payload.recipeId
        )
    except playlist_service.PlaylistPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except playlist_service.PlaylistNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except playlist_service.PlaylistConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    recipe_rows = playlist_service.fetch_recipes_by_ids(
        supa, owner_id, [item_data["recipeId"]]
    )
    if not recipe_rows:
        raise HTTPException(status_code=404, detail="Receita não encontrada")
    recipe = _recipe_from_record(recipe_rows[0])
    return PlaylistItem(
        recipeId=item_data["recipeId"],
        recipe=recipe,
        addedAt=item_data["addedAt"],
        position=item_data["position"],
    )


@router.delete(
    "/{playlist_id}/recipes/{recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_recipe_from_playlist(
    playlist_id: str,
    recipe_id: str,
    user: CurrentUser = Depends(get_current_user),
    supa: Client = Depends(get_supabase),
) -> Response:
    owner_id = str(user.id)
    if playlist_id in playlist_service.SYSTEM_PLAYLIST_IDS:
        raise HTTPException(
            status_code=403, detail="Playlists do sistema não aceitam modificações."
        )
    try:
        playlist_service.remove_recipe_from_playlist(
            supa, owner_id, playlist_id, recipe_id
        )
    except playlist_service.PlaylistPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    except playlist_service.PlaylistNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
