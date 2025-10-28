import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Eye, ChevronDown, ChevronRight, Filter } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Categories({ user, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [monitoredCategories, setMonitoredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState("all");
  const [collapsedSources, setCollapsedSources] = useState({});

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    try {
      const [categoriesRes, monitoredRes] = await Promise.all([
        axios.get(`${API}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API}/categories/monitor`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      
      setCategories(categoriesRes.data);
      setMonitoredCategories(monitoredRes.data);
    } catch (error) {
      toast.error("Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  };

  // Filter categories by selected playlist
  const filteredCategories = selectedPlaylist === "all"
    ? categories
    : categories.filter(cat => cat.playlist_name === selectedPlaylist);

  // Group categories by playlist source
  const groupedCategories = filteredCategories.reduce((acc, category) => {
    const source = category.playlist_name || "Unknown Source";
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(category);
    return acc;
  }, {});

  // Initialize all sources as collapsed
  useEffect(() => {
    const initialCollapsed = {};
    Object.keys(groupedCategories).forEach(source => {
      if (collapsedSources[source] === undefined) {
        initialCollapsed[source] = true;
      }
    });
    if (Object.keys(initialCollapsed).length > 0) {
      setCollapsedSources(prev => ({ ...prev, ...initialCollapsed }));
    }
  }, [categories]);

  const toggleSource = (source) => {
    setCollapsedSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  const handleToggle = async (categoryName, isCurrentlyMonitored) => {
    // Check if user can monitor (has tenant_id)
    if (!user.tenant_id) {
      toast.error("Monitoring is only available for users with a tenant");
      return;
    }
    
    if (isCurrentlyMonitored) {
      // Remove from monitoring
      const monitored = monitoredCategories.find(m => m.category === categoryName);
      try {
        await axios.delete(`${API}/categories/monitor/${monitored.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        toast.success(`Stopped monitoring "${categoryName}"`);
        fetchData();
      } catch (error) {
        toast.error("Failed to remove category");
      }
    } else {
      // Add to monitoring
      try {
        await axios.post(
          `${API}/categories/monitor`,
          { category: categoryName },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        toast.success(`Now monitoring "${categoryName}"`);
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || "Failed to add category");
      }
    }
  };

  const isMonitored = (categoryName) => {
    return monitoredCategories.some(m => m.category === categoryName);
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="categories">
      <div className="space-y-6" data-testid="categories-page">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Categories</h1>
          <p className="text-base text-muted-foreground">Toggle categories to monitor on Events page</p>
        </div>

        {/* Filter */}
        {categories.length > 0 && (
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
        )}

        {loading ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        ) : Object.keys(groupedCategories).length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">No categories found</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedCategories).map(([source, sourceCategories]) => (
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
                          <Badge variant="secondary">{sourceCategories.length} categories</Badge>
                        </CardTitle>
                        <CardDescription>
                          {sourceCategories.filter(cat => isMonitored(cat.name)).length} monitored
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sourceCategories.map((category, index) => {
                          const monitored = isMonitored(category.name);
                          return (
                            <div
                              key={`${source}-${index}`}
                              data-testid={`category-${index}`}
                              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                                monitored ? 'bg-primary/5 border-primary/20' : 'hover:bg-accent'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {monitored && <Eye className="h-4 w-4 text-primary" />}
                                <Badge variant={monitored ? "default" : "secondary"} className="text-sm">
                                  {category.name}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`toggle-${source}-${index}`} className="text-xs text-muted-foreground cursor-pointer">
                                  {monitored ? 'On' : 'Off'}
                                </Label>
                                <Switch
                                  id={`toggle-${source}-${index}`}
                                  checked={monitored}
                                  onCheckedChange={() => handleToggle(category.name, monitored)}
                                  data-testid={`toggle-${index}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
