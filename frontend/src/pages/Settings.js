import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import axios from "axios";
import { toast } from "sonner";
import { Download, Upload, Database, AlertCircle, Loader2, Calendar, Clock, Plus, Trash2, Settings as SettingsIcon, RefreshCw, GitBranch, AlertTriangle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Settings({ user, onLogout }) {
  const [backupType, setBackupType] = useState("full");
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  
  // Scheduled backups
  const [schedules, setSchedules] = useState([]);
  const [backupFiles, setBackupFiles] = useState([]);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    schedule_type: "full",
    tenant_id: "",
    frequency: "daily",
    retention_days: 7
  });
  
  // System updates
  const [systemSettings, setSystemSettings] = useState({
    production_repo_url: "",
    beta_repo_url: "",
    current_branch: "production",
    last_update: null
  });
  const [updating, setUpdating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  
  const token = localStorage.getItem("token");

  // Check if user is super admin
  if (user.role !== "super_admin") {
    return (
      <Layout user={user} onLogout={onLogout} currentPage="settings">
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription>
                Only Super Admins can access settings
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  useEffect(() => {
    loadTenants();
    loadSchedules();
    loadBackupFiles();
    loadSystemSettings();
  }, []);

  const loadTenants = async () => {
    try {
      const response = await axios.get(`${API}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTenants(response.data);
    } catch (error) {
      toast.error("Failed to load tenants");
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await axios.get(`${API}/backup/schedules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchedules(response.data);
    } catch (error) {
      console.error("Failed to load schedules:", error);
    }
  };

  const loadBackupFiles = async () => {
    try {
      const response = await axios.get(`${API}/backup/files`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBackupFiles(response.data);
    } catch (error) {
      console.error("Failed to load backup files:", error);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const response = await axios.get(`${API}/system/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSystemSettings(response.data);
    } catch (error) {
      console.error("Failed to load system settings:", error);
    }
  };

  const handleUpdateSystemSettings = async () => {
    try {
      await axios.put(
        `${API}/system/settings`,
        {
          production_repo_url: systemSettings.production_repo_url,
          beta_repo_url: systemSettings.beta_repo_url
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("System settings updated successfully!");
      loadSystemSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to update settings");
    }
  };

  const handlePullUpdate = async (branch) => {
    if (!window.confirm(`⚠️ WARNING: This will pull updates from the ${branch} repository. A backup will be created automatically. Continue?`)) {
      return;
    }

    setUpdating(true);
    try {
      const response = await axios.post(
        `${API}/system/update`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { branch }
        }
      );

      toast.success(response.data.message);
      loadSystemSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to pull updates");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeploy = async () => {
    if (!window.confirm(`⚠️ WARNING: This will rebuild the application and restart services. You will be disconnected briefly. Continue?`)) {
      return;
    }

    setDeploying(true);
    try {
      const response = await axios.post(
        `${API}/system/deploy`,
        null,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success(response.data.message);
      
      // Show countdown and reload
      toast.info("Reloading page in 15 seconds...");
      setTimeout(() => {
        window.location.reload();
      }, 15000);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to deploy updates");
      setDeploying(false);
    }
  };

  const handleBackupFull = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/backup/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `full-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Full database backup downloaded successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create backup");
    } finally {
      setLoading(false);
    }
  };

  const handleBackupTenant = async () => {
    if (!selectedTenant) {
      toast.error("Please select a tenant");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/backup/tenant/${selectedTenant}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const tenantName = response.data.tenant_name || 'tenant';
      link.download = `tenant-backup-${tenantName}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Tenant backup downloaded successfully!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create tenant backup");
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreFull = async () => {
    if (!restoreFile) {
      toast.error("Please select a backup file");
      return;
    }

    if (!window.confirm("⚠️ WARNING: This will DELETE all existing data and replace it with the backup. Are you sure?")) {
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          const response = await axios.post(
            `${API}/restore/full`,
            backupData,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          toast.success(response.data.message || "Database restored successfully!");
          setRestoreFile(null);
        } catch (error) {
          toast.error(error.response?.data?.detail || "Failed to restore database");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(restoreFile);
    } catch (error) {
      toast.error("Failed to read backup file");
      setLoading(false);
    }
  };

  const handleRestoreTenant = async () => {
    if (!restoreFile) {
      toast.error("Please select a backup file");
      return;
    }

    if (!window.confirm("⚠️ WARNING: This will DELETE the existing tenant data and replace it with the backup. Are you sure?")) {
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          const response = await axios.post(
            `${API}/restore/tenant`,
            backupData,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          toast.success(response.data.message || "Tenant restored successfully!");
          setRestoreFile(null);
        } catch (error) {
          toast.error(error.response?.data?.detail || "Failed to restore tenant");
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(restoreFile);
    } catch (error) {
      toast.error("Failed to read backup file");
      setLoading(false);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    
    if (scheduleForm.schedule_type === "tenant" && !scheduleForm.tenant_id) {
      toast.error("Please select a tenant");
      return;
    }

    try {
      await axios.post(
        `${API}/backup/schedules`,
        scheduleForm,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Backup schedule created successfully!");
      setShowScheduleDialog(false);
      setScheduleForm({
        schedule_type: "full",
        tenant_id: "",
        frequency: "daily",
        retention_days: 7
      });
      loadSchedules();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create schedule");
    }
  };

  const handleToggleSchedule = async (scheduleId, enabled) => {
    try {
      await axios.put(
        `${API}/backup/schedules/${scheduleId}`,
        { enabled: !enabled },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success(`Schedule ${!enabled ? 'enabled' : 'disabled'}`);
      loadSchedules();
    } catch (error) {
      toast.error("Failed to update schedule");
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Are you sure you want to delete this backup schedule?")) {
      return;
    }

    try {
      await axios.delete(`${API}/backup/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Backup schedule deleted");
      loadSchedules();
    } catch (error) {
      toast.error("Failed to delete schedule");
    }
  };

  const handleDownloadBackupFile = async (filename) => {
    try {
      const response = await axios.get(`${API}/backup/files/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Backup file downloaded!");
    } catch (error) {
      toast.error("Failed to download backup file");
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} currentPage="settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-base text-muted-foreground">Manage system settings and backups</p>
        </div>

        <Tabs defaultValue="backup" className="w-full">
          <TabsList>
            <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Backups</TabsTrigger>
            <TabsTrigger value="files">Backup Files</TabsTrigger>
            <TabsTrigger value="updates">System Updates</TabsTrigger>
          </TabsList>

          {/* Manual Backup & Restore Tab */}
          <TabsContent value="backup" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Backup Database
                  </CardTitle>
                  <CardDescription>Export database or tenant data to a JSON file</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Backup Type</Label>
                    <Select value={backupType} onValueChange={setBackupType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select backup type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Database</SelectItem>
                        <SelectItem value="tenant">Single Tenant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {backupType === "tenant" && (
                    <div className="space-y-2">
                      <Label>Select Tenant</Label>
                      <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a tenant" />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button
                    onClick={backupType === "full" ? handleBackupFull : handleBackupTenant}
                    disabled={loading || (backupType === "tenant" && !selectedTenant)}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download Backup
                  </Button>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-sm">
                    <p className="text-blue-600 dark:text-blue-400">
                      <strong>Note:</strong> Backups are downloaded as JSON files. Store them securely.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Restore Database
                  </CardTitle>
                  <CardDescription>Import backup data from a JSON file</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Backup File</Label>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={(e) => setRestoreFile(e.target.files[0])}
                    />
                    {restoreFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {restoreFile.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Restore Type</Label>
                    <Select value={backupType} onValueChange={setBackupType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select restore type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Database</SelectItem>
                        <SelectItem value="tenant">Single Tenant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={backupType === "full" ? handleRestoreFull : handleRestoreTenant}
                    disabled={loading || !restoreFile}
                    variant="destructive"
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    Restore from Backup
                  </Button>

                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md text-sm border border-red-200 dark:border-red-800">
                    <p className="text-red-600 dark:text-red-400 font-semibold mb-1">
                      ⚠️ Warning
                    </p>
                    <p className="text-red-600 dark:text-red-400 text-xs">
                      Restoring will <strong>DELETE</strong> existing data. Make sure you have a recent backup before proceeding.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Scheduled Backups Tab */}
          <TabsContent value="scheduled" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Automated backup schedules
              </p>
              <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Backup Schedule</DialogTitle>
                    <DialogDescription>
                      Set up an automated backup schedule
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateSchedule} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Backup Type</Label>
                      <Select
                        value={scheduleForm.schedule_type}
                        onValueChange={(value) => setScheduleForm({ ...scheduleForm, schedule_type: value, tenant_id: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full Database</SelectItem>
                          <SelectItem value="tenant">Single Tenant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {scheduleForm.schedule_type === "tenant" && (
                      <div className="space-y-2">
                        <Label>Select Tenant</Label>
                        <Select
                          value={scheduleForm.tenant_id}
                          onValueChange={(value) => setScheduleForm({ ...scheduleForm, tenant_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a tenant" />
                          </SelectTrigger>
                          <SelectContent>
                            {tenants.map((tenant) => (
                              <SelectItem key={tenant.id} value={tenant.id}>
                                {tenant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select
                        value={scheduleForm.frequency}
                        onValueChange={(value) => setScheduleForm({ ...scheduleForm, frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily (2 AM)</SelectItem>
                          <SelectItem value="weekly">Weekly (Sunday 2 AM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Retention Period (Days)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={scheduleForm.retention_days}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, retention_days: parseInt(e.target.value) })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Backup files older than this will be automatically deleted
                      </p>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setShowScheduleDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Create Schedule</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {schedules.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No scheduled backups configured
                  </CardContent>
                </Card>
              ) : (
                schedules.map((schedule) => (
                  <Card key={schedule.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span className="font-semibold">
                              {schedule.schedule_type === "full" ? "Full Database" : `Tenant Backup`}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {schedule.frequency === "daily" ? "Daily" : "Weekly"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Retention: {schedule.retention_days} days
                            </span>
                            {schedule.last_run && (
                              <span className="text-xs">
                                Last: {new Date(schedule.last_run).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={schedule.enabled}
                            onCheckedChange={() => handleToggleSchedule(schedule.id, schedule.enabled)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Backup Files Tab */}
          <TabsContent value="files" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Stored backup files from scheduled backups
            </p>

            <div className="grid grid-cols-1 gap-4">
              {backupFiles.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No backup files stored
                  </CardContent>
                </Card>
              ) : (
                backupFiles.map((file) => (
                  <Card key={file.filename}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="font-medium">{file.filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB • {new Date(file.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadBackupFile(file.filename)}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* System Updates Tab */}
          <TabsContent value="updates" className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> System updates will modify your installation. Always create a backup before updating.
                The system will automatically create a backup before pulling updates.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Repository Configuration
                </CardTitle>
                <CardDescription>
                  Configure GitHub repository URLs for production and beta updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="prod-repo">Production Repository URL</Label>
                  <Input
                    id="prod-repo"
                    placeholder="https://github.com/username/repo.git"
                    value={systemSettings.production_repo_url}
                    onChange={(e) => setSystemSettings({ ...systemSettings, production_repo_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Main branch for stable production releases
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="beta-repo">Beta Repository URL</Label>
                  <Input
                    id="beta-repo"
                    placeholder="https://github.com/username/repo.git"
                    value={systemSettings.beta_repo_url}
                    onChange={(e) => setSystemSettings({ ...systemSettings, beta_repo_url: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Beta branch for testing new features
                  </p>
                </div>

                <Button onClick={handleUpdateSystemSettings}>
                  Save Repository URLs
                </Button>

                {systemSettings.last_update && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      <strong>Current Branch:</strong> {systemSettings.current_branch}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Last Update:</strong> {new Date(systemSettings.last_update).toLocaleString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pull Updates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Pull Updates
                  </CardTitle>
                  <CardDescription>
                    Download latest changes from GitHub
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <Button
                      onClick={() => handlePullUpdate('production')}
                      disabled={updating || !systemSettings.production_repo_url}
                      className="w-full"
                      variant="outline"
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <GitBranch className="h-4 w-4 mr-2" />
                      )}
                      Pull Production Updates
                    </Button>

                    <Button
                      onClick={() => handlePullUpdate('beta')}
                      disabled={updating || !systemSettings.beta_repo_url}
                      className="w-full"
                      variant="outline"
                    >
                      {updating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <GitBranch className="h-4 w-4 mr-2" />
                      )}
                      Pull Beta Updates
                    </Button>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md text-sm">
                    <p className="text-blue-600 dark:text-blue-400">
                      <strong>Note:</strong> Pulling updates only downloads the changes. You must deploy to apply them.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Deploy Updates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Deploy Updates
                  </CardTitle>
                  <CardDescription>
                    Build and restart services with new changes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Deploying will:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Install backend dependencies</li>
                    <li>Build frontend application</li>
                    <li>Restart backend service</li>
                    <li>Restart frontend service</li>
                  </ul>

                  <Button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="w-full"
                    variant="default"
                  >
                    {deploying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Deploy Changes
                  </Button>

                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md text-sm border border-yellow-200 dark:border-yellow-800">
                    <p className="text-yellow-600 dark:text-yellow-400">
                      <strong>⚠️ Warning:</strong> Services will restart. You will be disconnected for ~15 seconds.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Update Process</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Configure repository URLs above and save</li>
                  <li>Click "Pull Production Updates" or "Pull Beta Updates"</li>
                  <li>System creates automatic backup and downloads changes</li>
                  <li>Review changes (optional)</li>
                  <li>Click "Deploy Changes" to apply and restart services</li>
                  <li>Page will reload automatically after 15 seconds</li>
                </ol>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
