import { useState } from "react";
import axios from "axios";
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

  const token = localStorage.getItem("token");

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

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("Stream URL copied to clipboard!");
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
              {currentStream && (
                <video
                  key={currentStream.url}
                  controls
                  autoPlay
                  className="w-full h-full"
                  data-testid="video-player"
                >
                  <source src={currentStream.url} type="application/x-mpegURL" />
                  <source src={currentStream.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Stream URL: {currentStream?.url}</p>
              <p className="mt-1">If the stream doesn't play, it may require a specialized player or the stream may be offline.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
