import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Camera, X, Plus, Link as LinkIcon } from "lucide-react";
import { SocialLinksEditor, toSocialValues, type SocialValues } from "@/components/profile/socials";
import { uploadErrorMessage } from "@/lib/uploadError";
import { FeaturedManager, useFeaturedWork } from "@/components/profile/FeaturedManager";
import { ProfilePreviewButton, useOwnPreviewBase } from "@/components/profile/ProfilePreviewPanel";
import { BannerField, useBannerField } from "@/components/profile/ProfileFormFields";
import { ShareProfileButton } from "@/components/profile/ShareProfileButton";
import type { ProfileData } from "@/components/profile/ProfileView";

const SKILL_OPTIONS = [
  "UI/UX Design", "Web Development", "Mobile Development",
  "Graphic Design", "Video Editing", "Content Writing",
  "Social Media Marketing", "SEO/SEM", "Project Management",
  "Brand Strategy", "Copywriting", "3D Design",
  "Animation", "Photography", "Illustration"
];

const AVAILABILITY_OPTIONS = [
  "Available Now",
  "Available in 1-2 weeks",
  "Available in 1 month",
  "Not Available"
];

// The form copies the saved profile into its own state once. On a fresh load the saved profile can arrive
// a moment after the page opens, so remount the form when it does (keyed on the saved values).
export default function TalentProfileEdit() {
  const { user } = useAuth();
  const saved = JSON.stringify([
    user?.id, user?.full_name, user?.professional_title, user?.bio, user?.skills,
    user?.portfolioLinks, user?.hourlyRate, user?.availability, user?.social_links,
  ]);
  return <TalentProfileEditForm key={saved} />;
}

function TalentProfileEditForm() {
  const { user, updateTalentProfile } = useAuth();
  const navigate = useNavigate();

  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    professional_title: user?.professional_title || "",
    bio: user?.bio || "",
    skills: user?.skills || [],
    portfolioLink: user?.portfolioLink || "",
    hourlyRate: user?.hourlyRate || "",
    availability: user?.availability || "",
    profilePicture: user?.profilePicture || "",
  });

  const [portfolioLinks, setPortfolioLinks] = useState<string[]>(user?.portfolioLinks?.length ? user.portfolioLinks : [formData.portfolioLink].filter(Boolean));
  const [socialLinks, setSocialLinks] = useState<SocialValues>(() => toSocialValues(user?.social_links));
  const banner = useBannerField(user?.banner);
  const [newSkill, setNewSkill] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // The preview shows what your creators will see: the form as it is right now, saved or not.
  const featured = useFeaturedWork();
  const base = useOwnPreviewBase(user?.id, featured.items.length);
  const pictureUrl = useMemo(() => (profilePicture ? URL.createObjectURL(profilePicture) : null), [profilePicture]);
  const preview: ProfileData = {
    role: "talent",
    full_name: formData.full_name,
    avatar: pictureUrl || user?.profilePicture || null,
    banner: banner.previewUrl,
    headline: formData.professional_title,
    bio: formData.bio,
    skills: formData.skills,
    links: portfolioLinks.filter((l) => l.trim()),
    social_links: socialLinks,
    featured: featured.items,
    stats: base.stats,
    member_since: base.member_since,
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSkill = (skill: string) => {
    if (formData.skills.length < 10 && !formData.skills.includes(skill)) {
      setFormData(prev => ({ ...prev, skills: [...prev.skills, skill] }));
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData(prev => ({ 
      ...prev, 
      skills: prev.skills.filter(s => s !== skill) 
    }));
  };

  const handleAddPortfolioLink = () => {
    if (portfolioLinks.length < 5) {
      setPortfolioLinks([...portfolioLinks, ""]);
    }
  };

  const handleUpdatePortfolioLink = (index: number, value: string) => {
    const updated = [...portfolioLinks];
    updated[index] = value;
    setPortfolioLinks(updated);
  };

  const handleRemovePortfolioLink = (index: number) => {
    setPortfolioLinks(portfolioLinks.filter((_, i) => i !== index));
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  try {
    const formPayload = new FormData();

    // User fields
    formPayload.append("full_name", formData.full_name);
    if (profilePicture) {
      formPayload.append("profile_picture", profilePicture);
    }
    banner.appendTo(formPayload);

    // Talent fields
    formPayload.append("professional_title", formData.professional_title);
    formPayload.append("bio", formData.bio);
    formPayload.append("hourly_rate", String(formData.hourlyRate || ""));
    formPayload.append("availability", formData.availability);

    // Skills array
    formData.skills.forEach((skill) => {
      formPayload.append("skills", skill);
    });

    // Portfolio links
    const links = portfolioLinks.map((l) => l.trim()).filter(Boolean);
    links.forEach((link) => formPayload.append("portfolio_links", link));

    // A form sends nothing for an empty list, so say which lists were emptied.
    if (formData.skills.length === 0) formPayload.append("clear_fields", "skills");
    if (links.length === 0) formPayload.append("clear_fields", "portfolio_links");

    // Social links (JSONField)
    formPayload.append("social_links", JSON.stringify(socialLinks));

    // Call your existing AuthContext function
    const result = await updateTalentProfile(formPayload);
    if (!result.success) {
      toast.error(uploadErrorMessage(undefined, undefined, result.error || "Failed to update profile."));
      return;
    }

    toast.success("Profile updated successfully!");
    navigate("/dashboard");
  } catch (error: any) {
    console.error(error);
    toast.error(error?.message || "Failed to update profile.");
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
            <h1 className="text-3xl font-bold text-foreground">Profile</h1>
            
          </div>
          <div className="flex items-center gap-2">
            <ProfilePreviewButton profile={preview} audience="your creators" />
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
                <Label htmlFor="professional_title">Professional Title</Label>
                <Input
                  id="professional_title"
                  value={formData.professional_title}
                  onChange={(e) => handleInputChange("professional_title", e.target.value)}
                  placeholder="e.g., Senior UI/UX Designer"
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

          {/* Professional Information */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Professional Information</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bio">Professional Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell creators about your experience, expertise, and what makes you unique..."
                  rows={5}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.bio?.length || 0}/500 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label>Skills & Expertise (max 10)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="secondary" className="gap-1">
                      {skill}
                      <button 
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={handleAddSkill}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add a skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_OPTIONS.filter(s => !formData.skills.includes(s)).map(skill => (
                      <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Portfolio Section */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Portfolio & Work Samples</h2>
            <div className="space-y-4">
              {portfolioLinks.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={link}
                      onChange={(e) => handleUpdatePortfolioLink(index, e.target.value)}
                      placeholder="https://yourportfolio.com"
                      className="pl-10"
                    />
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleRemovePortfolioLink(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {portfolioLinks.length < 5 && (
                <Button type="button" variant="ghost" onClick={handleAddPortfolioLink} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Another Link
                </Button>
              )}
            </div>
          </section>

          <FeaturedManager items={featured.items} onChange={featured.setItems} />

          {/* Rates & Availability */}
          {/* <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Rates & Availability</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="hourlyRate"
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => handleInputChange("hourlyRate", e.target.value)}
                    placeholder="50"
                    className="pl-7"
                    min={5}
                    max={500}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Select 
                  value={formData.availability} 
                  onValueChange={(value) => handleInputChange("availability", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your availability" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map(option => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section> */}

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
