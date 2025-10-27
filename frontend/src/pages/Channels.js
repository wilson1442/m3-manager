import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Hls from "hls.js";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Copy, Play, Radio, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Channels({ user, onLogout }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [probingChannels, setProbingChannels] = useState({});
  const [channelStatus, setChannelStatus] = useState({});
  const [playerOpen, setPlayerOpen] = useState(false);
  const [currentStream, setCurrentStream] = useState(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    return () => {
      // Cleanup HLS instance on unmount
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    if (playerOpen && currentStream && videoRef.current) {
      const video = videoRef.current;
      const streamUrl = currentStream.url;

      console.log("Loading stream:", streamUrl);

      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Reset video
      video.pause();
      video.removeAttribute('src');
      video.load();

      // Check if it's an HLS stream
      if (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u')) {
        if (Hls.isSupported()) {
          console.log("Using HLS.js for playback");
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
            debug: false,
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("Manifest parsed, starting playback");
            video.play().catch(err => {
              console.error("Playback failed:", err);
              toast.error("Failed to play stream. Stream may be offline or blocked by CORS.");
            });
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error("HLS Error:", data);
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log("Network error - trying to recover");
                  toast.error("Network error - stream may be offline");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log("Media error - trying to recover");
                  toast.error("Media error - trying to recover");
                  hls.recoverMediaError();
                  break;
                default:
                  toast.error("Cannot play stream: " + data.details);
                  hls.destroy();
                  break;
              }
            }
          });

          hlsRef.current = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // For Safari which has native HLS support
          console.log("Using native HLS support");
          video.src = streamUrl;
          video.addEventListener('loadedmetadata', () => {
            video.play().catch(err => {
              console.error("Playback failed:", err);
              toast.error("Failed to play stream");
            });
          });
        } else {
          toast.error("Your browser doesn't support HLS playback");
        }
      } else {
        // For non-HLS streams (mp4, etc)
        console.log("Using direct video playback");
        video.src = streamUrl;
        video.play().catch(err => {
          console.error("Playback failed:", err);
          toast.error("Failed to play stream. Stream may be offline.");
        });
      }
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [playerOpen, currentStream]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error("Please enter a search term");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/channels/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: searchQuery },
      });
      setChannels(response.data);
      if (response.data.length === 0) {
        toast.info("No channels found");
      }
    } catch (error) {
      toast.error("Failed to search channels");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Stream URL copied to clipboard!");
    } catch (error) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success("Stream URL copied to clipboard!");
      } catch (err) {
        toast.error("Failed to copy URL. Please copy manually.");
      }
      document.body.removeChild(textArea);
    }
  };

  const handleProbe = async (channel) => {
    setProbingChannels({ ...probingChannels, [channel.url]: true });
    
    try {
      const response = await axios.post(
        `${API}/channels/probe`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { url: channel.url },
        }
      );
      
      setChannelStatus({
        ...channelStatus,
        [channel.url]: response.data,
      });
      
      if (response.data.online) {
        toast.success(`${channel.name} is online!`);
      } else {
        toast.error(`${channel.name} is offline: ${response.data.error || "No response"}`);
      }
    } catch (error) {
      toast.error("Failed to probe stream");
    } finally {
      setProbingChannels({ ...probingChannels, [channel.url]: false });
    }
  };

  const handlePlay = (channel) => {
    setCurrentStream(channel);
    setPlayerOpen(true);
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="channels">
      <div className="space-y-6" data-testid="channels-page">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Channel Search</h1>
          <p className="text-base text-muted-foreground">Search and preview channels from your M3U playlists</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                data-testid="channel-search-input"
                placeholder="Search for channels (e.g., ESPN, CNN, BBC)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" data-testid="search-btn" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
            </form>
          </CardContent>
        </Card>

        {channels.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel, index) => (
              <Card key={index} data-testid={`channel-card-${index}`} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {channel.logo && (
                          <img src={channel.logo} alt={channel.name} className="w-8 h-8 rounded" onError={(e) => e.target.style.display = 'none'} />
                        )}
                        <span className="line-clamp-1">{channel.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {channel.group && <Badge variant="secondary" className="text-xs">{channel.group}</Badge>}
                      </CardDescription>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">From: {channel.playlist_name}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {channelStatus[channel.url] && (
                    <div className="flex items-center gap-2 text-sm">
                      <Radio className={`h-4 w-4 ${channelStatus[channel.url].online ? 'text-green-500' : 'text-red-500'}`} />
                      <span className={channelStatus[channel.url].online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {channelStatus[channel.url].online ? 'Online' : 'Offline'}
                      </span>
                      {channelStatus[channel.url].response_time && (
                        <span className="text-muted-foreground">
                          ({channelStatus[channel.url].response_time.toFixed(2)}s)
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button
                      data-testid={`copy-url-${index}`}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleCopyUrl(channel.url)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy URL
                    </Button>
                    <Button
                      data-testid={`probe-${index}`}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleProbe(channel)}
                      disabled={probingChannels[channel.url]}
                    >
                      {probingChannels[channel.url] ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Radio className="h-3 w-3 mr-1" />
                      )}
                      Probe
                    </Button>
                  </div>
                  
                  <Button
                    data-testid={`play-${index}`}
                    className="w-full"
                    onClick={() => handlePlay(channel)}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Play Stream
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Video Player Dialog */}
        <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{currentStream?.name}</DialogTitle>
              <DialogDescription>
                {currentStream?.group && <Badge variant="secondary">{currentStream.group}</Badge>}
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                data-testid="video-player"
                playsInline
                crossOrigin="anonymous"
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Stream URL:</strong> {currentStream?.url}</p>
              <p><strong>Playlist:</strong> {currentStream?.playlist_name}</p>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(currentStream?.url, '_blank')}
                  data-testid="open-in-new-tab"
                >
                  Open in New Tab
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(currentStream?.url);
                    toast.success("Stream URL copied!");
                  }}
                >
                  Copy URL
                </Button>
              </div>
              <p className="text-xs mt-2">
                <strong>Note:</strong> If the stream doesn't play in the browser, it may be:
              </p>
              <ul className="text-xs list-disc list-inside space-y-1">
                <li>Offline or unavailable</li>
                <li>Requires authentication</li>
                <li>Blocked by CORS policy</li>
                <li>Try opening in a new tab or use a dedicated IPTV player (VLC, Kodi, etc.)</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
