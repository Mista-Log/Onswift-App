import { Link, Navigate } from 'react-router-dom';
import { Crown, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function SignUp() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-radial flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-12 shadow-glow">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex flex-col items-center gap-3 mb-6">
              <img
                src="/onswift%20logo.png"
                alt="OnSwift logo"
                className="h-14 w-14 object-contain"
              />
              
            </Link>
            <h2 className="text-2xl font-semibold text-foreground">Join OnSwift</h2>
            <p className="text-muted-foreground mt-2">Choose how you want to get started</p>
          </div>

          {/* Role Selection */}
          <div className="space-y-4">
            <Link to="/signup/creator" className="block">
              <div className="bg-secondary/50 border border-border/50 rounded-xl p-6 hover:border-primary/50 hover:bg-secondary/70 transition-all duration-300 hover:shadow-glow cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">I'm a Creator</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      I want to hire and manage talent for my projects
                    </p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/signup/talent" className="block">
              <div className="bg-secondary/50 border border-border/50 rounded-xl p-6 hover:border-primary/50 hover:bg-secondary/70 transition-all duration-300 hover:shadow-glow cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">I'm a Talent</h3>
                    <p className="text-muted-foreground text-sm mt-1">
                      I want to offer my services and work on projects
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Footer */}
          <p className="text-center text-muted-foreground mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
