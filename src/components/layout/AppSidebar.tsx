import { LayoutGrid, Users, UsersRound, FolderKanban, Calendar, Settings, Search, Bell, LogOut, User, Menu, X, ChevronLeft, ChevronRight, MessageCircle, Upload, ClipboardList, FileArchive, Wrench, NotebookPen, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import type { SearchResult } from "@/hooks/useGlobalSearch";
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
import { useTheme } from "next-themes";
const creatorNavItems = [
  { label: "Workspace", icon: LayoutGrid, route: "/dashboard" },
  { label: "Projects", icon: FolderKanban, route: "/projects" },
  { label: "My Team", icon: UsersRound, route: "/team" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Deliverables", icon: Upload, route: "/deliverables" },
  { label: "Client Portal", icon: ClipboardList, route: "/onboarding" },
  { label: "Files", icon: FileArchive, route: "/library" },
  { label: "Docs Editor", icon: NotebookPen, route: "/docs" },
  { label: "Deadlines", icon: Calendar, route: "/calendar" },
  { label: "Marketplace", icon: Users, route: "/talent" },
];

const clientNavItems = [
  { label: "Workspace", icon: LayoutGrid, route: "/dashboard" },
  { label: "Projects", icon: FolderKanban, route: "/projects" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Deliverables", icon: Upload, route: "/deliverables" },
  { label: "Client Portal", icon: ClipboardList, route: "/onboarding" },
  { label: "Docs", icon: FileArchive, route: "/library" },
  { label: "CRM", icon: Wrench, route: "/library/crm" },
  { label: "Deadlines", icon: Calendar, route: "/calendar" },
];

const talentNavItems = [
  { label: "Dashboard", icon: LayoutGrid, route: "/dashboard" },
  { label: "My Profile", icon: User, route: "/profile/edit" },
  { label: "My Projects", icon: FolderKanban, route: "/projects" },
  { label: "Deliverables", icon: Upload, route: "/deliverables" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Files", icon: FileArchive, route: "/library" },
  { label: "Docs Editor", icon: NotebookPen, route: "/docs" },
  { label: "CRM", icon: Wrench, route: "/library/crm" },
  { label: "Deadlines", icon: Calendar, route: "/calendar" },
];

const bottomNavItems = [
  { label: "Settings", icon: Settings, route: "/settings" },
];

const toolNavItems = [
  { label: "Spreadsheet", icon: Wrench, route: "/library/crm" },
];

interface AppSidebarProps {
  isCollapsed?: boolean;
  onClose?: () => void;
}

export function AppSidebar({ isCollapsed = false, onClose }: AppSidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();

  const navItems =
    user?.role === 'talent' ? talentNavItems :
    user?.role === 'client' ? clientNavItems :
    creatorNavItems;
  const showTools = user?.role === "creator";

  return (
    <aside
      className={cn(
        "flex h-screen flex-col rounded-b-3xl border border-sidebar-border bg-sidebar py-6 overflow-hidden transition-all duration-300",
        !onClose ? "fixed left-0 top-0 z-40" : "relative",
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
          <div className="flex items-center justify-center">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl overflow-hidden bg-transparent">
              <img
                src={resolvedTheme === "light" ? "/onswift-purple-logo.png" : "/onswift%20logo.png"}
                alt="OnSwift logo"
                className="h-24 w-24 object-contain"
              />
            </div>
          </div>
        ) : (
            <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-xl overflow-hidden bg-transparent">
              <img
                src={resolvedTheme === "light" ? "/onswift-purple-logo.png" : "/onswift%20logo.png"}
                alt="OnSwift logo"
                className="h-24 w-24 object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">OnSwift</span>
              <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5">
                Beta 2.0
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Main Navigation */}
        <nav className={cn("flex flex-1 flex-col gap-2 overflow-y-auto", isCollapsed ? "items-center" : "")}>
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

        {showTools && (
          <nav className={cn("mt-4 flex flex-col gap-2", isCollapsed ? "items-center" : "") }>
            {!isCollapsed && (
              <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Tools
              </p>
            )}

            {toolNavItems.map((item) => {
              const isActive = location.pathname === item.route || location.pathname.startsWith(item.route);

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
        )}

        {/* Bottom Navigation */}
        <nav className={cn("mt-6 flex flex-col gap-2", isCollapsed ? "items-center" : "")}>
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
      </div>
    </aside>
  );
}

interface TopBarProps {
  onToggleSidebar?: () => void;
  onToggleMobileSidebar?: () => void;
  isCollapsed?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  docs: "Pages",
  files: "Files",
  projects: "Projects",
  talents: "Talents",
  crm: "CRM Sheets",
};

function SearchDropdown({
  results,
  loading,
  query,
  onSelect,
}: {
  results: import("@/hooks/useGlobalSearch").SearchResults;
  loading: boolean;
  query: string;
  onSelect: (r: SearchResult) => void;
}) {
  const categories = (["docs", "files", "projects", "talents", "crm"] as const).filter(
    (k) => results[k]?.length > 0
  );

  return (
    <div className="absolute top-full left-0 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl z-50 max-h-[420px] overflow-y-auto">
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Searching…
        </div>
      )}
      {!loading && categories.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          No results for "{query}"
        </p>
      )}
      {categories.map((cat) => (
        <div key={cat}>
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABELS[cat]}
          </p>
          {results[cat].map((r) => (
            <button
              key={r.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left"
              onClick={() => onSelect(r)}
            >
              <span className="text-base flex-shrink-0">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function TopBar({ onToggleSidebar, onToggleMobileSidebar, isCollapsed }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { query, setQuery, results, loading, open, setOpen, clear } = useGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cmd+K / Ctrl+K focuses the search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);

  const handleSelect = (r: SearchResult) => {
    clear();
    navigate(r.route);
  };

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

        {/* Global Search */}
        <div ref={containerRef} className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => { if (query.length >= 2) setOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Escape") { clear(); inputRef.current?.blur(); } }}
            placeholder="Search docs, projects, talents… ⌘K"
            className="h-10 w-full rounded-full border-border/50 bg-secondary/50 pl-10 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
          />
          {query && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={clear}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {open && (
            <SearchDropdown
              results={results}
              loading={loading}
              query={query}
              onSelect={handleSelect}
            />
          )}
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
