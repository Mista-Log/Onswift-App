import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Camera, Linkedin, Twitter, Instagram, Youtube } from "lucide-react";

export default function CreatorProfileEdit() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [socialLinks, setSocialLinks] = useState({
    linkedin: "",
    twitter: "",
    instagram: "",
    youtube: "",
  });

  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    company_name: user?.company_name || "",
    bio: user?.bio || "",
    avatarUrl: user?.avatarUrl || "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 800));

    updateProfile({
      full_name: formData.full_name,
      company_name: formData.company_name,
      bio: formData.bio,
    });

    setIsLoading(false);
    toast.success("Profile updated successfully!");
    navigate("/dashboard");
  };

  const getInitials = (full_name: string) => {
    return full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground mt-1">Dashboard &gt; Profile</p>
          </div>
          <Button variant="glow" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Profile Picture Section */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-primary/50">
                <AvatarImage src={formData.avatarUrl} />
                <AvatarFallback className="text-2xl bg-secondary">
                  {getInitials(formData.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">

                <input
                  type="file"
                  accept="image/*"
                  hidden
                  id="avatar-upload"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setAvatarFile(e.target.files[0]);
                      setFormData(prev => ({
                        ...prev,
                        avatarUrl: URL.createObjectURL(e.target.files![0]),
                      }));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                >
                  <Camera className="h-4 w-4" />
                  Upload New Photo
                </Button>
                <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max size 5MB.</p>
              </div>
            </div>
          </section>

          {/* Basic Information */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange("full_name", e.target.value)}
                  placeholder="Your full full_name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company/Brand Name</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange("company_name", e.target.value)}
                  placeholder="e.g., My Creative Studio"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="opacity-60"
                />
                <p className="text-xs text-muted-foreground">Contact support to change your email</p>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">About</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell your team and collaborators about yourself and your creative vision..."
                  rows={5}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.bio?.length || 0}/500 characters
                </p>
              </div>
            </div>
          </section>

          {/* Social Links */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Social Links</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  placeholder="https://linkedin.com/in/yourname"
                  className="pl-10"
                  value={socialLinks.linkedin}
                  onChange={(e) =>
                    setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))
                  }
                />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Twitter/X</Label>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  placeholder="https://twitter.com/in/yourname"
                  className="pl-10"
                  value={socialLinks.twitter}
                  onChange={(e) =>
                    setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))
                  }
                />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  placeholder="https://instagram.com/in/yourname"
                  className="pl-10"
                  value={socialLinks.instagram}
                  onChange={(e) =>
                    setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))
                  }
                />
                </div>
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <div className="relative">
                  <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  placeholder="https://youtube.com/in/yourname"
                  className="pl-10"
                  value={socialLinks.youtube}
                  onChange={(e) =>
                    setSocialLinks(prev => ({ ...prev, youtube: e.target.value }))
                  }
                />
                </div>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
