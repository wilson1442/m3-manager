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
