import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import axios from "axios";
import { toast } from "sonner";
import { Download, Upload, Database, AlertCircle, Loader2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BackupRestore({ user, onLogout }) {
  const [backupType, setBackupType] = useState("full");
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const token = localStorage.getItem("token");

  // Check if user is super admin
  if (user.role !== "super_admin") {
    return (
      <Layout user={user} onLogout={onLogout} currentPage="backup">
        <div className="flex items-center justify-center h-64">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Access Denied
              </CardTitle>
              <CardDescription>
                Only Super Admins can access backup and restore functionality
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleBackupFull = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/backup/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Download as JSON file
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

      // Download as JSON file
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

  useEffect(() => {
    loadTenants();
  }, []);

  return (
    <Layout user={user} onLogout={onLogout} currentPage="backup">
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">Backup & Restore</h1>
          <p className="text-base text-muted-foreground">Manage database backups and restore operations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Backup Section */}
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

          {/* Restore Section */}
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
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setRestoreFile(e.target.files[0])}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
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
      </div>
    </Layout>
  );
}
