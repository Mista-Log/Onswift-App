import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

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
import ProjectBoard from "./pages/ProjectBoard";
import TaskDetails from "./pages/TaskDetails";
import Settings from "./pages/Settings";
import Calendar from "./pages/Calendar";
import TalentProfileEdit from "./pages/TalentProfileEdit";
import CreatorProfileEdit from "./pages/CreatorProfileEdit";
import TalentPublicProfile from "./pages/TalentPublicProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ProjectProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signup/creator" element={<SignUpCreator />} />
              <Route path="/signup/talent" element={<SignUpTalent />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />

              {/* Protected routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/talent" element={<ProtectedRoute><TalentMarketplace /></ProtectedRoute>} />
              <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
              <Route path="/projects/:projectId" element={<ProtectedRoute><ProjectBoard /></ProtectedRoute>} />
              <Route path="/projects/:projectId/tasks/:taskId" element={<ProtectedRoute><TaskDetails /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/profile/edit" element={<ProtectedRoute><TalentProfileEdit /></ProtectedRoute>} />
              <Route path="/profile/creator/edit" element={<ProtectedRoute><CreatorProfileEdit /></ProtectedRoute>} />
              <Route path="/talent/:userId" element={<ProtectedRoute><TalentPublicProfile /></ProtectedRoute>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ProjectProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
