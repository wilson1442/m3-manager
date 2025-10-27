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
import { Search, Copy, Play, Radio, Loader2, Download } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Channels({ user, onLogout }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [probingChannels, setProbingChannels] = useState({});
  const [channelStatus, setChannelStatus] = useState({});
  const [ffmpegProbeData, setFfmpegProbeData] = useState({});
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [currentDetails, setCurrentDetails] = useState(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [currentStream, setCurrentStream] = useState(null);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [playerError, setPlayerError] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
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
      setPlayerError(null);
      setPlayerReady(false);

      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Reset video element completely
      video.pause();
      video.removeAttribute('src');
      video.load();
      
      // Remove any existing source elements
      while (video.firstChild) {
        video.removeChild(video.firstChild);
      }

      // Check if it's an HLS stream
      if (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u')) {
        if (Hls.isSupported()) {
          console.log("Using HLS.js for playback");
          
          const hls = new Hls({
            debug: false, // Disable debug in production
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,
            nudgeOffset: 0.1,
            nudgeMaxRetry: 3,
            maxFragLookUpTolerance: 0.25,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: Infinity,
            liveDurationInfinity: false,
            liveBackBufferLength: Infinity,
            maxLiveSyncPlaybackRate: 1,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 1,
            manifestLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 10000,
            levelLoadingMaxRetry: 4,
            levelLoadingRetryDelay: 1000,
            fragLoadingTimeOut: 20000,
            fragLoadingMaxRetry: 6,
            fragLoadingRetryDelay: 1000,
            startFragPrefetch: false,
            testBandwidth: true,
            progressive: false,
            lowLatencyMode: false,
            fpsDroppedMonitoringPeriod: 5000,
            fpsDroppedMonitoringThreshold: 0.2,
            appendErrorMaxRetry: 3,
            xhrSetup: function(xhr, url) {
              xhr.withCredentials = false;
              xhr.timeout = 10000;
            }
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
            console.log("✅ Manifest parsed successfully");
            console.log("Available levels:", data.levels);
            setPlayerReady(true);
            toast.success("Stream loaded successfully!");
            
            // Try to play with a slight delay
            setTimeout(() => {
              video.play()
                .then(() => {
                  console.log("✅ Playback started successfully");
                })
                .catch(err => {
                  console.warn("Autoplay prevented:", err);
                  toast.info("Click the play button to start playback");
                });
            }, 100);
          });

          hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            console.log("✅ Level loaded:", data.details);
          });

          hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
            console.log("✅ Fragment loaded");
          });

          hls.on(Hls.Events.MEDIA_ATTACHED, () => {
            console.log("✅ Media attached to video element");
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error("❌ HLS Error:", data);
            
            if (data.fatal) {
              const errorMessage = data.details || "Unknown error";
              setPlayerError(`Stream error: ${errorMessage}`);
              
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.log("🔄 Fatal network error, trying to recover...");
                  toast.error("Network error - attempting recovery...");
                  setTimeout(() => {
                    hls.startLoad();
                  }, 1000);
                  break;
                  
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.log("🔄 Fatal media error, trying to recover...");
                  toast.error("Media error - recovering...");
                  hls.recoverMediaError();
                  break;
                  
                default:
                  console.log("💀 Fatal error, cannot recover");
                  toast.error(`Cannot play stream: ${errorMessage}`);
                  hls.destroy();
                  break;
              }
            } else {
              console.log("⚠️ Non-fatal error:", data.details);
            }
          });

          hlsRef.current = hls;
          
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // For Safari which has native HLS support
          console.log("Using native HLS support (Safari)");
          video.src = streamUrl;
          
          video.addEventListener('loadedmetadata', () => {
            console.log("✅ Metadata loaded (Safari)");
            setPlayerReady(true);
            video.play().catch(err => {
              console.warn("Autoplay prevented:", err);
              toast.info("Click the play button to start playback");
            });
          });
          
          video.addEventListener('error', (e) => {
            console.error("❌ Video error (Safari):", e);
            setPlayerError("Failed to load stream");
            toast.error("Failed to load stream");
          });
          
        } else {
          setPlayerError("Browser doesn't support HLS playback");
          toast.error("Your browser doesn't support HLS playback. Try Chrome, Firefox, or Safari.");
        }
      } else {
        // For non-HLS streams (mp4, etc)
        console.log("Using direct video playback");
        video.src = streamUrl;
        
        video.addEventListener('loadedmetadata', () => {
          console.log("✅ Metadata loaded");
          setPlayerReady(true);
        });
        
        video.addEventListener('error', (e) => {
          console.error("❌ Video error:", e);
          setPlayerError("Failed to load stream");
          toast.error("Failed to load stream");
        });
        
        video.play().catch(err => {
          console.warn("Autoplay prevented:", err);
          toast.info("Click the play button to start playback");
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
      // Use FFmpeg probe for detailed information
      const response = await axios.post(
        `${API}/channels/probe-ffmpeg`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { url: channel.url },
        }
      );
      
      setFfmpegProbeData({
        ...ffmpegProbeData,
        [channel.url]: response.data,
      });
      
      // Also update channel status for inline display
      setChannelStatus({
        ...channelStatus,
        [channel.url]: {
          online: response.data.online,
          status: response.data.status,
          error: response.data.error,
        },
      });
      
      if (response.data.online) {
        toast.success(`${channel.name} is online!`);
      } else {
        toast.error(`${channel.name} is ${response.data.status}: ${response.data.error || "No response"}`);
      }
    } catch (error) {
      toast.error("Failed to probe stream");
    } finally {
      setProbingChannels({ ...probingChannels, [channel.url]: false });
    }
  };

  const showDetails = (channel) => {
    const probeData = ffmpegProbeData[channel.url];
    if (probeData) {
      setCurrentDetails({ channel, probeData });
      setDetailsDialogOpen(true);
    } else {
      toast.error("Please probe the stream first to see details");
    }
  };

  const handlePlay = (channel) => {
    setCurrentStream(channel);
    setPlayerOpen(true);
  };

  const handleSelectChannel = (channel) => {
    const isSelected = selectedChannels.some(c => c.url === channel.url);
    if (isSelected) {
      setSelectedChannels(selectedChannels.filter(c => c.url !== channel.url));
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const handleSelectAll = () => {
    if (selectedChannels.length === channels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels([...channels]);
    }
  };

  const handleExportM3U = () => {
    if (selectedChannels.length === 0) {
      toast.error("No channels selected");
      return;
    }

    // Generate M3U content
    let m3uContent = '#EXTM3U\n';
    
    selectedChannels.forEach(channel => {
      const tvgLogo = channel.logo ? ` tvg-logo="${channel.logo}"` : '';
      const groupTitle = channel.group ? ` group-title="${channel.group}"` : '';
      m3uContent += `#EXTINF:-1${tvgLogo}${groupTitle},${channel.name}\n`;
      m3uContent += `${channel.url}\n`;
    });

    // Create blob and download
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exported_channels_${Date.now()}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success(`Exported ${selectedChannels.length} channels to M3U file`);
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
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    data-testid="select-all-btn"
                  >
                    {selectedChannels.length === channels.length ? "Deselect All" : "Select All"}
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {selectedChannels.length} of {channels.length} selected
                  </span>
                </div>
                <Button
                  onClick={handleExportM3U}
                  disabled={selectedChannels.length === 0}
                  data-testid="export-m3u-btn"
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export to M3U
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel, index) => (
              <Card key={index} data-testid={`channel-card-${index}`} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      <Checkbox
                        checked={selectedChannels.some(c => c.url === channel.url)}
                        onCheckedChange={() => handleSelectChannel(channel)}
                        data-testid={`checkbox-${index}`}
                        className="mt-1"
                      />
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">From: {channel.playlist_name}</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {channelStatus[channel.url] && (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Radio className={`h-4 w-4 ${channelStatus[channel.url].online ? 'text-green-500' : 'text-red-500'}`} />
                        <span className={channelStatus[channel.url].online ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {channelStatus[channel.url].online ? 'Online' : channelStatus[channel.url].status || 'Offline'}
                        </span>
                      </div>
                      
                      {/* FFmpeg probe data inline display */}
                      {ffmpegProbeData[channel.url] && ffmpegProbeData[channel.url].online && (
                        <div className="text-xs space-y-1 text-muted-foreground bg-muted/50 p-3 rounded-md">
                          {ffmpegProbeData[channel.url].format && (
                            <div className="flex gap-2">
                              <span className="font-medium min-w-[80px]">Format:</span>
                              <span>{ffmpegProbeData[channel.url].format}</span>
                            </div>
                          )}
                          {ffmpegProbeData[channel.url].video_resolution && (
                            <div className="flex gap-2">
                              <span className="font-medium min-w-[80px]">Resolution:</span>
                              <span className="font-mono">{ffmpegProbeData[channel.url].video_resolution}</span>
                            </div>
                          )}
                          {ffmpegProbeData[channel.url].bitrate && (
                            <div className="flex gap-2">
                              <span className="font-medium min-w-[80px]">Bitrate:</span>
                              <span className="font-mono">{ffmpegProbeData[channel.url].bitrate}</span>
                            </div>
                          )}
                          {ffmpegProbeData[channel.url].video_codec && (
                            <div className="flex gap-2">
                              <span className="font-medium min-w-[80px]">Video:</span>
                              <span className="font-mono text-xs">{ffmpegProbeData[channel.url].video_codec.substring(0, 30)}</span>
                            </div>
                          )}
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs"
                            onClick={() => showDetails(channel)}
                          >
                            View Full Details →
                          </Button>
                        </div>
                      )}
                      
                      {channelStatus[channel.url].error && (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          {channelStatus[channel.url].error}
                        </div>
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
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(currentStream?.url);
                      toast.success("Stream URL copied!");
                    } catch (error) {
                      // Fallback for browsers that don't support clipboard API
                      const textArea = document.createElement("textarea");
                      textArea.value = currentStream?.url;
                      textArea.style.position = "fixed";
                      textArea.style.left = "-999999px";
                      document.body.appendChild(textArea);
                      textArea.select();
                      try {
                        document.execCommand('copy');
                        toast.success("Stream URL copied!");
                      } catch (err) {
                        toast.error("Failed to copy URL");
                      }
                      document.body.removeChild(textArea);
                    }
                  }}
                  data-testid="copy-url-in-player"
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

        {/* FFmpeg Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Stream Details - {currentDetails?.channel?.name}</DialogTitle>
              <DialogDescription>
                Detailed technical information from FFmpeg probe
              </DialogDescription>
            </DialogHeader>
            {currentDetails?.probeData && (
              <div className="space-y-4">
                {/* Status */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Status</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Online:</span>
                      <span className={`ml-2 font-semibold ${currentDetails.probeData.online ? 'text-green-600' : 'text-red-600'}`}>
                        {currentDetails.probeData.online ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-2">{currentDetails.probeData.status}</span>
                    </div>
                  </div>
                </div>

                {/* Format Information */}
                {currentDetails.probeData.online && (
                  <>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Format Information</h3>
                      <div className="space-y-2 text-sm">
                        {currentDetails.probeData.format && (
                          <div>
                            <span className="text-muted-foreground font-medium">Format:</span>
                            <span className="ml-2">{currentDetails.probeData.format}</span>
                          </div>
                        )}
                        {currentDetails.probeData.duration && (
                          <div>
                            <span className="text-muted-foreground font-medium">Duration:</span>
                            <span className="ml-2">{currentDetails.probeData.duration}</span>
                          </div>
                        )}
                        {currentDetails.probeData.bitrate && (
                          <div>
                            <span className="text-muted-foreground font-medium">Bitrate:</span>
                            <span className="ml-2 font-mono">{currentDetails.probeData.bitrate}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Video Information */}
                    {currentDetails.probeData.video_codec && (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="font-semibold mb-2">Video Stream</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground font-medium">Codec:</span>
                            <span className="ml-2 font-mono text-xs">{currentDetails.probeData.video_codec}</span>
                          </div>
                          {currentDetails.probeData.video_resolution && (
                            <div>
                              <span className="text-muted-foreground font-medium">Resolution:</span>
                              <span className="ml-2 font-mono">{currentDetails.probeData.video_resolution}</span>
                            </div>
                          )}
                          {currentDetails.probeData.video_fps && (
                            <div>
                              <span className="text-muted-foreground font-medium">Frame Rate:</span>
                              <span className="ml-2 font-mono">{currentDetails.probeData.video_fps}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Audio Information */}
                    {currentDetails.probeData.audio_codec && (
                      <div className="bg-muted/50 p-4 rounded-lg">
                        <h3 className="font-semibold mb-2">Audio Stream</h3>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground font-medium">Codec:</span>
                            <span className="ml-2 font-mono text-xs">{currentDetails.probeData.audio_codec}</span>
                          </div>
                          {currentDetails.probeData.audio_sample_rate && (
                            <div>
                              <span className="text-muted-foreground font-medium">Sample Rate:</span>
                              <span className="ml-2 font-mono">{currentDetails.probeData.audio_sample_rate}</span>
                            </div>
                          )}
                          {currentDetails.probeData.audio_channels && (
                            <div>
                              <span className="text-muted-foreground font-medium">Channels:</span>
                              <span className="ml-2">{currentDetails.probeData.audio_channels}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stream URL */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Stream URL</h3>
                      <p className="text-xs font-mono break-all">{currentDetails.probeData.url}</p>
                    </div>
                  </>
                )}

                {/* Error Information */}
                {currentDetails.probeData.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                    <h3 className="font-semibold text-red-600 dark:text-red-400 mb-2">Error</h3>
                    <p className="text-sm text-red-600 dark:text-red-400">{currentDetails.probeData.error}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
