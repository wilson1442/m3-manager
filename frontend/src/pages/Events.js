import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Play, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Events({ user, onLogout }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groupedChannels, setGroupedChannels] = useState({});
  const [openCategories, setOpenCategories] = useState({});

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    // Auto-open all categories by default
    const allOpen = {};
    Object.keys(groupedChannels).forEach(category => {
      allOpen[category] = true;
    });
    setOpenCategories(allOpen);
  }, [groupedChannels]);

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

  const toggleCategory = (category) => {
    setOpenCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
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
          <div className="space-y-4">
            {Object.entries(groupedChannels).map(([category, categoryChannels]) => (
              <Card key={category} data-testid={`category-${category}`}>
                <Collapsible
                  open={openCategories[category]}
                  onOpenChange={() => toggleCategory(category)}
                >
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <CollapsibleTrigger className="w-full" data-testid={`toggle-${category}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {openCategories[category] ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <CardTitle className="text-2xl">{category}</CardTitle>
                          <Badge variant="secondary" className="text-sm">
                            {categoryChannels.length} channels
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">Logo</TableHead>
                            <TableHead>Channel Name</TableHead>
                            <TableHead>Playlist</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryChannels.map((channel, index) => (
                            <TableRow key={index} data-testid={`channel-${category}-${index}`}>
                              <TableCell>
                                {channel.logo ? (
                                  <img 
                                    src={channel.logo} 
                                    alt={channel.name} 
                                    className="w-10 h-10 rounded object-cover"
                                    onError={(e) => e.target.style.display = 'none'}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                                    N/A
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{channel.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {channel.playlist_name}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCopyUrl(channel.url)}
                                    data-testid={`copy-${category}-${index}`}
                                  >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => window.open(channel.url, '_blank')}
                                    data-testid={`play-${category}-${index}`}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Play
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
