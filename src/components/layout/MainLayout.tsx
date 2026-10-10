import { ReactNode, useState, useEffect, useRef } from "react";
import { PanelLeft } from "lucide-react";
import { AppSidebar, TopBar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { QuickStartLauncher } from "@/components/quickstart/QuickStartLauncher";
import { CreatorUpsellBar } from "./CreatorUpsellBar";
import { DailyReportDialog } from "@/components/reminders/DailyReportDialog";

export interface MainLayoutRenderProps {
  toggleMobileSidebar: () => void;
}

interface MainLayoutProps {
  // Plain JSX for most pages. A page that opts into hideTopBarOnMobile and
  // needs to reopen the mobile sidebar drawer itself (since that button
  // normally lives in the now-hidden TopBar) can instead pass a render
  // function to get toggleMobileSidebar — a page can never consume this via
  // context, since it's the one instantiating <MainLayout>, not a descendant
  // of it.
  children: ReactNode | ((props: MainLayoutRenderProps) => ReactNode);
  // Hides the app TopBar on mobile only (desktop keeps it), letting a page's
  // own content occupy that real estate.
  hideTopBarOnMobile?: boolean;
}

export function MainLayout({ children, hideTopBarOnMobile = false }: MainLayoutProps) {
  const { user } = useAuth();
  // true = pinned collapsed (the slim rail, now the default resting state — hovering it
  // temporarily peeks it open, see AppSidebar). false = pinned open.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored ? JSON.parse(stored) : true;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const togglePin = () => {
    setIsCollapsed((prev: boolean) => !prev);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  // Swipe-left-to-close fallback on the full-screen mobile drawer, alongside the PanelLeft button.
  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleDrawerTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (deltaX < -80) setIsMobileOpen(false);
    touchStartX.current = null;
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-radial">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AppSidebar isCollapsed={isCollapsed} onExpand={() => setIsCollapsed(false)} />
      </div>

      {/* Mobile Sidebar Drawer — full-screen takeover */}
      <div
        onTouchStart={handleDrawerTouchStart}
        onTouchEnd={handleDrawerTouchEnd}
        className={`fixed left-0 top-0 h-full w-full z-50 md:hidden transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AppSidebar isCollapsed={false} isMobile />
      </div>

      {/* Panel toggle — lives here, outside AppSidebar, for both breakpoints. Mobile: opens/closes
          the drawer (stays mounted in both states, since it's now the only way to close it besides
          the swipe gesture). Desktop: floats at the sidebar's current right edge and toggles the
          pinned-collapsed state. */}
      <button
        onClick={toggleMobileSidebar}
        className="fixed top-4 left-4 z-50 md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar border border-sidebar-border text-muted-foreground"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
      {/* Invisible hover zone around the desktop toggle's position — the button itself stays
          hidden until the cursor comes near, instead of sitting there permanently. */}
      <div
        className={`group fixed top-0 z-50 hidden md:block h-16 w-16 -translate-x-1/2 ${
          isCollapsed ? 'left-20' : 'left-64'
        }`}
      >
        <button
          onClick={togglePin}
          className="absolute left-1/2 top-6 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-xl border border-sidebar-border bg-sidebar text-muted-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      </div>

      <div
        className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <CreatorUpsellBar />
        <div className={hideTopBarOnMobile ? "hidden md:block" : undefined}>
          <TopBar />
        </div>

        <main className="flex-1 min-w-0 overflow-x-hidden p-4">

          {typeof children === "function" ? children({ toggleMobileSidebar }) : children}
        </main>
      </div>

      {/* Creator-only guided onboarding launcher (fixed, bottom-right) */}
      {user?.role === "creator" && <QuickStartLauncher />}

      {/* Daily deadline report, shown once on the first open of a scheduled day */}
      <DailyReportDialog />
    </div>
  );
}
