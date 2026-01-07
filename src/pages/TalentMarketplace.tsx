// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
// import { FreelancerCard } from "@/components/talent/FreelancerCard";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
// import { Search, Filter } from "lucide-react";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { toast } from "sonner";

// ============================================
// TODO: Uncomment when backend integration is ready
// ============================================
// const freelancers = [
//   {
//     id: "1",
//     name: "Maya Chen",
//     role: "3D Artist",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",
//     skills: ["Blender", "Maya", "ZBrush"],
//     bio: "Creating stunning 3D visuals and character designs for games and media. 5+ years of experience in the industry.",
//     portfolioUrl: "https://example.com",
//   },
//   {
//     id: "2",
//     name: "James Wilson",
//     role: "Motion Designer",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
//     skills: ["After Effects", "Cinema 4D", "Premiere"],
//     bio: "Bringing ideas to life through motion. Specializing in kinetic typography and dynamic transitions.",
//     portfolioUrl: "https://example.com",
//   },
//   {
//     id: "3",
//     name: "Sofia Rodriguez",
//     role: "UI/UX Designer",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sofia",
//     skills: ["Figma", "Prototyping", "User Research"],
//     bio: "Crafting intuitive digital experiences that users love. Focus on accessibility and clean design.",
//     portfolioUrl: "https://example.com",
//   },
//   {
//     id: "4",
//     name: "Kai Tanaka",
//     role: "Video Editor",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kai",
//     skills: ["Premiere Pro", "DaVinci", "Color Grading"],
//     bio: "Professional video editing with a cinematic touch. Music videos, commercials, and social content.",
//   },
//   {
//     id: "5",
//     name: "Luna Park",
//     role: "Illustrator",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
//     skills: ["Procreate", "Photoshop", "Character Design"],
//     bio: "Digital illustrator specializing in fantasy art and character design. Available for commissions.",
//     portfolioUrl: "https://example.com",
//   },
//   {
//     id: "6",
//     name: "Marcus Brown",
//     role: "Sound Designer",
//     avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marcus",
//     skills: ["Pro Tools", "Ableton", "Sound FX"],
//     bio: "Creating immersive audio landscapes for games, films, and interactive media.",
//   },
// ];

export default function TalentMarketplace() {
  // ============================================
  // TODO: Uncomment when backend integration is ready
  // ============================================
  // const navigate = useNavigate();
  // const [searchQuery, setSearchQuery] = useState("");
  // const [experienceFilter, setExperienceFilter] = useState("");

  // const filteredFreelancers = freelancers.filter((freelancer) =>
  //   freelancer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //   freelancer.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
  //   freelancer.skills.some((skill) =>
  //     skill.toLowerCase().includes(searchQuery.toLowerCase())
  //   )
  // );

  // const handleHire = (freelancerName: string) => {
  //   toast.success(`Hire request sent to ${freelancerName}!`);
  // };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Talent Marketplace</h1>
          <p className="mt-1 text-muted-foreground">
            Find and hire talented freelancers for your projects
          </p>
        </div>

        {/* Coming Soon Message */}
        <div className="glass-card flex flex-col items-center justify-center py-24">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6">
            <svg
              className="h-10 w-10 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground text-center max-w-md">
            We're working hard to bring you an amazing talent marketplace. Stay tuned!
          </p>
        </div>

        {/* ============================================ */}
        {/* TODO: Uncomment when backend integration is ready */}
        {/* ============================================ */}
        {/* Search & Filters */}
        {/* <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, skill, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 pl-10"
            />
          </div>

          <Select value={experienceFilter} onValueChange={setExperienceFilter}>
            <SelectTrigger className="h-11 w-full sm:w-48">
              <SelectValue placeholder="Experience level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="entry">Entry Level</SelectItem>
              <SelectItem value="mid">Mid Level</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="h-11 gap-2">
            <Filter className="h-4 w-4" />
            More Filters
          </Button>
        </div> */}

        {/* Freelancer Grid */}
        {/* <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFreelancers.map((freelancer) => (
            <FreelancerCard
              key={freelancer.id}
              {...freelancer}
              onHire={() => handleHire(freelancer.name)}
              onClick={() => navigate(`/talent/${freelancer.id}`)}
            />
          ))}
        </div> */}

        {/* <div className="glass-card flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium text-foreground">No freelancers found</p>
          <p className="mt-1 text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div> */}
      </div>
    </MainLayout>
  );
}
