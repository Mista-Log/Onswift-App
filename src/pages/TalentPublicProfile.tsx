import { useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, Star, CheckCircle, MessageSquare, Plus, ExternalLink, Linkedin, Twitter, Github } from "lucide-react";
import { toast } from "sonner";

// Mock talent data
const mockTalent = {
  id: "1",
  name: "Sam Talent",
  professionalTitle: "UI/UX Designer",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sam",
  location: "San Francisco, CA",
  availability: "Available Now",
  bio: "Passionate UI/UX designer with 5+ years of experience creating beautiful, user-centered digital experiences. I specialize in mobile app design, web interfaces, and design systems. My approach combines aesthetic excellence with data-driven decisions.",
  skills: ["UI/UX Design", "Web Development", "Graphic Design", "Figma", "Prototyping"],
  projectsCompleted: 24,
  rating: 4.8,
  reviewCount: 12,
  responseTime: "< 2 hours",
  hourlyRate: 75,
  portfolioLinks: ["https://dribbble.com/samtalent", "https://behance.net/samtalent"],
  socialLinks: {
    linkedin: "https://linkedin.com/in/samtalent",
    twitter: "https://twitter.com/samtalent",
    github: "https://github.com/samtalent"
  },
  reviews: [
    {
      id: "1",
      reviewerName: "Alex Creator",
      reviewerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
      rating: 5,
      date: "Nov 15, 2023",
      text: "Sam delivered exceptional work on our app redesign. Communication was great and they exceeded all expectations.",
      projectName: "Mobile App Redesign"
    },
    {
      id: "2",
      reviewerName: "Jordan Smith",
      reviewerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan",
      rating: 5,
      date: "Oct 28, 2023",
      text: "Incredible attention to detail and very responsive. Would definitely hire again!",
      projectName: "E-commerce Website"
    },
    {
      id: "3",
      reviewerName: "Casey Brown",
      reviewerAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Casey",
      rating: 4,
      date: "Oct 10, 2023",
      text: "Great designer with solid skills. Delivered on time and was easy to work with.",
      projectName: "Brand Identity"
    }
  ]
};

export default function TalentPublicProfile() {
  const { userId } = useParams();

  const handleHire = () => {
    toast.success(`Hire request sent to ${mockTalent.name}!`);
  };

  const handleMessage = () => {
    toast.info("Opening conversation...");
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-4 w-4 ${i < rating ? 'fill-warning text-warning' : 'text-muted'}`} 
      />
    ));
  };

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="glass-card overflow-hidden">
          {/* Cover */}
          <div className="h-32 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30" />
          
          {/* Profile Info */}
          <div className="p-6 -mt-12">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <Avatar className="h-24 w-24 border-4 border-background">
                <AvatarImage src={mockTalent.avatarUrl} />
                <AvatarFallback className="text-2xl">{getInitials(mockTalent.name)}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-foreground">{mockTalent.name}</h1>
                <p className="text-muted-foreground">{mockTalent.professionalTitle}</p>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {mockTalent.location}
                  </div>
                  <Badge variant="outline" className="text-success border-success">
                    {mockTalent.availability}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleMessage} className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Message
                </Button>
                <Button variant="glow" onClick={handleHire} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Hire {mockTalent.name.split(' ')[0]}
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-border">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="font-medium">{mockTalent.projectsCompleted}</span>
                <span className="text-muted-foreground">Projects Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-warning fill-warning" />
                <span className="font-medium">{mockTalent.rating}/5.0</span>
                <span className="text-muted-foreground">({mockTalent.reviewCount} reviews)</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium">{mockTalent.responseTime}</span>
                <span className="text-muted-foreground">Response Time</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-6">
            {/* About */}
            <section className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">About</h2>
              <p className="text-muted-foreground leading-relaxed">{mockTalent.bio}</p>
            </section>

            {/* Skills */}
            <section className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {mockTalent.skills.map(skill => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </section>

            {/* Portfolio */}
            <section className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Portfolio</h2>
              <div className="space-y-2">
                {mockTalent.portfolioLinks.map((link, index) => (
                  <a
                    key={index}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4 text-primary" />
                    <span className="text-foreground truncate">{link}</span>
                  </a>
                ))}
              </div>
            </section>

            {/* Reviews */}
            <section className="glass-card p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Client Reviews</h2>
              
              {/* Rating Summary */}
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
                <div className="text-center">
                  <p className="text-4xl font-bold text-foreground">{mockTalent.rating}</p>
                  <div className="flex gap-0.5 mt-1">
                    {renderStars(Math.round(mockTalent.rating))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{mockTalent.reviewCount} reviews</p>
                </div>
                <div className="flex-1 space-y-2">
                  {[5, 4, 3, 2, 1].map(stars => (
                    <div key={stars} className="flex items-center gap-2">
                      <span className="text-sm w-3">{stars}</span>
                      <Star className="h-3 w-3 text-warning fill-warning" />
                      <Progress 
                        value={stars === 5 ? 70 : stars === 4 ? 25 : stars === 3 ? 5 : 0} 
                        className="h-2 flex-1" 
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Review List */}
              <div className="space-y-4">
                {mockTalent.reviews.map(review => (
                  <div key={review.id} className="pb-4 border-b border-border last:border-0">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={review.reviewerAvatar} />
                        <AvatarFallback>{getInitials(review.reviewerName)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-foreground">{review.reviewerName}</p>
                          <span className="text-sm text-muted-foreground">{review.date}</span>
                        </div>
                        <div className="flex gap-0.5 mt-1">
                          {renderStars(review.rating)}
                        </div>
                        <p className="text-muted-foreground mt-2">{review.text}</p>
                        <p className="text-sm text-muted-foreground mt-1 italic">Project: {review.projectName}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Hourly Rate */}
            <div className="glass-card p-6">
              <p className="text-sm text-muted-foreground">Hourly Rate</p>
              <p className="text-3xl font-bold text-foreground">${mockTalent.hourlyRate}/hr</p>
            </div>

            {/* Social Links */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-foreground mb-4">Connect</h3>
              <div className="flex gap-2">
                {mockTalent.socialLinks.linkedin && (
                  <a 
                    href={mockTalent.socialLinks.linkedin} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                )}
                {mockTalent.socialLinks.twitter && (
                  <a 
                    href={mockTalent.socialLinks.twitter} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors"
                  >
                    <Twitter className="h-5 w-5" />
                  </a>
                )}
                {mockTalent.socialLinks.github && (
                  <a 
                    href={mockTalent.socialLinks.github} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
