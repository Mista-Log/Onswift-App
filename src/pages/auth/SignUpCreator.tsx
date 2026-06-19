import { useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { User, Mail, Building2, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthImagePanel } from '@/components/auth/AuthImagePanel';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { secureFetch } from '@/api/apiClient';


export default function SignUpCreator() {
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const { signup, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const locationState = location.state as { prefilledEmail?: string; prefilledName?: string } | undefined;
  
  const [formData, setFormData] = useState({
    full_name: locationState?.prefilledName || '',
    email: locationState?.prefilledEmail || '',
    company_name: '',
    password: '',
    confirmPassword: '',
    termsAgreed: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const inviteToken = new URLSearchParams(location.search).get("invite");

  if (inviteToken) {
    localStorage.setItem("invite_token", inviteToken);
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.full_name.trim()) newErrors.full_name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!formData.termsAgreed) newErrors.terms = 'You must agree to the terms';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getPasswordStrength = () => {
    const { password } = formData;
    if (!password) return { level: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-destructive' };
    if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-warning' };
    return { level: 3, label: 'Strong', color: 'bg-success' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    const result = await signup({
      full_name: formData.full_name,
      email: formData.email,
      company_name: formData.company_name,
      role: 'creator',
      password: formData.password,
    });
    setIsLoading(false);

    const inviteToken = localStorage.getItem("invite_token");

    if (inviteToken) {
        await secureFetch(
            `/api/v3/invites/accept/${inviteToken}/`,
            {
                method: "POST"
            }
        );

        localStorage.removeItem("invite_token");
    }
    
    if (result.success) {
      toast({ title: 'Account created!', description: 'Welcome to OnSwift.' });
      navigate('/signup', {
        state: {
          fromSignup: true,
          prefilledEmail: formData.email,
          prefilledName: formData.full_name,
        },
      });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_42%),linear-gradient(180deg,#fbfaff_0%,#f4effb_100%)] lg:flex">
      <AuthImagePanel />

      <div className="flex min-h-screen flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-xl">
          <div className="rounded-[28px] border border-white/70 bg-white/92 p-7 shadow-[0_30px_90px_rgba(46,16,101,0.12)] backdrop-blur-xl md:p-10">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex flex-col items-center gap-3 mb-6">
              <img
                src="/onswift-purple-logo.png"
                alt="OnSwift logo"
                className="h-14 w-14 object-contain"
              />
              <h1 className="text-2xl font-bold text-foreground">OnSwift</h1>
            </Link>
            
            {/* Stepper — Step 1 of 3: account setup */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-8 h-0.5 bg-border" />
              <div className="w-3 h-3 rounded-full bg-border" />
              <div className="w-8 h-0.5 bg-border" />
              <div className="w-3 h-3 rounded-full bg-border" />
            </div>
            
            <h2 className="text-2xl font-semibold text-foreground">Create Agency/Creator Account</h2>
            <p className="text-muted-foreground mt-2">Set up your account to start hiring talent</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  className="pl-10"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              {errors.full_name && <p className="text-destructive text-sm mt-1">{errors.full_name}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Creator Email
                {locationState?.prefilledEmail && (
                  <span className="text-xs text-muted-foreground ml-2">(from survey)</span>
                )}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="john@onswift.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Company/Brand Name <span className="text-muted-foreground">(optional)</span></label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Acme Inc."
                  className="pl-10"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  className="pl-10 pr-10"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {formData.password && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i <= strength.level ? strength.color : 'bg-border'}`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</p>
                </div>
              )}
              {errors.password && <p className="text-destructive text-sm mt-1">{errors.password}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  className="pl-10"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>
              {errors.confirmPassword && <p className="text-destructive text-sm mt-1">{errors.confirmPassword}</p>}
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="terms"
                checked={formData.termsAgreed}
                onCheckedChange={(checked) => setFormData({ ...formData, termsAgreed: checked as boolean })}
                className="mt-1"
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer">
                I agree to the{' '}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
              </label>
            </div>
            {errors.terms && <p className="text-destructive text-sm">{errors.terms}</p>}

            <Button type="submit" variant="glow" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Creator Account'
              )}
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <GoogleSignInButton
              from={from}
              role="creator"
            />

          </form>

          <p className="text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">Sign In</Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
