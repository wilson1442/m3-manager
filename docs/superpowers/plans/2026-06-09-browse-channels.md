# Browse Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Browse Channels page that lets users drill down through M3U playlist → Category → Channel, with copy/probe/select-export actions on channels.

**Architecture:** Two new read-only, tenant-scoped FastAPI endpoints expose per-playlist categories and per-category channels by reusing the existing `parse_m3u_content` parser and `Channel` model. The grouping/filtering logic is extracted into two pure helper functions (unit-tested with pytest). A new React page (`BrowseChannels.js`) renders three drill-down levels driven by local state with a breadcrumb, reusing the proven channel-card actions from `Channels.js`. No new DB collections or models.

**Tech Stack:** FastAPI + Motor (MongoDB), Pydantic; React (CRA/craco) + axios + Tailwind + shadcn/ui + sonner; pytest for backend unit tests.

---

## File Structure

- `backend/server.py` — **Modify.** Add two pure helpers (`group_channels_by_category`, `filter_channels_by_category`) after `parse_m3u_content`; add two endpoints (`GET /api/m3u/{playlist_id}/categories`, `GET /api/m3u/{playlist_id}/channels`) after the `probe-ffmpeg` route (line ~1371).
- `tests/test_browse_channels.py` — **Create.** Pytest unit tests for the two helpers.
- `backend_test.py` — **Modify.** Add an integration smoke method for the two endpoints + register it in the run sequence.
- `frontend/src/pages/BrowseChannels.js` — **Create.** The drill-down page (one focused component).
- `frontend/src/App.js` — **Modify.** Import the page and add the `/browse` route.
- `frontend/src/components/Layout.js` — **Modify.** Add the `Browse Channels` menu item (Compass icon) to the `tenant_owner` and `user` blocks.

---

## Task 1: Backend grouping/filter helpers (pure, unit-tested)

**Files:**
- Create: `tests/test_browse_channels.py`
- Modify: `backend/server.py` (insert after `parse_m3u_content`, which ends at line 128)

- [ ] **Step 1: Write the failing tests**

Create `tests/test_browse_channels.py`:

```python
import sys
from pathlib import Path

# Make backend/server.py importable. server.py calls load_dotenv on backend/.env
# at import time and uses a lazy Motor client, so no DB connection is required.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import server


def test_group_channels_by_category_counts_and_sorts():
    channels = [
        {"name": "ESPN", "group": "Sports", "url": "http://x/1"},
        {"name": "FOX", "group": "Sports", "url": "http://x/2"},
        {"name": "CNN", "group": "News", "url": "http://x/3"},
    ]
    result = server.group_channels_by_category(channels)
    assert result == [
        {"name": "News", "channel_count": 1},
        {"name": "Sports", "channel_count": 2},
    ]


def test_group_channels_by_category_uncategorized_bucket():
    channels = [
        {"name": "NoGroup1", "url": "http://x/1"},
        {"name": "NoGroup2", "group": "", "url": "http://x/2"},
        {"name": "ESPN", "group": "Sports", "url": "http://x/3"},
    ]
    result = server.group_channels_by_category(channels)
    assert {"name": "Uncategorized", "channel_count": 2} in result
    assert {"name": "Sports", "channel_count": 1} in result


def test_group_channels_by_category_empty():
    assert server.group_channels_by_category([]) == []


def test_filter_channels_by_category_matches_group():
    channels = [
        {"name": "ESPN", "group": "Sports", "url": "http://x/1"},
        {"name": "CNN", "group": "News", "url": "http://x/2"},
    ]
    result = server.filter_channels_by_category(channels, "Sports")
    assert [c["name"] for c in result] == ["ESPN"]


def test_filter_channels_by_category_uncategorized_returns_groupless():
    channels = [
        {"name": "NoGroup", "url": "http://x/1"},
        {"name": "Empty", "group": "", "url": "http://x/2"},
        {"name": "ESPN", "group": "Sports", "url": "http://x/3"},
    ]
    result = server.filter_channels_by_category(channels, "Uncategorized")
    assert [c["name"] for c in result] == ["NoGroup", "Empty"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `backend/venv/bin/python -m pytest tests/test_browse_channels.py -v`
Expected: FAIL — `AttributeError: module 'server' has no attribute 'group_channels_by_category'`

- [ ] **Step 3: Implement the helpers**

In `backend/server.py`, immediately after the `parse_m3u_content` function (after line 128, before `async def probe_stream`), insert:

```python
def group_channels_by_category(channels: List[dict]) -> List[dict]:
    """Group parsed channels by category and count them.

    Channels with no `group` (missing or empty) are bucketed under the literal
    name "Uncategorized". Returns a list of {"name": str, "channel_count": int}
    sorted by category name.
    """
    counts: dict = {}
    for channel in channels:
        category = channel.get('group') or "Uncategorized"
        counts[category] = counts.get(category, 0) + 1
    result = [{"name": name, "channel_count": count} for name, count in counts.items()]
    result.sort(key=lambda c: c['name'])
    return result


