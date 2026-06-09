# Browse Channels — Design Spec

**Date:** 2026-06-09
**Status:** Approved (pending implementation plan)
**Author:** Nicholas Golia (with Claude)

## Summary

Add a **Browse Channels** menu item and page that lets users navigate their M3U
content as a drill-down hierarchy: **M3U playlist → Category → Channel**. This
complements the existing query-based **Search Channels** page with a browsable,
no-search-required experience.

## Goals

- Browse channels by walking the natural hierarchy instead of typing a query.
- Reuse existing auth, tenant-scoping, M3U parsing, and channel-card patterns.
- Keep it read-only — no new DB collections or models.

## Non-Goals

- No Play button on the browse page (explicitly deselected; trivial to add
  later since the popup player wiring already exists in `Channels.js`).
- No changes to the existing Search Channels page.
- No new persistence (monitoring, favorites, etc.).

## User Roles

Visible to the same roles as **Search Channels**: `tenant_owner` and `user`.
(`super_admin` does not get the item, matching the current Search Channels
visibility in `Layout.js`.)

## Architecture

A single new read-only page with three internal drill levels, fed by:

- **Level 1 (playlists):** existing `GET /api/m3u`.
- **Level 2 (categories):** new `GET /api/m3u/{playlist_id}/categories`.
- **Level 3 (channels):** new `GET /api/m3u/{playlist_id}/channels?category=<group>`.

Server-side M3U parsing (`parse_m3u_content`) is reused so the raw playlist text
is never shipped to the client and grouping logic stays consistent with the rest
of the app.

## Backend

Two new endpoints in `backend/server.py`, both pure reads, both tenant-scoped
using the same pattern as existing `/m3u` routes (super_admin sees any playlist;
others restricted to their `tenant_id`).

### `GET /api/m3u/{playlist_id}/categories`

Returns the categories present in one playlist with channel counts.

- Load playlist by `id`; `404` if not found.
- If `current_user.role != "super_admin"` and `playlist.tenant_id !=
  current_user.tenant_id` → `403`.
- Parse content with `parse_m3u_content`, group channels by `group`.
- Channels with no `group` bucket under the literal name `"Uncategorized"`.
- Response: `[{ "name": str, "channel_count": int }]`, sorted by `name`.

### `GET /api/m3u/{playlist_id}/channels?category=<group>`

Returns the channels in one playlist that belong to one category.

- Same load + tenant guard (404 / 403) as above.
- `category` is a required query param.
- Parse content; return channels whose `group == category`. When `category ==
  "Uncategorized"`, return channels that have no `group`.
- Each item is the existing `Channel` model, so `name/url/group/logo/
  playlist_name/playlist_id` are populated for the card actions.
- Response: `List[Channel]`.

No new Pydantic models are required for the channels endpoint (reuses `Channel`).
The categories endpoint returns a plain list of dicts (consistent with the
existing `GET /api/categories`, which also returns plain dicts).

## Frontend

### Routing & Menu

- New page: `frontend/src/pages/BrowseChannels.js`.
- New route `/browse` in `frontend/src/App.js`, wrapped in the same
  `isAuthenticated` guard as sibling routes, passing
  `user / onLogout / onRestoreAdmin`.
- `frontend/src/components/Layout.js`: add
  `{ name: "Browse Channels", icon: Compass, path: "/browse",
  key: "browse", roles: [...] }` to **both** the `tenant_owner` and `user`
  menu blocks (`Compass` from `lucide-react`; `FolderTree` is already used by
  the Categories item, so a distinct icon avoids confusion).
  Page renders `<Layout ... currentPage="browse">`.

### Page Structure

One page, local state drives which level is shown:

- `view`: `'playlists' | 'categories' | 'channels'`
- `selectedPlaylist`: `{ id, name }`
- `selectedCategory`: `string`

A **breadcrumb** (`Browse Channels › <playlist> › <category>`) plus a **Back**
button move between levels. No URL params — a refresh resets to level 1
(acceptable for v1).

**Playlists view:** cards from `GET /api/m3u` showing playlist name. Per the
design decision, channel/category **counts are shown from level 2 onward**, not
on level 1, to keep level 1 fast for large playlists.

**Categories view:** cards from the categories endpoint, each showing the
category `name` and a `channel_count` badge. Clicking drills to channels.

**Channels view:** reuse the existing channel-card grid from `Channels.js`:

- Copy URL, Copy Logo
- Probe (FFmpeg) via existing `POST /api/channels/probe-ffmpeg`
- Multi-select + **Export M3U** (client-side blob build, same code as Search)
- **No Play button.**

The probe / export / copy logic is lifted from `Channels.js`. Shared card markup
is either extracted into a small reusable piece or copied; the implementation
plan will decide based on how cleanly it factors out.

## Data Flow

```
GET /api/m3u
  -> user picks a playlist
GET /api/m3u/{id}/categories
  -> user picks a category
GET /api/m3u/{id}/channels?category=<group>
  -> card actions:
       Probe  -> POST /api/channels/probe-ffmpeg
       Export -> client-side .m3u blob download
```

## Error Handling

- Each level has its own `loading` flag and shows a toast on request failure
  (mirrors `Channels.js`).
- Empty states: "No categories in this playlist", "No channels in this
  category".
- Backend `403`/`404` surface as a toast; the page stays at the prior level
  rather than advancing.

## Testing

- **Backend** (`backend_test.py`): cover the two new endpoints —
  - tenant isolation (cross-tenant access → `403`)
  - unknown `playlist_id` → `404`
  - correct grouping including the `Uncategorized` bucket
  - `?category=` filter returns only matching channels
- **Frontend:** manual drill-down verification (playlists → categories →
  channels → probe → multi-select → export). Repo has no JS test harness.

## Open Items / Future

- Optional Play button (popup player) — trivial follow-up.
- Optional level-1 counts if performance allows.
