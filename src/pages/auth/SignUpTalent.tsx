import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { User, Mail, Briefcase, Lock, Eye, EyeOff, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const SKILL_OPTIONS = [
  'UI/UX Design', 'Web Development', 'Mobile Development',
  'Graphic Design', 'Video Editing', 'Content Writing',
  'Social Media', 'SEO/SEM', 'Project Management',
  'Brand Strategy', 'Copywriting', '3D Design',
  'Animation', 'Photography', 'Illustration'
];

export default function SignUpTalent() {
  const navigate = useNavigate();
  const { signup, isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    professionalTitle: '',
    skills: [] as string[],
    primarySkill: '',
    password: '',
    confirmPassword: '',
    termsAgreed: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [customSkillInput, setCustomSkillInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.professionalTitle.trim()) newErrors.professionalTitle = 'Professional title is required';
    if (!formData.primarySkill.trim()) newErrors.primarySkill = 'Primary skill is required';
    if (formData.skills.length === 0) newErrors.skills = 'Select at least one skill';
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

  const toggleSkill = (skill: string) => {
    if (formData.skills.includes(skill)) {
      setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
    } else if (formData.skills.length < 5) {
      setFormData({ ...formData, skills: [...formData.skills, skill] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const result = await signup({
      name: formData.name,
      email: formData.email,
      professionalTitle: formData.professionalTitle,
      primarySkill: formData.primarySkill,
      skills: formData.skills,
      userType: 'talent',
      password: formData.password,
    });
    setIsLoading(false);

    if (result.success) {
      toast({ title: 'Account created!', description: 'Welcome to OnSwift.' });
      navigate('/dashboard');
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const strength = getPasswordStrength();

  return (
    <div className="min-h-screen bg-gradient-radial flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-12 shadow-glow">
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-6">
              <h1 className="text-2xl font-bold text-foreground">
                On<span className="text-primary">Swift</span>
              </h1>
            </Link>
            
            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-8 h-0.5 bg-primary" />
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div className="w-8 h-0.5 bg-border" />
              <div className="w-3 h-3 rounded-full bg-border" />
            </div>
            
            <h2 className="text-2xl font-semibold text-foreground">Create Talent Account</h2>
            <p className="text-muted-foreground mt-2">Set up your profile to start working</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Jane Smith"
                  className="pl-10"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              {errors.name && <p className="text-destructive text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  className="pl-10"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Professional Title</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="UI/UX Designer"
                  className="pl-10"
                  value={formData.professionalTitle}
                  onChange={(e) => setFormData({ ...formData, professionalTitle: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">What do you specialize in?</p>
              {errors.professionalTitle && <p className="text-destructive text-sm mt-1">{errors.professionalTitle}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Primary Skill
              </label>

              {/* Display Selected Skill */}
              {formData.primarySkill && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                    {formData.primarySkill}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, primarySkill: '' });
                        setCustomSkillInput('');
                      }}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              )}

              {/* Skill Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSkillDropdown(!showSkillDropdown)}
                  className="w-full px-3 py-2 text-left bg-secondary/50 border border-border rounded-lg text-muted-foreground hover:border-primary/50 transition-colors"
                  disabled={!!formData.primarySkill}
                >
                  {formData.primarySkill || 'Select your primary skill'}
                </button>

                {showSkillDropdown && !formData.primarySkill && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {SKILL_OPTIONS.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, primarySkill: skill });
                          setShowSkillDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors text-foreground"
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Skill Input */}
              {!formData.primarySkill && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Or type your own:</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter custom skill"
                      value={customSkillInput}
                      onChange={(e) => setCustomSkillInput(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (customSkillInput.trim()) {
                          setFormData({ ...formData, primarySkill: customSkillInput.trim() });
                          setCustomSkillInput('');
                        }
                      }}
                      disabled={!customSkillInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
              {errors.primarySkill && <p className="text-destructive text-sm mt-1">{errors.primarySkill}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Additional Skills <span className="text-muted-foreground">(Select up to 5)</span>
              </label>

              {/* Selected Skills */}
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                      {skill}
                      <button type="button" onClick={() => toggleSkill(skill)} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Skill Selector Dropdown */}
              <div className="relative">
                <select
                  className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-foreground hover:border-primary/50 transition-colors"
                  onChange={(e) => {
                    if (e.target.value && formData.skills.length < 5) {
                      toggleSkill(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  disabled={formData.skills.length >= 5}
                >
                  <option value="">
                    {formData.skills.length >= 5 ? '5/5 skills selected' : 'Select additional skills'}
                  </option>
                  {SKILL_OPTIONS.filter(skill => !formData.skills.includes(skill) && skill !== formData.primarySkill).map(skill => (
                    <option key={skill} value={skill}>
                      {skill}
                    </option>
                  ))}
                </select>
              </div>
              {errors.skills && <p className="text-destructive text-sm mt-1">{errors.skills}</p>}
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
                'Create Talent Account'
              )}
            </Button>
          </form>

          <p className="text-center text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