def filter_channels_by_category(channels: List[dict], category: str) -> List[dict]:
    """Return only the parsed channels belonging to one category.

    When `category == "Uncategorized"`, returns channels that have no group
    (missing or empty); otherwise returns channels whose `group` matches exactly.
    """
    if category == "Uncategorized":
        return [c for c in channels if not c.get('group')]
    return [c for c in channels if c.get('group') == category]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `backend/venv/bin/python -m pytest tests/test_browse_channels.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add backend/server.py tests/test_browse_channels.py
git commit -m "feat(backend): add channel grouping/filter helpers for browse"
```

---

## Task 2: Backend browse endpoints

**Files:**
- Modify: `backend/server.py` (insert after the `probe-ffmpeg` route, which ends at line ~1371, before `@api_router.get("/categories")`)
- Modify: `backend_test.py` (add integration method + register it)

- [ ] **Step 1: Add the two endpoints**

In `backend/server.py`, after the `probe_channel_ffmpeg` route (ends ~line 1371) and before `@api_router.get("/categories")`, insert:

```python
@api_router.get("/m3u/{playlist_id}/categories")
async def get_playlist_categories(playlist_id: str, current_user: User = Depends(get_current_user)):
    """List the categories in one playlist with channel counts (drill-down browse)."""
    playlist = await db.m3u_playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    # Super admin may browse any playlist; everyone else is tenant-scoped.
    if current_user.role != "super_admin" and playlist.get('tenant_id') != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only browse playlists in your tenant")

    channels = parse_m3u_content(playlist.get('content') or "")
    return group_channels_by_category(channels)


@api_router.get("/m3u/{playlist_id}/channels", response_model=List[Channel])
async def get_playlist_channels(
    playlist_id: str,
    category: str,
    current_user: User = Depends(get_current_user),
):
    """List the channels in one playlist that belong to one category (drill-down browse)."""
    playlist = await db.m3u_playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if current_user.role != "super_admin" and playlist.get('tenant_id') != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Can only browse playlists in your tenant")

    channels = parse_m3u_content(playlist.get('content') or "")
    matching = filter_channels_by_category(channels, category)
    return [
        Channel(
            name=c.get('name', 'Unknown'),
            url=c.get('url', ''),
            group=c.get('group'),
            logo=c.get('logo'),
            playlist_name=playlist['name'],
            playlist_id=playlist['id'],
        )
        for c in matching
    ]
```

- [ ] **Step 2: Add an integration smoke test to `backend_test.py`**

In `backend_test.py`, add this method to the `M3UManagerAPITester` class (place it right after `test_get_m3u_playlists_as_user`, near line ~280). It reuses the playlist created by `test_create_m3u_playlist` (content has one group-less channel → one `Uncategorized` category):

```python
    def test_browse_channels_endpoints(self):
        """Test drill-down browse endpoints: categories and channels for a playlist."""
        if 'playlist' not in self.test_data:
            print("❌ Skipping - No playlist available")
            return False
        playlist_id = self.test_data['playlist']['id']
        owner_token = self.tokens.get('tenant_owner')

        # Categories for the playlist (created content has one group-less channel)
        ok_cats, cats = self.run_test(
            "Browse: Playlist Categories",
            "GET",
            f"m3u/{playlist_id}/categories",
            200,
            token=owner_token,
            description="List categories with counts for a playlist",
        )
        if not ok_cats or not isinstance(cats, list):
            return False
        has_uncat = any(c.get('name') == 'Uncategorized' and c.get('channel_count', 0) >= 1 for c in cats)
        if not has_uncat:
            print(f"   ❌ Expected an 'Uncategorized' category, got: {cats}")
            return False

        # Channels for the Uncategorized category
        ok_chans, chans = self.run_test(
            "Browse: Playlist Channels",
            "GET",
            f"m3u/{playlist_id}/channels?category=Uncategorized",
            200,
            token=owner_token,
            description="List channels for a category in a playlist",
        )
        if not ok_chans or not isinstance(chans, list) or len(chans) < 1:
            print(f"   ❌ Expected at least one channel, got: {chans}")
            return False

        # Unknown playlist id -> 404
        ok_404, _ = self.run_test(
            "Browse: Unknown Playlist 404",
            "GET",
            "m3u/does-not-exist/categories",
            404,
            token=owner_token,
            description="Unknown playlist id returns 404",
        )
        return ok_404
```

