import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Crown, Lightbulb, ChevronLeft, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';

// Add styles for animations
const animationStyles = `
  @keyframes vibrate {
    0%, 100% { transform: translate(0, 0) rotate(0deg); }
    10% { transform: translate(-1px, -1px) rotate(-1deg); }
    20% { transform: translate(1px, -2px) rotate(1deg); }
    30% { transform: translate(-1px, 0px) rotate(-1deg); }
    40% { transform: translate(1px, 1px) rotate(1deg); }
    50% { transform: translate(-1px, -1px) rotate(-1deg); }
    60% { transform: translate(1px, 0px) rotate(1deg); }
    70% { transform: translate(-1px, 1px) rotate(-1deg); }
    80% { transform: translate(1px, -1px) rotate(1deg); }
    90% { transform: translate(-1px, 0px) rotate(-1deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeInDelay1 {
    0% { opacity: 0; transform: translateY(10px); }
    50% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeInDelay2 {
    0% { opacity: 0; transform: translateY(10px); }
    60% { opacity: 0; transform: translateY(10px); }
    100% { opacity: 1; transform: translateY(0); }
  }

  @keyframes confetti-fall {
    to { transform: translate(var(--tx), 100vh) rotate(720deg); opacity: 0; }
  }

  .animate-vibrate {
    animation: vibrate 0.8s ease-in-out 1;
  }

  .animate-fade-in {
    animation: fadeIn 0.6s ease-out;
  }

  .animate-fade-in-delay-1 {
    animation: fadeInDelay1 0.8s ease-out;
  }

  .animate-fade-in-delay-2 {
    animation: fadeInDelay2 1s ease-out;
  }

  .confetti {
    position: fixed;
    width: 10px;
    height: 10px;
    pointer-events: none;
  }
`;

// Inject animation styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animationStyles;
  document.head.appendChild(style);
}

interface OnboardingData {
  name?: string;
  email?: string;
  step1?: string;
  step2?: string;
  step3?: string[];
  step4?: string;
  step5?: string;
}

type ScreenType = 'welcome' | 'single-select' | 'multi-select-card' | 'completion' | 'role-select' | 'text-input';

interface Screen {
  id: string;
  type: ScreenType;
  emoji?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
  step?: number;
  total_steps?: number;
  question?: string;
  options?: string[] | Array<{ label: string }>;
}

const SCREENS: Screen[] = [
  
  {
    id: 'welcome',
    type: 'welcome',
    emoji: '💜',
    title: 'Welcome Aboard',
    subtitle: 'Let\'s personalise OnSwift for you. It only takes a minute, we promise.',
    cta: 'Get started'
  },
  {
    id: 'name',
    type: 'text-input',
    step: 1,
    total_steps: 7,
    question: 'What\'s your name?',
    subtitle: 'We\'d love to know who we\'re working with.',
    cta: 'Continue'
  },
  {
    id: 'email',
    type: 'text-input',
    step: 2,
    total_steps: 7,
    question: 'What\'s your email address?',
    subtitle: 'We\'ll use this to send you updates.',
    cta: 'Continue'
  },
  {
    id: 'step-1',
    type: 'single-select',
    step: 3,
    total_steps: 7,
    question: 'What best describes you?',
    subtitle: 'Pick one that fits best.',
    options: [
      'Agency Founder',
      'Freelancer',
      'Consultant',
      'Startup Team',
      'Creative Professional',
      'Operations Manager'
    ],
    cta: 'Continue'
  },
  {
    id: 'step-2',
    type: 'single-select',
    step: 4,
    total_steps: 7,
    question: 'What would you like to use OnSwift for?',
    subtitle: 'Pick one that best describes your goal.',
    options: [
      'Manage projects',
      'Find and hire talent',
      'Organize team work',
      'Track deliverables & deadlines',
      'Run client work',
      'Build internal systems'
    ],
    cta: 'Continue'
  },
  {
    id: 'step-3',
    type: 'multi-select-card',
    step: 5,
    total_steps: 7,
    question: 'What do you want to manage inside OnSwift?',
    subtitle: 'Select all that apply.',
    options: [
      { label: 'Projects' },
      { label: 'Tasks' },
      { label: 'Deliverables' },
      { label: 'Deadlines' },
      { label: 'Team communication' },
      { label: 'Clients' },
      { label: 'Talent hiring' }
    ],
    cta: 'Continue'
  },
  {
    id: 'step-4',
    type: 'single-select',
    step: 6,
    total_steps: 7,
    question: 'Who will be using OnSwift with you?',
    subtitle: 'This helps us suggest the right workspace setup.',
    options: [
      'Just me',
      'Small team (2–5)',
      'Growing team (6–15)',
      'Multiple teams / agency',
      'Clients will also access it'
    ],
    cta: 'Continue'
  },
  {
    id: 'step-5',
    type: 'single-select',
    step: 7,
    total_steps: 7,
    question: 'How did you hear about us?',
    subtitle: 'We\'re curious — no wrong answers.',
    options: [
      'LinkedIn',
      'Twitter / X',
      'YouTube',
      'Referral',
      'Search Engine',
      'Community / Event',
      'AI Tools (ChatGPT, Perplexity, etc.)',
      'Other'
    ],
    cta: 'Finish'
  }
];

