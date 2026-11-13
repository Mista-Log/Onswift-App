import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { SocialLinksEditor, toSocialValues, type SocialValues } from "@/components/profile/socials";
import { uploadErrorMessage } from "@/lib/uploadError";
import { FeaturedManager, useFeaturedWork } from "@/components/profile/FeaturedManager";
import { ProfilePreviewButton, useOwnPreviewBase } from "@/components/profile/ProfilePreviewPanel";
import { BannerField, PortfolioLinksEditor, useBannerField } from "@/components/profile/ProfileFormFields";
import { ShareProfileButton } from "@/components/profile/ShareProfileButton";
import type { ProfileData } from "@/components/profile/ProfileView";

export default function CreatorProfileEdit() {
  const { user, updateCreatorProfile, getUser } = useAuth();
  const navigate = useNavigate();

  // const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  const [socialLinks, setSocialLinks] = useState<SocialValues>(() => toSocialValues(user?.social_links));
  const [portfolioLinks, setPortfolioLinks] = useState<string[]>(user?.portfolioLinks ?? []);
  const banner = useBannerField(user?.banner);

  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    company_name: user?.company_name || "",
    bio: user?.bio || "",
  });

  // Fetch latest user data on mount
  useEffect(() => {
    const fetchUser = async () => {
      await getUser();
    };
    fetchUser();
  }, []);

  // Sync formData when user updates
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        company_name: user.company_name || "",
        bio: user.bio || "",
      });


      setSocialLinks(toSocialValues(user.social_links));
      setPortfolioLinks(user.portfolioLinks ?? []);
    }
  }, [user]);



  const [isLoading, setIsLoading] = useState(false);

  // The preview shows what your team will see: the form as it is right now, saved or not.
  const featured = useFeaturedWork();
  const base = useOwnPreviewBase(user?.id, featured.items.length);
  const pictureUrl = useMemo(() => (profilePicture ? URL.createObjectURL(profilePicture) : null), [profilePicture]);
  const preview: ProfileData = {
    role: "creator",
    full_name: formData.full_name,
    avatar: pictureUrl || user?.profilePicture || null,
    banner: banner.previewUrl,
    headline: formData.company_name,
    bio: formData.bio,
    skills: [],
    links: portfolioLinks.filter((l) => l.trim()),
    social_links: socialLinks,
    featured: featured.items,
    stats: base.stats,
    member_since: base.member_since,
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // const handleSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setIsLoading(true);

  //   await new Promise(resolve => setTimeout(resolve, 800));

  //   updateCreatorProfile({
  //     full_name: formData.full_name,
  //     company_name: formData.company_name,
  //     bio: formData.bio,
  //   });

  //   setIsLoading(false);
  //   toast.success("Profile updated successfully!");
  //   navigate("/dashboard");
  // };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = new FormData();

      // User
      payload.append("full_name", formData.full_name);
      banner.appendTo(payload);

      // Portfolio links. A form sends nothing for an empty list, so say when it was emptied.
      const links = portfolioLinks.map((l) => l.trim()).filter(Boolean);
      links.forEach((link) => payload.append("portfolio_links", link));
      if (links.length === 0) payload.append("clear_fields", "portfolio_links");

      // Creator profile
      payload.append("company_name", formData.company_name);
      payload.append("bio", formData.bio);

      // Social links (JSONField)
      payload.append("social_links", JSON.stringify(socialLinks));

      // Profile picture (image)
      if (profilePicture) {
        payload.append("profile_picture", profilePicture);
      }

      console.log("Submitting payload:", Array.from(payload.entries()));

      const result = await updateCreatorProfile(payload);
      if (!result.success) {
        toast.error(uploadErrorMessage(undefined, undefined, result.error || "Failed to update profile."));
        return;
      }

      toast.success("Profile updated successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
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
            
          </div>
          <div className="flex items-center gap-2">
            <ProfilePreviewButton profile={preview} audience="your team" />
            <ShareProfileButton />
            <Button variant="glow" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <BannerField previewUrl={banner.previewUrl} onPick={banner.pick} onRemove={banner.remove} />

          {/* Profile Picture Section */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 border-2 border-primary/50">
                  <AvatarImage 
                  src={
                    profilePicture 
                      ? URL.createObjectURL(profilePicture) 
                      : user?.profilePicture || ""
                  } 
                />
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
                      setProfilePicture(e.target.files[0]);
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

          <PortfolioLinksEditor links={portfolioLinks} onChange={setPortfolioLinks} />

          <FeaturedManager items={featured.items} onChange={featured.setItems} />

          {/* Social Links */}
          <SocialLinksEditor value={socialLinks} onChange={setSocialLinks} />

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
