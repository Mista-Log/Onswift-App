import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSave = () => {
    toast.success("Settings saved successfully!");
  };

  const handleEditProfile = () => {
    if (user?.userType === 'talent') {
      navigate('/profile/edit');
    } else {
      navigate('/profile/creator/edit');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account and preferences
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Profile Section */}
          <div className="lg:col-span-2">
            <section className="glass-card p-6">
              <h2 className="mb-6 text-lg font-semibold text-foreground">Profile</h2>

              {/* Avatar */}
              <div className="mb-6 flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-primary/30">
                    <AvatarImage src={user?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`} />
                    <AvatarFallback className="bg-primary/20 text-primary text-xl">
                      {getInitials(user?.name || 'User')}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={handleEditProfile}
                    className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{user?.name || 'User'}</h3>
                  <p className="text-sm text-muted-foreground capitalize">{user?.userType || 'User'}</p>
                  {user?.companyName && (
                    <p className="text-xs text-muted-foreground">{user.companyName}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" defaultValue={user?.name || ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email || ''} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Input id="bio" defaultValue={user?.bio || ''} placeholder={user?.userType === 'talent' ? "Professional bio" : "About your brand"} />
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
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">Receive push notifications</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-foreground">Message Alerts</p>
                    <p className="text-sm text-muted-foreground">Get notified of new messages</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </section>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6">
            <section className="glass-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Account Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="text-foreground">Jan 2023</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Projects created</span>
                  <span className="text-foreground">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team members</span>
                  <span className="text-foreground">8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed tasks</span>
                  <span className="text-foreground">156</span>
                </div>
              </div>
            </section>

            <section className="glass-card p-6">
              <h3 className="mb-4 font-semibold text-foreground">Danger Zone</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button variant="destructive" className="w-full">
                Delete Account
              </Button>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
