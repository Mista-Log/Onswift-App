import { House, Users, Rocket, Clock, Settings, Search, Bell, LogOut, User, UserRoundPlus, X, MessageCircle, ClipboardList, Files, Wrench, Loader2, BarChart3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useDeadlineCount } from "@/hooks/useDeadlineCount";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
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
import { SyncStatusPill } from "@/components/layout/SyncStatusPill";
import { useTheme } from "next-themes";

const creatorNavItems = [
  { label: "Workspace", icon: House, route: "/dashboard" },
  { label: "Projects", icon: Rocket, route: "/projects" },
  { label: "Analytics", icon: BarChart3, route: "/analytics" },
  { label: "Teams", icon: Users, route: "/team" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Client Portal", icon: UserRoundPlus, route: "/onboarding" },
  { label: "Forms", icon: ClipboardList, route: "/forms" },
  { label: "Files", icon: Files, route: "/library" },
  { label: "Deadlines", icon: Clock, route: "/calendar" },
  // { label: "Notifications", icon: Bell, route: "/notifications" },
  // { label: "Marketplace", icon: Users, route: "/talent" },
];

const clientNavItems = [
  { label: "Dashboard", icon: House, route: "/dashboard" },
  // { label: "Projects", icon: Rocket, route: "/projects" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "Client Portal", icon: ClipboardList, route: "/onboarding" },
  { label: "Docs", icon: Files, route: "/library" },
  //{ label: "CRM", icon: Wrench, route: "/library/crm" },
  { label: "Deadlines", icon: Clock, route: "/calendar" },
  // { label: "Notifications", icon: Bell, route: "/notifications" },
];

const talentNavItems = [
  { label: "Dashboard", icon: House, route: "/dashboard" },
  { label: "My Profile", icon: User, route: "/profile/edit" },
  { label: "My Projects", icon: Rocket, route: "/projects" },
  { label: "Chats", icon: MessageCircle, route: "/messages" },
  { label: "My Files", icon: Files, route: "/library" },
  //{ label: "CRM", icon: Wrench, route: "/library/crm" },
  { label: "Deadlines", icon: Clock, route: "/calendar" },
  // { label: "Notifications", icon: Bell, route: "/notifications" },
];

const toolNavItems = [
  // { label: "CRM", icon: Wrench, route: "/library/crm" },
];

type NavItem = { label: string; icon: React.ComponentType<{ className?: string }>; route: string };

interface AppSidebarProps {
  isCollapsed?: boolean;
  /** Set for the mobile drawer instance — always renders fully expanded, as a plain (non-fixed) element. */
  isMobile?: boolean;
  /** Expands the sidebar out of its collapsed (icon-only) state — used by the collapsed search button. */
  onExpand?: () => void;
}

export function AppSidebar({ isCollapsed = false, isMobile, onExpand }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const deadlineCount = useDeadlineCount();
  const unreadChatCount = useUnreadChatCount();
  const { query, setQuery, results, loading, open, setOpen, clear } = useGlobalSearch();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingFocus, setPendingFocus] = useState(false);
  // Mobile instance is always fully expanded when visible; desktop follows the pinned state.
  const expanded = isMobile ? true : !isCollapsed;

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

  // Close results dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [setOpen]);

  // Clicking the collapsed search icon expands the sidebar; once expanded, focus the input.
  useEffect(() => {
    if (!isCollapsed && pendingFocus) {
      inputRef.current?.focus();
      setPendingFocus(false);
    }
  }, [isCollapsed, pendingFocus]);

  const handleSelect = (r: SearchResult) => {
    clear();
    navigate(r.route);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems =
    user?.role === 'talent' ? talentNavItems :
    user?.role === 'client' ? clientNavItems :
    creatorNavItems;
  const showTools = user?.role === "creator";
  const [firstNavItem, ...restNavItems] = navItems;

  const renderNavItem = (item: NavItem) => {
    const isActive = location.pathname === item.route ||
      (item.route !== "/dashboard" && location.pathname.startsWith(item.route));
    const badgeCount =
      item.route === "/calendar" ? deadlineCount :
      item.route === "/messages" ? unreadChatCount : 0;
    const showBadge = badgeCount > 0;
    const badgeLabel = badgeCount > 99 ? "99+" : badgeCount;

    return (
      <NavLink
        key={item.route}
        to={item.route}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl transition-all duration-300",
          expanded ? "h-12 px-4" : "h-12 w-12 justify-center",
          isActive
            ? "bg-primary text-primary-foreground shadow-glow"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="h-5 w-5 flex-shrink-0" />
        {expanded && (
          <span className="font-medium">{item.label}</span>
        )}

        {/* Count badge (deadlines / unread chats) — inline when expanded, on the icon when collapsed */}
        {showBadge && (
          <span
            className={cn(
              "flex items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm",
              expanded
                ? "ml-auto h-5 min-w-[20px]"
                : "absolute right-1 top-1 h-[18px] min-w-[18px]"
            )}
          >
            {badgeLabel}
          </span>
        )}

        {/* Tooltip for collapsed state */}
        {!expanded && (
          <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block whitespace-nowrap">
            {item.label}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-dvh flex-col rounded-b-3xl border border-sidebar-border bg-sidebar py-6 overflow-hidden transition-all duration-300",
        !isMobile ? "fixed left-0 top-0 z-40" : "relative",
        isMobile ? "w-full px-4" : expanded ? "w-64 px-4" : "w-20 items-center"
      )}
    >
      {/* Logo */}
      <div className={cn("mb-8", expanded ? "px-2" : "px-0")}>
        {!expanded ? (
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
              {/* <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-0.5">
                Beta 2.0
              </span> */}
            </div>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Main Navigation */}
        <nav className={cn("flex flex-1 flex-col gap-2 overflow-y-auto", !expanded ? "items-center" : "")}>
          {renderNavItem(firstNavItem)}

          {/* Global Search — directly under Workspace */}
          {!expanded ? (
            <button
              onClick={() => { setPendingFocus(true); onExpand?.(); }}
              className="group relative flex h-12 w-12 items-center justify-center rounded-xl text-muted-foreground transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Search className="h-5 w-5 flex-shrink-0" />
              <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block whitespace-nowrap">
                Search
              </span>
            </button>
          ) : (
            <div ref={containerRef} className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => { if (query.length >= 2) setOpen(true); }}
                onKeyDown={(e) => { if (e.key === "Escape") { clear(); inputRef.current?.blur(); } }}
                placeholder="Search docs, files…"
                className="h-10 w-full rounded-full border-border/50 bg-secondary/50 pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
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
          )}

          {restNavItems.map((item) => renderNavItem(item))}
        </nav>

        {showTools && (
          <nav className={cn("mt-4 flex flex-col gap-2", !expanded ? "items-center" : "") }>
            {/* We'll suspend thid for now, since we don't have any tools yet. We can re-enable it when we add more tools.
            {expanded && (
              <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Tools
              </p>
            )} */}

            {toolNavItems.map((item) => {
              const isActive = location.pathname === item.route || location.pathname.startsWith(item.route);

              return (
                <NavLink
                  key={item.route}
                  to={item.route}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl transition-all duration-300",
                    expanded ? "h-12 px-4" : "h-12 w-12 justify-center",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {expanded && (
                    <span className="font-medium">{item.label}</span>
                  )}

                  {!expanded && (
                    <span className="absolute left-full ml-3 hidden rounded-lg bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-lg group-hover:block whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        )}

        {/* Profile — replaces the old standalone Settings nav link */}
        <div className={cn("mt-6", !expanded ? "flex flex-col items-center" : "")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl text-muted-foreground transition-all duration-300 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                  expanded ? "h-12 w-full px-4" : "h-12 w-12 justify-center"
                )}
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
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
                {expanded && (
                  <span className="font-medium truncate">{user?.full_name}</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
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
      </div>
    </aside>
  );
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

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end border-b border-border/50 bg-background/80 px-4 md:px-6 backdrop-blur-xl">
      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        <SyncStatusPill />
        <NotificationDropdown />
      </div>
    </header>
  );
}
