import { useState } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Loader2, Briefcase, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthImagePanel } from '@/components/auth/AuthImagePanel';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import { secureFetch } from '@/api/apiClient';
import { googleAuth } from '@/services/googleAuth';

export default function GetStarted() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, getUser } = useAuth();
  const { toast } = useToast();

  // Set when GoogleSignInButton reports a brand-new identity with no role chosen yet —
  // we ask for one here instead of silently defaulting (that's the bug this page fixes).
  const [pendingGoogleUser, setPendingGoogleUser] = useState<{
    email: string;
    full_name: string;
    credential: string;
  } | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  // Same post-login steps GoogleSignInButton already runs for the normal case — needed
  // here too since picking a role finalizes the account with a second googleAuth call
  // made directly, not through another Google popup.
  const finishGoogleLogin = async (data: { access: string; refresh: string; user: unknown }) => {
    localStorage.setItem('onswift_access', data.access);
    localStorage.setItem('onswift_refresh', data.refresh);
    localStorage.setItem('onswift_user', JSON.stringify(data.user));

    await getUser();

    const inviteToken = localStorage.getItem('invite_token');
    if (inviteToken) {
      try {
        const res = await secureFetch(`/api/v3/invites/accept/${inviteToken}/`, { method: 'POST' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast({
            title: "Couldn't join the team",
            description: body?.error || 'That invite link is no longer valid.',
            variant: 'destructive',
          });
        }
      } finally {
        localStorage.removeItem('invite_token');
      }
    }

    navigate('/dashboard', { replace: true });
  };

  const handleRoleChoice = async (role: 'creator' | 'talent') => {
    if (!pendingGoogleUser) return;
    setIsFinalizing(true);
    try {
      const data = await googleAuth(pendingGoogleUser.credential, role);
      if ('new_user' in data && data.new_user) {
        // Shouldn't happen — a role was supplied this time — but don't get stuck either way.
        toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
        return;
      }
      await finishGoogleLogin(data);
    } catch {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.08),transparent_42%),linear-gradient(180deg,#fbfaff_0%,#f4effb_100%)] lg:flex">
      <AuthImagePanel />

      <div className="flex min-h-screen flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-xl">
          <div className="rounded-[28px] border border-white/70 bg-white/92 p-7 shadow-[0_30px_90px_rgba(46,16,101,0.12)] backdrop-blur-xl md:p-10">
            <div className="text-center mb-8">
              <Link to="/" className="inline-flex flex-col items-center gap-3 mb-6">
                <img src="/onswift-purple-logo.png" alt="OnSwift logo" className="h-20 w-20 object-contain" />
              </Link>
              <h2 className="text-2xl font-semibold text-foreground">Welcome to OnSwift</h2>
              <p className="text-muted-foreground mt-2">
                {pendingGoogleUser ? "One more thing before we're done" : 'Create an account, or sign back in'}
              </p>
            </div>

            {pendingGoogleUser ? (
              <div className="space-y-4">
                <p className="text-center text-sm text-muted-foreground">
                  Are you joining as a Creator/Agency, or as Talent?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    disabled={isFinalizing}
                    onClick={() => handleRoleChoice('creator')}
                  >
                    <Briefcase className="h-5 w-5" />
                    Creator / Agency
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-20 flex-col gap-2"
                    disabled={isFinalizing}
                    onClick={() => handleRoleChoice('talent')}
                  >
                    <UserIcon className="h-5 w-5" />
                    Talent
                  </Button>
                </div>
                {isFinalizing && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Setting up your account...
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <Button type="button" variant="glow" className="w-full" onClick={() => navigate('/signup')}>
                  Create Account
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/login')}>
                  Login
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <GoogleSignInButton from={from} onNewUser={setPendingGoogleUser} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
