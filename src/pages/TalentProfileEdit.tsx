import { useState } from "react";
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
import { Camera, X, Plus, Link as LinkIcon, Linkedin, Twitter, Github } from "lucide-react";

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

export default function TalentProfileEdit() {
  const { user, updateTalentProfile } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    full_name: user?.full_name || "",
    professional_title: user?.professional_title || "",
    bio: user?.bio || "",
    skills: user?.skills || [],
    portfolioLink: user?.portfolioLink || "",
    hourlyRate: user?.hourlyRate || "",
    availability: user?.availability || "",
    avatarUrl: user?.avatarUrl || "",
  });

  const [portfolioLinks, setPortfolioLinks] = useState<string[]>([formData.portfolioLink].filter(Boolean));
  const [newSkill, setNewSkill] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    updateTalentProfile({
      full_name: formData.full_name,
      professional_title: formData.professional_title,
      bio: formData.bio,
      skills: formData.skills,
      portfolioLink: portfolioLinks[0] || "",
      hourlyRate: Number(formData.hourlyRate) || undefined,
      availability: formData.availability,
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
                <Button type="button" variant="outline" className="gap-2">
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

          {/* Rates & Availability */}
          <section className="glass-card p-6">
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
          </section>

          {/* Social Links */}
          <section className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Social Links</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="https://linkedin.com/in/yourname" className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Twitter/X</Label>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="https://twitter.com/yourhandle" className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>GitHub</Label>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="https://github.com/yourname" className="pl-10" />
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
