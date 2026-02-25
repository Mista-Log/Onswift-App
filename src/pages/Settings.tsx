import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Edit, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { secureFetch } from "@/api/apiClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

interface AccountStats {
  member_since: string;
  projects_count: number;
  team_members_count: number;
  completed_tasks_count: number;
}

interface NotificationSettings {
  email_notifications: boolean;
  push_notifications: boolean;
  message_alerts: boolean;
}

export default function Settings() {
  const { user, getUser, logout } = useAuth();
  const navigate = useNavigate();

  const { theme, setTheme } = useTheme();

  // Profile form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Notification settings state
  const [notifications, setNotifications] = useState<NotificationSettings>({
    email_notifications: true,
    push_notifications: true,
    message_alerts: true,
  });

  // Account stats state
  const [stats, setStats] = useState<AccountStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch account stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await secureFetch('/api/v1/account/stats/');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch account stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch notification settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await secureFetch('/api/v1/settings/');
        if (response.ok) {
          const data = await response.json();
          setNotifications({
            email_notifications: data.email_notifications,
            push_notifications: data.push_notifications,
            message_alerts: data.message_alerts,
          });
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      }
    };
    fetchSettings();
  }, []);

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save profile changes
      const profileResponse = await secureFetch('/api/v1/settings/profile/', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          bio: bio,
        }),
      });

      // Save notification settings
      const settingsResponse = await secureFetch('/api/v1/settings/', {
        method: 'PATCH',
        body: JSON.stringify(notifications),
      });

      if (profileResponse.ok && settingsResponse.ok) {
        toast.success("Settings saved successfully!");
        // Refresh user data
        if (getUser) {
          await getUser();
        }
      } else {
        const profileError = !profileResponse.ok ? await profileResponse.json() : null;
        const settingsError = !settingsResponse.ok ? await settingsResponse.json() : null;
        toast.error(profileError?.detail || settingsError?.detail || "Failed to save settings");
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const response = await secureFetch('/api/v1/account/delete/', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success("Account deleted successfully");
        logout();
        navigate('/login');
      } else {
        const error = await response.json();
        toast.error(error.detail || "Failed to delete account");
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast.error("Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditProfile = () => {
    if (user?.role === 'talent') {
      navigate('/profile/edit');
    } else {
      navigate('/profile/creator/edit');
    }
  };

  const getInitials = (full_name: string) => {
    return full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };



  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">Settings</h1>
            <button
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted/20 hover:bg-muted/30 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "light" ? (
                <Sun className="h-4 w-4 text-yellow-400" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <p className="mt-1 text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
          {/* Profile Section */}
          <div className="lg:col-span-2">
            <section className="glass-card p-5 sm:p-6 md:p-7">
              <h2 className="mb-6 text-lg font-semibold text-foreground">Profile</h2>

              {/* Avatar */}
              <div className="mb-6 flex items-center gap-4 sm:gap-6">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-primary/30">
                    <AvatarImage src={user?.profilePicture || ""} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xl">
                      {getInitials(user?.full_name || 'User')}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={handleEditProfile}
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{user?.full_name || 'User'}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{user?.role || 'User'}</p>
                  {user?.company_name && (
                    <p className="text-xs text-muted-foreground">{user.company_name}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input 
                    id="full_name" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Input 
                    id="bio" 
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={user?.role === 'talent' ? "Professional bio" : "About your brand"} 
                  />
                </div>
              </div>

              <Separator className="my-6 bg-border/50" />

              {/* Notifications */}
              <h3 className="mb-4 font-semibold text-foreground">Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive project updates via email</p>
                  </div>
                  <Switch 
                    checked={notifications.email_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, email_notifications: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive push notifications</p>
                  </div>
                  <Switch 
                    checked={notifications.push_notifications}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, push_notifications: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground">Message Alerts</p>
                    <p className="text-sm text-muted-foreground">Get notified of new messages</p>
                  </div>
                  <Switch 
                    checked={notifications.message_alerts}
                    onCheckedChange={(checked) => 
                      setNotifications(prev => ({ ...prev, message_alerts: checked }))
                    }
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </section>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            <section className="glass-card p-5 sm:p-6 md:p-7">
              <h3 className="mb-4 font-semibold text-foreground">Account Stats</h3>
              {loadingStats ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Member since</span>
                    <span className="text-foreground">{formatDate(stats.member_since)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {user?.role === 'talent' ? 'Projects joined' : 'Projects created'}
                    </span>
                    <span className="text-foreground">{stats.projects_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team members</span>
                    <span className="text-foreground">{stats.team_members_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed tasks</span>
                    <span className="text-foreground">{stats.completed_tasks_count}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Unable to load stats</p>
              )}
            </section>

            <section className="glass-card p-5 sm:p-6 md:p-7">
              <h3 className="mb-4 font-semibold text-foreground">Danger Zone</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and remove all your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
