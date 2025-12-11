import { Link, Navigate } from 'react-router-dom';
import { Crown, Zap, ArrowRight, Sparkles, Users, Rocket, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const particlesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create animated particles
    if (particlesRef.current) {
      const particleCount = 50;
      for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        particle.style.animationDuration = `${10 + Math.random() * 20}s`;
        particlesRef.current.appendChild(particle);
      }
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-secondary/30 to-background">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-radial opacity-50" />

      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="gradient-orb gradient-orb-1" />
        <div className="gradient-orb gradient-orb-2" />
        <div className="gradient-orb gradient-orb-3" />
      </div>

      {/* Particles */}
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-6 animate-slide-down">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shadow-glow animate-pulse-glow">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              On<span className="text-primary">Swift</span>
            </h1>
            <Link to="/login">
              <Button variant="outline" className="border-primary/30 hover:border-primary backdrop-blur-sm">
                Sign In
              </Button>
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="max-w-5xl mx-auto text-center space-y-8 animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm animate-slide-up">
              <Rocket className="w-4 h-4 text-primary animate-bounce-slow" />
              <span className="text-sm font-medium text-primary">The Future of Creative Collaboration</span>
            </div>

            <div className="space-y-6">
              <h2 className="text-5xl md:text-7xl font-bold text-foreground leading-tight animate-text-shimmer">
                Build Your{' '}
                <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent animate-gradient-x">
                  Dream Team
                </span>
              </h2>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Connect premium creators with world-class talent. Manage projects, track deliverables, and collaborate seamlessly in one beautiful platform.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-slide-up">
              <Link to="/signup">
                <Button variant="glow" size="lg" className="w-full sm:w-auto text-lg px-8 group">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 border-primary/30 backdrop-blur-sm hover:bg-primary/10">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-12 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">10k+</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">5k+</div>
                <div className="text-sm text-muted-foreground">Projects</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">98%</div>
                <div className="text-sm text-muted-foreground">Satisfaction</div>
              </div>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 pt-16 text-left max-w-5xl mx-auto">
              <div className="glass-card-hover p-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4 animate-float">
                  <Crown className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">For Creators</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Pre-vetted talent network
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Seamless project management
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Real-time collaboration
                  </li>
                </ul>
              </div>

              <div className="glass-card-hover p-8 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4 animate-float" style={{ animationDelay: '0.2s' }}>
                  <Zap className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">For Talent</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Showcase your portfolio
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Work with premium brands
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Guaranteed payments
                  </li>
                </ul>
              </div>

              <div className="glass-card-hover p-8 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-4 animate-float" style={{ animationDelay: '0.4s' }}>
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">For Everyone</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Intuitive interface
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    24/7 support
                  </li>
                  <li className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                    Secure platform
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center text-muted-foreground text-sm animate-fade-in">
          <p>© 2024 OnSwift. All rights reserved.</p>
        </footer>
      </div>

      <style>{`
        /* Animated Gradient Orbs */
        .gradient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.3;
          animation: float-orb 20s infinite ease-in-out;
        }

        .gradient-orb-1 {
          width: 500px;
          height: 500px;
          background: linear-gradient(45deg, hsl(var(--primary)), hsl(var(--primary) / 0.3));
          top: -10%;
          left: -10%;
          animation-delay: 0s;
        }

        .gradient-orb-2 {
          width: 400px;
          height: 400px;
          background: linear-gradient(135deg, hsl(280 100% 70% / 0.5), hsl(var(--primary) / 0.3));
          bottom: -10%;
          right: -10%;
          animation-delay: -7s;
        }

        .gradient-orb-3 {
          width: 300px;
          height: 300px;
          background: linear-gradient(225deg, hsl(var(--primary) / 0.4), hsl(200 100% 70% / 0.3));
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -14s;
        }

        @keyframes float-orb {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(100px, -100px) scale(1.1);
          }
          66% {
            transform: translate(-100px, 100px) scale(0.9);
          }
        }

        /* Particles */
        .particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background: hsl(var(--primary));
          border-radius: 50%;
          opacity: 0.5;
          animation: particle-float linear infinite;
          box-shadow: 0 0 10px hsl(var(--primary));
        }

        @keyframes particle-float {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.5;
          }
          90% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100vh) translateX(50px);
            opacity: 0;
          }
        }

        /* Grid Pattern */
        .bg-grid-pattern {
          background-image:
            linear-gradient(hsl(var(--primary) / 0.1) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary) / 0.1) 1px, transparent 1px);
          background-size: 50px 50px;
        }

        /* Animations */
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px hsl(var(--primary) / 0.5);
          }
          50% {
            box-shadow: 0 0 30px hsl(var(--primary) / 0.8);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        .animate-slide-down {
          animation: slide-down 0.6s ease-out;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out;
          animation-fill-mode: both;
        }

        .animate-slide-up {
          animation: slide-up 0.8s ease-out 0.4s;
          animation-fill-mode: both;
        }

        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .animate-text-shimmer {
          animation: fade-in-up 0.8s ease-out;
        }
      `}</style>
    </div>
  );
}
