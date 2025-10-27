import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Play, RefreshCw } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Events({ user, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedChannels, setGroupedChannels] = useState({});

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/events/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setChannels(response.data);
      
      // Group channels by category
      const grouped = {};
      response.data.forEach(channel => {
        const group = channel.group || "Uncategorized";
        if (!grouped[group]) {
          grouped[group] = [];
        }
        grouped[group].push(channel);
      });
      
      setGroupedChannels(grouped);
    } catch (error) {
      toast.error("Failed to fetch monitored channels");
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

  return (
    <Layout user={user} onLogout={onLogout} currentPage="events">
      <div className="space-y-6" data-testid="events-page">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Events</h1>
            <p className="text-base text-muted-foreground">
              Channels from monitored categories ({channels.length} total)
            </p>
          </div>
          <Button
            onClick={fetchChannels}
            variant="outline"
            className="gap-2"
            data-testid="refresh-events-btn"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : Object.keys(groupedChannels).length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-2">No monitored categories</p>
                <p className="text-sm text-muted-foreground">
                  Go to Categories page to add categories to monitor
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedChannels).map(([category, categoryChannels]) => (
              <Card key={category} data-testid={`category-${category}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">{category}</CardTitle>
                      <CardDescription>{categoryChannels.length} channels</CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {categoryChannels.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryChannels.map((channel, index) => (
                      <div
                        key={index}
                        data-testid={`channel-${category}-${index}`}
                        className="border rounded-lg p-4 hover:bg-accent transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {channel.logo && (
                            <img 
                              src={channel.logo} 
                              alt={channel.name} 
                              className="w-12 h-12 rounded object-cover"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm line-clamp-2 mb-1">
                              {channel.name}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {channel.playlist_name}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleCopyUrl(channel.url)}
                            data-testid={`copy-${category}-${index}`}
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => window.open(channel.url, '_blank')}
                            data-testid={`play-${category}-${index}`}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Play
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
