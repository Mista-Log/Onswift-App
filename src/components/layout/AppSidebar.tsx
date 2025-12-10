import { LayoutGrid, Users, UsersRound, FolderKanban, Calendar, Settings, Search, Bell, LogOut, User } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Dashboard", icon: LayoutGrid, route: "/dashboard" },
  { label: "Talent", icon: Users, route: "/talent" },
  { label: "My Team", icon: UsersRound, route: "/team" },
  { label: "Projects", icon: FolderKanban, route: "/projects" },
  { label: "Calendar", icon: Calendar, route: "/calendar" },
];

const bottomNavItems = [
  { label: "Settings", icon: Settings, route: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-20 flex-col items-center border-r border-sidebar-border bg-sidebar py-6">
      {/* Logo */}
      <div className="mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-glow">
          O
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.route || 
            (item.route !== "/dashboard" && location.pathname.startsWith(item.route));
          
          return (
            <NavLink
              key={item.route}
              to={item.route}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              
              {/* Tooltip */}
              <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <nav className="flex flex-col items-center gap-2">
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.route;
          
          return (
            <NavLink
              key={item.route}
              to={item.route}
              className={cn(
                "group relative flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              
              <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl">
      {/* Search */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects, team..."
          className="h-10 w-full rounded-full border-border/50 bg-secondary/50 pl-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Bell className="h-5 w-5" />
        </button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-full pr-2 hover:bg-secondary/50 transition-colors">
              <Avatar className="h-10 w-10 border-2 border-primary/30">
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`} />
                <AvatarFallback className="bg-primary/20 text-primary">
                  {user?.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-primary capitalize mt-1">{user?.userType}</p>
            </div>
            <DropdownMenuSeparator />
            {user?.userType === 'talent' && (
              <DropdownMenuItem onClick={() => navigate('/profile/edit')}>
                <User className="mr-2 h-4 w-4" />
                My Profile
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
