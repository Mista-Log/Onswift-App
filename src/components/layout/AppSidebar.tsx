import { LayoutGrid, Users, UsersRound, FolderKanban, Calendar, Settings, Search, Bell, LogOut, User, Menu, X, ChevronLeft, ChevronRight, MessageCircle, Upload } from "lucide-react";
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
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";

const creatorNavItems = [
  { label: "Workspace", icon: LayoutGrid, route: "/dashboard" },
  { label: "Browse Talent", icon: Users, route: "/talent" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Projects", icon: FolderKanban, route: "/projects" },
  { label: "Deadlines", icon: Calendar, route: "/calendar" },
];

const talentNavItems = [
  { label: "Dashboard", icon: LayoutGrid, route: "/dashboard" },
  { label: "My Profile", icon: User, route: "/profile/edit" },
  { label: "My Projects", icon: FolderKanban, route: "/projects" },
  { label: "Deliverables", icon: Upload, route: "/deliverables" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Deadlines", icon: Calendar, route: "/calendar" },
];

const bottomNavItems = [
  { label: "Settings", icon: Settings, route: "/settings" },
];

interface AppSidebarProps {
  isCollapsed?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ isCollapsed = false, onClose }: AppSidebarProps) {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = user?.role === 'talent' ? talentNavItems : creatorNavItems;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar py-6 transition-all duration-300",
        isCollapsed ? "w-20 items-center" : "w-64 px-4"
      )}
    >
      {/* Close button for mobile */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 md:hidden p-2 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Logo */}
      <div className={cn("mb-8", isCollapsed ? "px-0" : "px-2")}>
        {isCollapsed ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-glow">
            O
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-glow">
              O
            </div>
            <span className="text-xl font-bold text-foreground">
              OnSwift
            </span>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className={cn("flex flex-1 flex-col gap-2", isCollapsed ? "items-center" : "")}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.route ||
            (item.route !== "/dashboard" && location.pathname.startsWith(item.route));

          return (
            <NavLink
              key={item.route}
              to={item.route}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl transition-all duration-300",
                isCollapsed ? "h-12 w-12 justify-center" : "h-12 px-4",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <nav className={cn("flex flex-col gap-2", isCollapsed ? "items-center" : "")}>
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.route;

          return (
            <NavLink
              key={item.route}
              to={item.route}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl transition-all duration-300",
                isCollapsed ? "h-12 w-12 justify-center" : "h-12 px-4",
                isActive
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}

              {isCollapsed && (
                <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block whitespace-nowrap">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

interface TopBarProps {
  onToggleSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
  isCollapsed?: boolean;
}

export function TopBar({ onToggleSidebar, onToggleMobileSidebar, isCollapsed }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const profilePicture = user?.profilePicture;



  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-4 md:px-6 backdrop-blur-xl">
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Menu Button */}
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>

        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects, team..."
            className="h-10 w-full rounded-full border-border/50 bg-secondary/50 pl-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        <NotificationDropdown />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 md:gap-3 rounded-full pr-0 md:pr-2 hover:bg-secondary/50 transition-colors">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user?.profilePicture || ""} />
              <AvatarFallback>
                {user?.full_name
                  ?.split(" ")
                  .map(n => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
              <span className="hidden lg:block text-sm font-medium text-foreground">
                {user?.full_name?.split(' ')[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <p className="text-xs text-primary capitalize mt-1">{user?.role}</p>
            </div>
            <DropdownMenuSeparator />
            {user?.role === 'talent' && (
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