- [ ] **Step 3: Register the integration test in the run sequence**

In `backend_test.py`, in the `test_sequence` list inside `main()`, add this line right after the `("Update Playlist", tester.test_update_m3u_playlist),` entry:

```python
        ("Browse Channels Endpoints", tester.test_browse_channels_endpoints),
```

- [ ] **Step 4: Verify the backend imports cleanly**

Run: `backend/venv/bin/python -c "import sys; sys.path.insert(0,'backend'); import server; print('routes ok')"`
Expected: prints `routes ok` with no exception (confirms the new routes have valid syntax/signatures).

> Note: `backend_test.py` runs against a live deployed server with seeded auth/tenant data and is not part of the local TDD loop. Run it manually against a running instance when validating end-to-end; do not block this task on it.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py backend_test.py
git commit -m "feat(backend): add browse endpoints for playlist categories and channels"
```

---

## Task 3: BrowseChannels page component

**Files:**
- Create: `frontend/src/pages/BrowseChannels.js`

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/BrowseChannels.js` with the full content below. Channel actions (copy/probe/select/export) are lifted from `Channels.js`; there is intentionally **no Play button**.

```jsx
import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronLeft,
  ListMusic,
  FolderTree,
  Radio,
  Copy,
  Image as ImageIcon,
  Loader2,
  Download,
} from "lucide-react";

const API = "/api";

export default function BrowseChannels({ user, onLogout, onRestoreAdmin }) {
  const token = localStorage.getItem("token");

  // Drill-down navigation state
  const [view, setView] = useState("playlists"); // 'playlists' | 'categories' | 'channels'
  const [playlists, setPlaylists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // { id, name }
  const [selectedCategory, setSelectedCategory] = useState(null); // string
  const [loading, setLoading] = useState(false);

  // Channel-level interactions (mirrors Channels.js)
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [probingChannels, setProbingChannels] = useState({});
  const [channelStatus, setChannelStatus] = useState({});

  // --- Level 1: playlists ---
  useEffect(() => {
    loadPlaylists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/m3u`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(res.data);
    } catch (error) {
      toast.error("Failed to load playlists");
    } finally {
      setLoading(false);
    }
  };

  // --- Level 2: categories for a playlist ---
  const openPlaylist = async (playlist) => {
    setSelectedPlaylist({ id: playlist.id, name: playlist.name });
    setLoading(true);
    try {
      const res = await axios.get(`${API}/m3u/${playlist.id}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data);
      setView("categories");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  // --- Level 3: channels for a category ---
  const openCategory = async (category) => {
    setSelectedCategory(category);
    setSelectedChannels([]);
    setChannelStatus({});
    setLoading(true);
    try {
      const res = await axios.get(`${API}/m3u/${selectedPlaylist.id}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category },
      });
      setChannels(res.data);
      setView("channels");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load channels");
    } finally {
      setLoading(false);
    }
  };

  // --- Navigation ---
  const goToPlaylists = () => {
    setView("playlists");
    setSelectedPlaylist(null);
    setSelectedCategory(null);
  };

  const goToCategories = () => {
    setView("categories");
    setSelectedCategory(null);
  };

  // --- Channel actions (lifted from Channels.js) ---
  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Stream URL copied!");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleCopyLogo = async (logoUrl) => {
    try {
      await navigator.clipboard.writeText(logoUrl);
      toast.success("Logo URL copied!");
    } catch {
      toast.error("Failed to copy logo URL");
    }
  };

  const handleProbe = async (channel) => {
    setProbingChannels((p) => ({ ...p, [channel.url]: true }));
    try {
      const res = await axios.post(`${API}/channels/probe-ffmpeg`, null, {
        headers: { Authorization: `Bearer ${token}` },
        params: { url: channel.url },
      });
      setChannelStatus((s) => ({
        ...s,
        [channel.url]: {
          online: res.data.online,
          status: res.data.status,
          error: res.data.error,
        },
      }));
      if (res.data.online) {
        toast.success(`${channel.name} is online!`);
      } else {
        toast.error(
          `${channel.name} is ${res.data.status}: ${res.data.error || "No response"}`
        );
      }
    } catch {
      toast.error("Failed to probe stream");
    } finally {
      setProbingChannels((p) => ({ ...p, [channel.url]: false }));
    }
  };

  const toggleSelectChannel = (channel) => {
    setSelectedChannels((prev) =>
      prev.some((c) => c.url === channel.url)
        ? prev.filter((c) => c.url !== channel.url)
        : [...prev, channel]
    );
  };

  const handleSelectAll = () => {
    setSelectedChannels((prev) =>
      prev.length === channels.length ? [] : [...channels]
    );
  };

  const handleExportM3U = () => {
    if (selectedChannels.length === 0) {
      toast.error("Please select at least one channel");
      return;
    }
    let m3uContent = "#EXTM3U\n";
    selectedChannels.forEach((channel) => {
      m3uContent += `#EXTINF:-1 tvg-id="${channel.name}" tvg-name="${channel.name}" tvg-logo="${channel.logo || ""}" group-title="${channel.group || ""}",${channel.name}\n`;
      m3uContent += `${channel.url}\n`;
    });
    const blob = new Blob([m3uContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `browse-export-${selectedPlaylist?.name || "channels"}.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedChannels.length} channels`);
  };

  return (
    <Layout user={user} onLogout={onLogout} onRestoreAdmin={onRestoreAdmin} currentPage="browse">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Browse Channels</h1>
          <p className="text-base text-muted-foreground">
            Browse your playlists by category and channel
          </p>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
          <button onClick={goToPlaylists} className="hover:text-foreground transition-colors">
            Browse Channels
          </button>
          {selectedPlaylist && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <button
                onClick={goToCategories}
                className={`hover:text-foreground transition-colors ${
                  view === "categories" ? "text-foreground font-medium" : ""
                }`}
              >
                {selectedPlaylist.name}
              </button>
            </>
          )}
          {selectedCategory && (
            <>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{selectedCategory}</span>
            </>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Level 1: Playlists */}
        {!loading &&
          view === "playlists" &&
          (playlists.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ListMusic className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No playlists found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl) => (
                <Card
                  key={pl.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => openPlaylist(pl)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <ListMusic className="h-5 w-5 shrink-0 text-primary" />
                        <span className="truncate">{pl.name}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          ))}

        {/* Level 2: Categories */}
        {!loading && view === "categories" && (
          <>
            <Button variant="outline" size="sm" onClick={goToPlaylists} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            {categories.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No categories in this playlist</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <Card
                    key={cat.name}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openCategory(cat.name)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 min-w-0">
                          <FolderTree className="h-5 w-5 shrink-0 text-primary" />
                          <span className="truncate">{cat.name}</span>
                        </span>
                        <Badge variant="secondary">{cat.channel_count}</Badge>
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Level 3: Channels */}
        {!loading && view === "channels" && (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" onClick={goToCategories} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
              {channels.length > 0 && (
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedChannels.length === channels.length ? "Deselect All" : "Select All"}
                  </Button>
                  <Button size="sm" onClick={handleExportM3U} disabled={selectedChannels.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    Export ({selectedChannels.length})
                  </Button>
                </div>
              )}
            </div>

            {channels.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No channels in this category</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {channels.map((channel, index) => (
                  <Card key={`${channel.url}-${index}`} className="overflow-hidden">
                    <div className="relative aspect-video bg-muted flex items-center justify-center">
                      {channel.logo ? (
                        <img
                          src={channel.logo}
                          alt={channel.name}
                          className="max-w-[120px] max-h-[80px] object-contain p-2"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.parentElement.innerHTML =
                              '<div class="flex items-center justify-center w-full h-full"><span class="text-4xl text-muted-foreground">📺</span></div>';
                          }}
                        />
                      ) : (
                        <span className="text-4xl text-muted-foreground">📺</span>
                      )}
                      <div className="absolute top-2 left-2">
                        <Checkbox
                          checked={selectedChannels.some((c) => c.url === channel.url)}
                          onCheckedChange={() => toggleSelectChannel(channel)}
                        />
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-1">{channel.name}</h3>
                        <p className="text-xs font-mono text-muted-foreground mt-1 break-all line-clamp-2">
                          {channel.url}
                        </p>
                      </div>

                      {channelStatus[channel.url] && (
                        <div className="flex items-center gap-1 text-xs">
                          <Radio
                            className={`h-3 w-3 ${
                              channelStatus[channel.url].online ? "text-[#7BC47F]" : "text-destructive"
                            }`}
                          />
                          <span
                            className={
                              channelStatus[channel.url].online
                                ? "text-[#7BC47F] font-medium"
                                : "text-destructive font-medium"
                            }
                          >
                            {channelStatus[channel.url].online
                              ? "Online"
                              : channelStatus[channel.url].status}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyUrl(channel.url)}
                          className="text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" /> URL
                        </Button>
                        {channel.logo && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLogo(channel.logo)}
                            className="text-xs"
                          >
                            <ImageIcon className="h-3 w-3 mr-1" /> Logo
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProbe(channel)}
                          disabled={probingChannels[channel.url]}
                          className="text-xs"
                        >
                          {probingChannels[channel.url] ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Radio className="h-3 w-3 mr-1" />
                          )}
                          Probe
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/BrowseChannels.js
git commit -m "feat(frontend): add BrowseChannels drill-down page"
```

---

## Task 4: Wire route and menu item

**Files:**
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/Layout.js`

- [ ] **Step 1: Add the import and route in `App.js`**

In `frontend/src/App.js`, add the import next to the other page imports (after the `Channels` import on line 12):

```jsx
import BrowseChannels from "@/pages/BrowseChannels";
```

Then add this route inside `<Routes>`, immediately after the `/channels` route block (which ends at line ~190, before the `/categories` route):

```jsx
          <Route
            path="/browse"
            element={
              isAuthenticated ? (
                <BrowseChannels user={user} onLogout={handleLogout} onRestoreAdmin={handleRestoreAdmin} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
```

- [ ] **Step 2: Add the `Compass` icon import in `Layout.js`**

In `frontend/src/components/Layout.js`, add `Compass` to the `lucide-react` import block (lines 3-17), e.g. after `Search,`:

```jsx
  Compass,
```

- [ ] **Step 3: Add the menu item to the `tenant_owner` and `user` blocks**

In `frontend/src/components/Layout.js`, in the `tenant_owner` block, add the Browse item right after the `Search Channels` line (line 47):

```jsx
      { name: "Browse Channels", icon: Compass, path: "/browse", key: "browse", roles: ["tenant_owner"] },
```

In the `user` block, add it right after the `Search Channels` line (line 56):

```jsx
      { name: "Browse Channels", icon: Compass, path: "/browse", key: "browse", roles: ["user"] },
```

- [ ] **Step 4: Verify the frontend compiles**

Run: `cd frontend && CI=false npx craco build`
Expected: `Compiled` (a successful production build with no errors; warnings are acceptable). This confirms the new page, route, and imports are wired correctly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.js frontend/src/components/Layout.js
git commit -m "feat(frontend): add Browse Channels route and menu item"
```

---

## Task 5: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the app and sign in**

Start backend + frontend per `QUICKSTART.md`. Sign in as a `tenant_owner` (and separately as a `user`) that has at least one M3U playlist with channels.

- [ ] **Step 2: Walk the drill-down**

Verify:
- "Browse Channels" appears in the sidebar for both `tenant_owner` and `user` (and is absent for `super_admin`).
- Level 1 lists playlists; clicking one shows its categories with channel-count badges.
- Clicking a category shows the channel grid; the breadcrumb reads `Browse Channels › <playlist> › <category>`.
- Breadcrumb links and the Back buttons return to the correct prior level.

- [ ] **Step 3: Exercise channel actions**

- Copy URL / Copy Logo show success toasts.
- Probe updates the channel's online/offline status.
- Select a few channels, click Export — a `.m3u` file downloads containing the selected channels.
- Confirm there is **no Play button** (per design).

- [ ] **Step 4: Confirm empty/error states**

- A playlist with no channels shows "No categories in this playlist".
- A category endpoint failure (e.g., stop backend) surfaces a toast and keeps the user on the prior level.

---

## Self-Review Notes

- **Spec coverage:** playlists/categories/channels endpoints (Tasks 1–2), `/browse` route + menu for tenant_owner/user (Task 4), drill-down + breadcrumb + back (Task 3), Copy/Probe/Select-Export with no Play (Task 3), Uncategorized bucketing (Tasks 1–2), counts from level 2 onward (Task 3 — level 1 cards show no count), error/empty states (Tasks 3, 5), backend tests (Tasks 1–2). All covered.
- **Type consistency:** helper names `group_channels_by_category` / `filter_channels_by_category` are identical across Tasks 1–2; the `channels` endpoint returns the existing `Channel` model; frontend reads `cat.name` / `cat.channel_count` matching the categories endpoint's `{"name", "channel_count"}` shape.
