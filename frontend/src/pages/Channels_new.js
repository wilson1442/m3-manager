import { useState, useEffect, useRef } from "react";
import axios from "axios";
import Hls from "hls.js";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Search, Copy, Play, Radio, Loader2, Download, ChevronDown, ChevronRight, Image as ImageIcon, Filter } from "lucide-react";
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
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState("all");
  const [collapsedSources, setCollapsedSources] = useState({});
  
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  const token = localStorage.getItem("token");

  // Load playlists on mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      const response = await axios.get(`${API}/m3u`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPlaylists(response.data);
    } catch (error) {
      console.error("Failed to load playlists:", error);
    }
  };

  // Group channels by playlist source
  const groupedChannels = channels.reduce((acc, channel) => {
    const source = channel.playlist_name || "Unknown Source";
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(channel);
    return acc;
  }, {});

  // Initialize all sources as collapsed
  useEffect(() => {
    const initialCollapsed = {};
    Object.keys(groupedChannels).forEach(source => {
      if (collapsedSources[source] === undefined) {
        initialCollapsed[source] = true;
      }
    });
    if (Object.keys(initialCollapsed).length > 0) {
      setCollapsedSources(prev => ({ ...prev, ...initialCollapsed }));
    }
  }, [channels]);

  const toggleSource = (source) => {
    setCollapsedSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  // Filter channels by selected playlist
  const filteredChannels = selectedPlaylist === "all" 
    ? channels 
    : channels.filter(ch => ch.playlist_name === selectedPlaylist);

  const filteredGroupedChannels = filteredChannels.reduce((acc, channel) => {
    const source = channel.playlist_name || "Unknown Source";
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(channel);
    return acc;
  }, {});

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/channels/search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { query: searchQuery },
      });
      setChannels(response.data);
      if (response.data.length === 0) {
        toast.info("No channels found");
      } else {
        toast.success(`Found ${response.data.length} channels`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to search channels");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Stream URL copied!");
    } catch (error) {
      const textArea = document.createElement("textarea");
      textArea.value = url;
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
  };

  const handleCopyLogo = async (logoUrl) => {
    try {
      await navigator.clipboard.writeText(logoUrl);
      toast.success("Logo URL copied!");
    } catch (error) {
      toast.error("Failed to copy logo URL");
    }
  };

  const handleProbe = async (channel) => {
    setProbingChannels({ ...probingChannels, [channel.url]: true });
    
    try {
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
    setPlayerError(null);
    setPlayerReady(false);
  };

  // HLS Player Setup
  useEffect(() => {
    if (playerOpen && currentStream && videoRef.current) {
      const video = videoRef.current;
      const streamUrl = currentStream.url;

      console.log("Loading stream:", streamUrl);
      setPlayerError(null);
      setPlayerReady(false);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      video.pause();
      video.removeAttribute('src');
      video.load();
      
      while (video.firstChild) {
        video.removeChild(video.firstChild);
      }

      if (streamUrl.includes('.m3u8') || streamUrl.includes('.m3u')) {
        if (Hls.isSupported()) {
          console.log("Using HLS.js for playback");
          
          const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
            maxBufferLength: 30,
            maxBufferSize: 60 * 1000 * 1000,
            manifestLoadingTimeOut: 10000,
            manifestLoadingMaxRetry: 3,
            levelLoadingTimeOut: 10000,
            fragLoadingTimeOut: 20000,
            xhrSetup: function(xhr) {
              xhr.withCredentials = false;
              xhr.timeout = 10000;
            }
          });

          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("✅ Manifest parsed");
            setPlayerReady(true);
            toast.success("Stream loaded!");
            
            setTimeout(() => {
              video.play()
                .then(() => console.log("✅ Playback started"))
                .catch(err => {
                  console.warn("Autoplay prevented:", err);
                  toast.info("Click play button to start");
                });
            }, 100);
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            console.error("❌ HLS Error:", data);
            
            if (data.fatal) {
              const errorMessage = data.details || "Unknown error";
              setPlayerError(`Stream error: ${errorMessage}`);
              
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  toast.error("Network error - check stream URL");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  toast.error("Media error - recovering...");
                  hls.recoverMediaError();
                  break;
                default:
                  toast.error(`Cannot play: ${errorMessage}`);
                  hls.destroy();
                  break;
              }
            }
          });

          hlsRef.current = hls;
          
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          console.log("Using native HLS (Safari)");
          video.src = streamUrl;
          
          video.addEventListener('loadedmetadata', () => {
            console.log("✅ Metadata loaded");
            setPlayerReady(true);
            video.play().catch(err => {
              console.warn("Autoplay prevented:", err);
              toast.info("Click play button");
            });
          });
          
          video.addEventListener('error', (e) => {
            console.error("❌ Video error:", e);
            setPlayerError("Failed to load stream");
            toast.error("Failed to load stream");
          });
          
        } else {
          setPlayerError("Browser doesn't support HLS");
          toast.error("Browser doesn't support HLS playback");
        }
      } else {
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
          toast.info("Click play button");
        });
      }
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, [playerOpen, currentStream]);

  const handleSelectChannel = (channel) => {
    const isSelected = selectedChannels.find(ch => ch.url === channel.url);
    if (isSelected) {
      setSelectedChannels(selectedChannels.filter(ch => ch.url !== channel.url));
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const handleSelectAll = () => {
    if (selectedChannels.length === filteredChannels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels([...filteredChannels]);
    }
  };

  const handleExportM3U = async () => {
    if (selectedChannels.length === 0) {
      toast.error("Please select at least one channel");
      return;
    }

    let m3uContent = "#EXTM3U\n";
    selectedChannels.forEach(channel => {
      m3uContent += `#EXTINF:-1 tvg-id="${channel.name}" tvg-name="${channel.name}" tvg-logo="${channel.logo || ""}" group-title="${channel.group || ""}",${channel.name}\n`;
      m3uContent += `${channel.url}\n`;
    });

    const blob = new Blob([m3uContent], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `exported-channels-${Date.now()}.m3u`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast.success(`Exported ${selectedChannels.length} channels`);
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="channels">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Search Channels</h1>
          <p className="text-base text-muted-foreground">Search and stream channels from your M3U playlists</p>
        </div>

        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters and Actions */}
        {channels.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedPlaylist} onValueChange={setSelectedPlaylist}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by playlist" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Playlists</SelectItem>
                  {playlists.map((playlist) => (
                    <SelectItem key={playlist.id} value={playlist.name}>
                      {playlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedChannels.length === filteredChannels.length ? "Deselect All" : "Select All"}
              </Button>
              <Button 
                size="sm" 
                onClick={handleExportM3U}
                disabled={selectedChannels.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export ({selectedChannels.length})
              </Button>
            </div>
          </div>
        )}

        {/* Grouped Results */}
        {Object.keys(filteredGroupedChannels).length > 0 && (
          <div className="space-y-4">
            {Object.entries(filteredGroupedChannels).map(([source, sourceChannels]) => (
              <Card key={source}>
                <Collapsible 
                  open={!collapsedSources[source]}
                  onOpenChange={() => toggleSource(source)}
                >
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          {collapsedSources[source] ? (
                            <ChevronRight className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                          {source}
                          <Badge variant="secondary">{sourceChannels.length} channels</Badge>
                        </CardTitle>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {sourceChannels.map((channel, index) => (
                          <Card key={index} className="overflow-hidden">
                            <div className="relative aspect-video bg-muted flex items-center justify-center">
                              {channel.logo ? (
                                <img 
                                  src={channel.logo} 
                                  alt={channel.name}
                                  className="w-full h-full object-contain p-2"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentElement.innerHTML = `<div class="flex items-center justify-center w-full h-full"><span class="text-4xl text-muted-foreground">📺</span></div>`;
                                  }}
                                />
                              ) : (
                                <span className="text-4xl text-muted-foreground">📺</span>
                              )}
                              <div className="absolute top-2 left-2">
                                <Checkbox
                                  checked={selectedChannels.some(ch => ch.url === channel.url)}
                                  onCheckedChange={() => handleSelectChannel(channel)}
                                />
                              </div>
                            </div>
                            
                            <CardContent className="p-4 space-y-3">
                              <div>
                                <h3 className="font-semibold text-sm line-clamp-1">{channel.name}</h3>
                                {channel.group && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">{channel.group}</p>
                                )}
                              </div>

                              {channelStatus[channel.url] && (
                                <div className="text-xs">
                                  <div className="flex items-center gap-1">
                                    <Radio className={`h-3 w-3 ${channelStatus[channel.url].online ? 'text-green-500' : 'text-red-500'}`} />
                                    <span className={channelStatus[channel.url].online ? 'text-green-600' : 'text-red-600'}>
                                      {channelStatus[channel.url].online ? 'Online' : channelStatus[channel.url].status}
                                    </span>
                                  </div>
                                  {ffmpegProbeData[channel.url]?.video_resolution && (
                                    <p className="text-muted-foreground mt-1">
                                      {ffmpegProbeData[channel.url].video_resolution} • {ffmpegProbeData[channel.url].bitrate}
                                    </p>
                                  )}
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyUrl(channel.url)}
                                  className="text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  URL
                                </Button>
                                {channel.logo && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopyLogo(channel.logo)}
                                    className="text-xs"
                                  >
                                    <ImageIcon className="h-3 w-3 mr-1" />
                                    Logo
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
                                <Button
                                  size="sm"
                                  onClick={() => handlePlay(channel)}
                                  className="text-xs"
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Play
                                </Button>
                              </div>
                              
                              {ffmpegProbeData[channel.url] && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="w-full text-xs h-auto p-0"
                                  onClick={() => showDetails(channel)}
                                >
                                  View Details →
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {channels.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Search for channels to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Video Player Dialog */}
        <Dialog open={playerOpen} onOpenChange={(open) => {
          setPlayerOpen(open);
          if (!open) {
            setPlayerError(null);
            setPlayerReady(false);
            if (hlsRef.current) {
              hlsRef.current.destroy();
              hlsRef.current = null;
            }
            if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.src = '';
            }
          }
        }}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{currentStream?.name}</DialogTitle>
              <DialogDescription>
                {currentStream?.group && <Badge variant="secondary">{currentStream.group}</Badge>}
              </DialogDescription>
            </DialogHeader>
            
            {playerError && (
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{playerError}</p>
              </div>
            )}
            
            {!playerReady && !playerError && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading stream...
                </p>
              </div>
            )}
            
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                playsInline
                autoPlay
                muted={false}
              />
              {!playerReady && !playerError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-12 w-12 text-white animate-spin" />
                </div>
              )}
            </div>
            
            {playerReady && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.play().catch(err => {
                        toast.error("Failed to play: " + err.message);
                      });
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.pause();
                    }
                  }}
                >
                  Pause
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play();
                    }
                  }}
                >
                  Restart
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Details Dialog */}
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
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Status</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Online:</span>
                      <span className={`ml-2 font-semibold ${currentDetails.probeData.online ? 'text-green-600' : 'text-red-600'}`}>
                        {currentDetails.probeData.online ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

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
                        {currentDetails.probeData.bitrate && (
                          <div>
                            <span className="text-muted-foreground font-medium">Bitrate:</span>
                            <span className="ml-2 font-mono">{currentDetails.probeData.bitrate}</span>
                          </div>
                        )}
                      </div>
                    </div>

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
                  </>
                )}

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
