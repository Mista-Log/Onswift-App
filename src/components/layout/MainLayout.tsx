import { ReactNode } from "react";
import { AppSidebar, TopBar } from "./AppSidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-gradient-radial">
      <AppSidebar />
      
      <div className="ml-20 flex flex-1 flex-col">
        <TopBar />
        
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
