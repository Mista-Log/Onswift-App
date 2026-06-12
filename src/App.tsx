import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import SignUpCreator from "./pages/auth/SignUpCreator";
import SignUpTalent from "./pages/auth/SignUpTalent";
import ForgotPassword from "./pages/auth/ForgotPassword";

// Protected pages
import Dashboard from "./pages/Dashboard";
import TalentMarketplace from "./pages/TalentMarketplace";
import Team from "./pages/Team";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import TalentProfileEdit from "./pages/TalentProfileEdit";
import CreatorProfileEdit from "./pages/CreatorProfileEdit";
import TalentPublicProfile from "./pages/TalentPublicProfile";
import Messages from "./pages/Messages";
import Deliverables from "./pages/Deliverables";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/auth/ResetPassword";
import GoogleOAuthCallback from "./pages/auth/GoogleOAuthCallback";

// Onboarding (creator)
import OnboardingTemplates from "./pages/onboarding/OnboardingFormPage";
import OnboardingBuilder from "./pages/onboarding/OnboardingBuilder";
import ClientHistoryPage from "./pages/onboarding/ClientHistoryPage";
// Onboarding (public client-facing)
import ClientOnboard from "./pages/onboarding/ClientOnboard";

// Client workspace pages (unified shell)
import ClientProjects from "./pages/client/ClientProjects";
import ClientProjectDetail from "./pages/client/ClientProjectDetail";
import ClientMessages from "./pages/client/ClientMessages";
import ClientPortalView from "./pages/client/ClientPortalView";

// Invite acceptance
import InviteAccept from "./pages/client/InviteAccept";

// Library & CRM
import DocumentLibrary from "./pages/library/DocumentLibrary";
import CRMBuilder from "./pages/tools/CRMBuilder";

// Docs editor
import DocsPage from "./pages/docs/DocsPage";

// Analytics
import { PageTracker } from "./components/analytics/PageTracker";

/** Role-based router for /projects */
function ProjectsRoute() {
  const { user } = useAuth();
  if (user?.role === 'client') return <ClientProjects />;
  return <Projects />;
}

/** Role-based router for /projects/:id */
function ProjectDetailRoute() {
  const { user } = useAuth();
  if (user?.role === 'client') return <ClientProjectDetail />;
  return <ProjectDetail />;
}

/** Role-based router for /onboarding */
function OnboardingRoute() {
  const { user } = useAuth();
  if (user?.role === 'client') return <ClientPortalView />;
  return <OnboardingTemplates />;
}

/** Redirects /portal/:projectId → /projects/:projectId */
function PortalDetailRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}`} replace />;
}

/** Redirects /portal/:projectId/messages → /projects/:projectId/messages */
function PortalMessagesRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/messages`} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProjectProvider>
          <TeamProvider>
            <NotificationProvider>
              <ThemeProvider attribute="class" defaultTheme="light">
                <Toaster />
                <Sonner />
                <Analytics />
                <BrowserRouter>
                  <PageTracker />
                  <Routes>
                    {/* Public routes */}
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/signup/creator" element={<SignUpCreator />} />
                    <Route path="/signup/talent" element={<SignUpTalent />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />

                    {/* Protected routes — unified shell, role-filtered nav */}
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/talent" element={<ProtectedRoute><TalentMarketplace /></ProtectedRoute>} />
                    <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
                    <Route path="/projects" element={<ProtectedRoute><ProjectsRoute /></ProtectedRoute>} />
                    {/* Client messages route must precede /:id to avoid param collision */}
                    <Route path="/projects/:projectId/messages" element={<ProtectedRoute><ClientMessages /></ProtectedRoute>} />
                    <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetailRoute /></ProtectedRoute>} />
                    <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/profile/edit" element={<ProtectedRoute><TalentProfileEdit /></ProtectedRoute>} />
                    <Route path="/profile/creator/edit" element={<ProtectedRoute><CreatorProfileEdit /></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                    <Route path="/deliverables" element={<ProtectedRoute><Deliverables /></ProtectedRoute>} />
                    <Route path="/talent/:userId" element={<ProtectedRoute><TalentPublicProfile /></ProtectedRoute>} />
                    <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
                    <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />

                    {/* Onboarding — role-aware (creator builds, client previews their submission) */}
                    <Route path="/onboarding" element={<ProtectedRoute><OnboardingRoute /></ProtectedRoute>} />
                    <Route path="/onboarding/new" element={<ProtectedRoute><OnboardingBuilder /></ProtectedRoute>} />
                    <Route path="/onboarding/clients" element={<ProtectedRoute><ClientHistoryPage /></ProtectedRoute>} />
                    <Route path="/onboarding/:id" element={<ProtectedRoute><OnboardingBuilder /></ProtectedRoute>} />

                    {/* Onboarding — public client page */}
                    <Route path="/onboard/:slug" element={<ClientOnboard />} />

                    {/* Invite acceptance — public, token-based */}
                    <Route path="/invite/:token" element={<InviteAccept />} />

                    {/* Legacy portal routes — hard redirect to unified shell */}
                    <Route path="/portal" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/portal/:projectId/messages" element={<PortalMessagesRedirect />} />
                    <Route path="/portal/:projectId" element={<PortalDetailRedirect />} />

                    {/* Library & CRM — all roles */}
                    <Route path="/library" element={<ProtectedRoute><DocumentLibrary /></ProtectedRoute>} />
                    <Route path="/library/crm" element={<ProtectedRoute><CRMBuilder /></ProtectedRoute>} />
                    {/* Legacy CRM path redirect */}
                    <Route path="/tools/crm" element={<Navigate to="/library/crm" replace />} />

                    {/* Docs editor — creator + talent */}
                    <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
                    <Route path="/docs/:docId" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />

                    {/* Catch-all */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </ThemeProvider>
            </NotificationProvider>
          </TeamProvider>
        </ProjectProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