const COMPLETION_SCREEN: Screen = {
  id: 'done',
  type: 'completion',
  title: 'You\'re all set😎!',
  subtitle: 'OnSwift is ready for you. Your workspace has been personalised based on your preferences.'
};

export default function SignUp() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>({});

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const currentScreen = SCREENS[currentScreenIndex];

  const handleContinue = (value?: string | string[]) => {
    // Track onboarding progress
    if (currentScreen?.step && currentScreen?.total_steps) {
      track('onboarding_step_completed', {
        step: currentScreen.step,
        total_steps: currentScreen.total_steps,
        answer: value,
        screen_type: currentScreen.type
      });
    }

    if (currentScreen?.id === 'name' && typeof value === 'string') {
      if (value.trim().length >= 2) {
        setData(prev => ({ ...prev, name: value.trim() }));
        setCurrentScreenIndex(currentScreenIndex + 1);
      }
    } else if (currentScreen?.id === 'email' && typeof value === 'string') {
      if (/\S+@\S+\.\S+/.test(value)) {
        setData(prev => ({ ...prev, email: value.trim() }));
        setCurrentScreenIndex(currentScreenIndex + 1);
      }
    } else if (currentScreen?.type === 'welcome') {
      setCurrentScreenIndex(currentScreenIndex + 1);
    } else if (currentScreen?.type === 'single-select') {
      const stepNum = currentScreen.step === 3 ? 1 : currentScreen.step === 4 ? 2 : currentScreen.step === 6 ? 4 : currentScreen.step === 7 ? 5 : currentScreen.step;
      const dataKey = `step${stepNum}` as keyof OnboardingData;
      setData(prev => ({ ...prev, [dataKey]: value }));
      setCurrentScreenIndex(currentScreenIndex + 1);
    } else if (currentScreen?.type === 'multi-select-card') {
      setData(prev => ({ ...prev, step3: value as string[] }));
      setCurrentScreenIndex(currentScreenIndex + 1);
    }
  };

  const handleRoleSelect = (role: 'creator' | 'talent') => {
    track('role_selected', { role });
    
    // Save to Firestore asynchronously (don't block navigation)
    if (data.email) {
      import('@/lib/firebase').then(({ saveOnboardingData, sanitizeEmailForDoc }) => {
        saveOnboardingData(sanitizeEmailForDoc(data.email!), {
          full_name: data.name || 'Unknown',
          step1: data.step1,
          step2: data.step2,
          step3: data.step3,
          step4: data.step4,
          step5: data.step5,
          role
        }).catch(error => {
          console.error('Failed to save onboarding data:', error);
        });
      }).catch(error => {
        console.warn('Firebase module not available:', error);
      });
    }

    // Navigate immediately
    const navigationState = {
      onboarding: data,
      prefilledEmail: data.email,
      prefilledName: data.name
    };

    if (role === 'creator') {
      navigate('/signup/creator', { state: navigationState });
    } else {
      navigate('/signup/talent', { state: navigationState });
    }
  };

  const handleBack = () => {
    if (currentScreenIndex > 0) {
      setCurrentScreenIndex(currentScreenIndex - 1);
    }
  };

  const isShowBackButton = currentScreenIndex > 0 && currentScreen?.type !== 'role-select' && currentScreenIndex < SCREENS.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="">
          {/* Header with progress bar */}
          {currentScreen?.step && currentScreen?.total_steps && (
            <div className="border-b border-slate-200">
              <div className="px-8 pt-6 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-600">
                    Step {currentScreen.step} of {currentScreen.total_steps}
                  </span>
                  {isShowBackButton && (
                    <button
                      onClick={handleBack}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-slate-600" />
                    </button>
                  )}
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#6B5CE7] rounded-full transition-all duration-300"
                    style={{
                      width: `${(currentScreen.step / currentScreen.total_steps) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-8 py-12 md:px-12 md:py-16">
            {/* Name Input */}
            {currentScreen?.id === 'name' && (
              <TextInputScreen
                screen={currentScreen}
                onContinue={handleContinue}
                currentValue={data.name}
              />
            )}

            {/* Email Input */}
            {currentScreen?.id === 'email' && (
              <TextInputScreen
                screen={currentScreen}
                onContinue={handleContinue}
                currentValue={data.email}
              />
            )}

            {/* Welcome Screen */}
            {currentScreen?.type === 'welcome' && (
              <WelcomeScreen screen={currentScreen} onContinue={handleContinue} />
            )}

            {/* Single Select */}
            {currentScreen?.type === 'single-select' && (
              <SingleSelectScreen
                screen={currentScreen}
                onContinue={handleContinue}
                currentValue={data[`step${currentScreen.step}` as keyof OnboardingData] as string | undefined}
              />
            )}

            {/* Multi Select */}
            {currentScreen?.type === 'multi-select-card' && (
              <MultiSelectScreen
                screen={currentScreen}
                onContinue={handleContinue}
                currentValue={data.step3 as string[]}
              />
            )}

            {/* Completion Screen */}
            {currentScreenIndex === SCREENS.length && (
              <CompletionScreen
                screen={COMPLETION_SCREEN}
                onContinue={() => {
                  track('onboarding_completed', { data });
                  setCurrentScreenIndex(currentScreenIndex + 1);
                }}
                onRoleSelect={handleRoleSelect}
              />
            )}

            {/* Role Selection Screen - Hidden, kept for backwards compatibility */}
            {currentScreenIndex === SCREENS.length + 1 && (
              <RoleSelectScreen onRoleSelect={handleRoleSelect} />
            )}
          </div>
        </div>

        {/* Sign In Link */}
        {/* <p className="text-center text-slate-600 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-[#6B5CE7] hover:underline font-medium">
            Sign In
          </Link>
        </p> */}
      </div>
    </div>
  );
}

// Welcome Screen Component
function WelcomeScreen({
  screen,
  onContinue
}: {
  screen: Screen;
  onContinue: () => void;
}) {
  return (
    <div className="text-center space-y-6">
      <div className="text-8xl animate-vibrate inline-block">{screen.emoji}</div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4 animate-fade-in-delay-1">{screen.title}</h1>
      <p className="text-lg text-slate-600 mb-8 leading-relaxed animate-fade-in-delay-2 max-w-md mx-auto">{screen.subtitle}</p>
      <button
        onClick={() => onContinue()}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] transition-colors animate-fade-in-delay-2"
      >
        {screen.cta}
      </button>
    </div>
  );
}

// Text Input Screen Component (for name and email)
function TextInputScreen({
  screen,
  onContinue,
  currentValue
}: {
  screen: Screen;
  onContinue: (value: string) => void;
  currentValue?: string;
}) {
  const [input, setInput] = useState<string>(currentValue || '');
  const [error, setError] = useState('');

  const handleContinue = () => {
    let isValid = false;
    
    if (screen.id === 'name') {
      isValid = input.trim().length >= 2;
      if (!isValid) setError('Please enter a valid name (at least 2 characters)');
    } else if (screen.id === 'email') {
      isValid = /\S+@\S+\.\S+/.test(input);
      if (!isValid) setError('Please enter a valid email address');
    }

    if (isValid) {
      onContinue(input);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">{screen.question}</h2>
        <p className="text-slate-600">{screen.subtitle}</p>
      </div>

      <input
        type={screen.id === 'email' ? 'email' : 'text'}
        placeholder={screen.id === 'name' ? 'John Doe' : 'you@example.com'}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          setError('');
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') handleContinue();
        }}
        autoFocus
        className="w-full px-6 py-4 rounded-[14px] border-2 border-slate-200 focus:border-[#6B5CE7] focus:outline-none text-slate-900 placeholder-slate-400 transition-colors"
      />
      
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={handleContinue}
        disabled={!input.trim()}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {screen.cta}
      </button>
    </div>
  );
}

// Single Select Component
function SingleSelectScreen({
  screen,
  onContinue,
  currentValue
}: {
  screen: Screen;
  onContinue: (value: string) => void;
  currentValue?: string;
}) {
  const [selected, setSelected] = useState<string | undefined>(currentValue);

  const handleSelect = (option: string) => {
    setSelected(option);
  };

  const handleContinue = () => {
    if (selected) {
      onContinue(selected);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-900 mb-2">{screen.question}</h2>
      <p className="text-slate-600 mb-8">{screen.subtitle}</p>

      <div className="space-y-3 mb-8">
        {(screen.options as string[]).map((option) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            className="w-full text-left px-6 py-4 rounded-[14px] border-2 font-medium transition-all animate-fade-in"
            style={{
              borderColor: selected === option ? '#6B5CE7' : '#e2e8f0',
              backgroundColor: selected === option ? '#F5F3FF' : '#f8fafc',
              color: selected === option ? '#0f172a' : '#475569'
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                style={{
                  borderColor: selected === option ? '#6B5CE7' : '#cbd5e1',
                  backgroundColor: selected === option ? '#6B5CE7' : 'transparent'
                }}
              >
                {selected === option && <Check className="w-3 h-3 text-white" />}
              </div>
              <span>{option}</span>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selected}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {screen.cta}
      </button>
    </div>
  );
}

// Multi Select Component
function MultiSelectScreen({
  screen,
  onContinue,
  currentValue
}: {
  screen: Screen;
  onContinue: (value: string[]) => void;
  currentValue?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(
    currentValue || []
  );

  const handleToggle = (option: string) => {
    setSelected(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const handleContinue = () => {
    if (selected.length > 0) {
      onContinue(selected);
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-900 mb-2">{screen.question}</h2>
      <p className="text-slate-600 mb-8">{screen.subtitle}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {(screen.options as Array<{ label: string }>).map((option) => (
          <button
            key={option.label}
            onClick={() => handleToggle(option.label)}
            className="text-left px-5 py-4 rounded-[14px] border-2 font-medium transition-all flex items-center gap-3 animate-fade-in"
            style={{
              borderColor: selected.includes(option.label) ? '#6B5CE7' : '#e2e8f0',
              backgroundColor: selected.includes(option.label) ? '#F5F3FF' : '#f8fafc',
              color: selected.includes(option.label) ? '#0f172a' : '#475569'
            }}
          >
            <div
              className="w-5 h-5 rounded-[6px] border-2 flex items-center justify-center flex-shrink-0 transition-all"
              style={{
                borderColor: selected.includes(option.label) ? '#6B5CE7' : '#cbd5e1',
                backgroundColor: selected.includes(option.label) ? '#6B5CE7' : 'transparent'
              }}
            >
              {selected.includes(option.label) && (
                <Check className="w-3 h-3 text-white" />
              )}
            </div>
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={handleContinue}
        disabled={selected.length === 0}
        className="w-full px-6 py-3 bg-[#6B5CE7] text-white font-semibold rounded-[100px] hover:bg-[#5A4BD1] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {screen.cta}
      </button>
    </div>
  );
}

// Confetti Component
function Confetti() {
  const [confetti, setConfetti] = useState<Array<{ id: number; left: number; delay: number; color: string }>>([]);

  useEffect(() => {
    const colors = ['#6B5CE7', '#EDE9FE', '#C4BBFA', '#5A4BD1', '#F5F3FF'];
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setConfetti(pieces);
  }, []);

  return (
    <>
      {confetti.map(piece => (
        <div
          key={piece.id}
          className="confetti fixed pointer-events-none"
          style={{
            left: `${piece.left}%`,
            top: '-10px',
            width: '8px',
            height: '8px',
            backgroundColor: piece.color,
            borderRadius: '50%',
            animation: `confetti-fall ${2 + Math.random() * 1}s ease-in forwards`,
            animationDelay: `${piece.delay}s`,
            '--tx': `${(Math.random() - 0.5) * 200}px`,
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

// Completion Screen Component
function CompletionScreen({
  screen,
  onContinue,
  onRoleSelect
}: {
  screen: Screen;
  onContinue: () => void;
  onRoleSelect?: (role: 'creator' | 'talent') => void;
}) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 7000);
    return () => clearTimeout(timer);
  }, []);

  const handleRoleClick = (role: 'creator' | 'talent') => {
    if (onRoleSelect) {
      onRoleSelect(role);
    }
  };

  return (
    <div className="text-center">
      {showConfetti && <Confetti />}
      
      <div className="mb-6 flex justify-center animate-fade-in">
        <div className="w-20 h-20 bg-gradient-to-br from-[#EDE9FE] to-[#F5F3FF] rounded-full flex items-center justify-center shadow-lg">
          <Check className="w-10 h-10 text-[#6B5CE7]" />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-slate-900 mb-4 animate-fade-in-delay-1">{screen.title}</h1>
      <p className="text-lg text-slate-600 mb-8 leading-relaxed animate-fade-in-delay-2 max-w-md mx-auto">{screen.subtitle}</p>
      
      <div className="mt-12 space-y-8">
        <p className="text-slate-600 font-medium">Now, let's get you set up:</p>
        
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in-delay-2">
          {/* Creator Card */}
          <button
            onClick={() => handleRoleClick('creator')}
            className="group relative overflow-hidden rounded-[20px] p-8 transition-all duration-300 hover:shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
              border: '1px solid rgba(107, 92, 231, 0.1)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#6B5CE7]/5 to-[#5A4BD1]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-white rounded-[14px] flex items-center justify-center group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 shadow-md">
                  <Crown className="h-8 w-8 text-[#6B5CE7]" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Creator</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Hire and manage talented professionals for your projects
              </p>
              
              <div className="mt-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-sm font-semibold text-[#6B5CE7]">Get Started →</span>
              </div>
            </div>
          </button>

          {/* Talent Card */}
          <button
            onClick={() => handleRoleClick('talent')}
            className="group relative overflow-hidden rounded-[20px] p-8 transition-all duration-300 hover:shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
              border: '1px solid rgba(107, 92, 231, 0.1)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#6B5CE7]/5 to-[#5A4BD1]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className="relative z-10">
              <div className="mb-6 flex justify-center">
                <div className="w-16 h-16 bg-white rounded-[14px] flex items-center justify-center group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 shadow-md">
                  <Lightbulb className="h-8 w-8 text-[#6B5CE7]" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Talent</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Showcase your skills <br />and work on exciting projects
              </p>
              
              <div className="mt-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-sm font-semibold text-[#6B5CE7]">Get Started →</span>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Role Select Screen Component
function RoleSelectScreen({ onRoleSelect }: { onRoleSelect: (role: 'creator' | 'talent') => void }) {
  return (
    <div className="space-y-8">
      <div className="text-center animate-fade-in">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Choose your path</h2>
        <p className="text-slate-600">Select how you'd like to contribute to OnSwift</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 animate-fade-in-delay-1">
        {/* Creator Card */}
        <button
          onClick={() => onRoleSelect('creator')}
          className="group relative overflow-hidden rounded-[20px] p-8 transition-all duration-300 hover:shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
            border: '1px solid rgba(107, 92, 231, 0.1)'
          }}
        >
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6B5CE7]/5 to-[#5A4BD1]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="relative z-10">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-white rounded-[14px] flex items-center justify-center group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 shadow-md">
                <Crown className="h-8 w-8 text-[#6B5CE7]" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-3 text-center">Creator</h3>
            <p className="text-slate-600 text-center text-sm leading-relaxed">
              Hire and manage talented professionals for your projects
            </p>
            
            <div className="mt-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-sm font-semibold text-[#6B5CE7]">Get Started →</span>
            </div>
          </div>
        </button>

        {/* Talent Card */}
        <button
          onClick={() => onRoleSelect('talent')}
          className="group relative overflow-hidden rounded-[20px] p-8 transition-all duration-300 hover:shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
            border: '1px solid rgba(107, 92, 231, 0.1)'
          }}
        >
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6B5CE7]/5 to-[#5A4BD1]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="relative z-10">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-white rounded-[14px] flex items-center justify-center group-hover:shadow-lg group-hover:scale-110 transition-all duration-300 shadow-md">
                <Lightbulb className="h-8 w-8 text-[#6B5CE7]" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-slate-900 mb-3 text-center">Talent</h3>
            <p className="text-slate-600 text-center text-sm leading-relaxed">
              Showcase your skills and work on exciting projects
            </p>
            
            <div className="mt-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-sm font-semibold text-[#6B5CE7]">Get Started →</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
