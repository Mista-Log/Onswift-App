import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useAuth } from '@/contexts/AuthContext';
import { secureFetch } from '@/api/apiClient';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const { user, getUser } = useAuth();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const handleVerify = async () => {
    setError('');
    setIsVerifying(true);
    try {
      const res = await secureFetch('/api/v1/auth/verify-otp/', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error || 'Verification failed');
        return;
      }
      await getUser();
      navigate('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResent(false);
    setIsResending(true);
    try {
      await secureFetch('/api/v1/auth/resend-otp/', { method: 'POST' });
      setResent(true);
    } catch {
      setError('Could not resend the code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-radial flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-12 shadow-glow">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Verify Your Email</h2>
            <p className="text-muted-foreground mt-2">
              Enter the 6-digit code we sent to{' '}
              <span className="text-foreground">{user?.email}</span>
            </p>
          </div>

          <div className="space-y-5">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {resent && (
              <div className="bg-success/10 border border-success/30 rounded-lg p-3">
                <p className="text-success text-sm">A new code has been sent.</p>
              </div>
            )}

            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerify}
              variant="glow"
              className="w-full"
              disabled={isVerifying || code.length !== 6}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>

            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isResending ? 'Resending...' : "Didn't get a code? Resend"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
