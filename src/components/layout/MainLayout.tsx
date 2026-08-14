import { ReactNode, useState, useEffect } from "react";
import { AppSidebar, TopBar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { QuickStartLauncher } from "@/components/quickstart/QuickStartLauncher";

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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed');
    return stored ? JSON.parse(stored) : false;
  });

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <div className="flex min-h-screen w-full bg-gradient-radial">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <AppSidebar isCollapsed={isCollapsed} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed left-0 top-0 h-full z-50 md:hidden transition-transform duration-300 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AppSidebar isCollapsed={false} onClose={toggleMobileSidebar} />
      </div>

      <div
        className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <div className={hideTopBarOnMobile ? "hidden md:block" : undefined}>
          <TopBar
            onToggleSidebar={toggleSidebar}
            onToggleMobileSidebar={toggleMobileSidebar}
            isCollapsed={isCollapsed}
          />
        </div>

        <main className="flex-1 min-w-0 overflow-x-hidden p-4">
        
          {typeof children === "function" ? children({ toggleMobileSidebar }) : children}
        </main>
      </div>

      {/* Creator-only guided onboarding launcher (fixed, bottom-right) */}
      {user?.role === "creator" && <QuickStartLauncher />}
    </div>
  );
}
