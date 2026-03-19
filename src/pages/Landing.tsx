import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavLink {
  label: string;
  href: string;
}

interface Feature {
  title: string;
  description: string;
  image: string;
}

interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
  bullets: string[];
  note?: string;
}

type UseCaseIcon = 'coaches' | 'agency' | 'course' | 'freelancers' | 'brands' | 'remote';

interface UseCase {
  id: string;
  title: string;
  description: string;
  icon: UseCaseIcon;
  colSpan: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface Stat {
  value: string;
  label: string;
  description: string;
}

const useScrollAnimation = (threshold = 0.2) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
};

const CTAButton = ({
  children,
  className = '',
  onClick,
  variant = 'glow',
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'glow' | 'outline';
}) => {
  const variantClass = variant === 'glow' ? 'glow-button' : 'outline-button';

  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl px-6 py-3 font-semibold transition-all duration-200 ${variantClass} ${className}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
};

const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-primary/80">{children}</p>
);

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks: NavLink[] = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Creator Tools', href: '#creator-tools' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/10 bg-background/80 backdrop-blur-xl">
      <nav className="container relative mx-auto flex items-center justify-center px-6 py-5 lg:px-10">
        <a href="/" className="absolute left-6 lg:left-10">
          <img src="/onswift-logo-white.png" alt="OnSwift" className="h-8 w-auto" />
        </a>

        <div className="hidden items-center gap-10 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          className="hidden px-6 py-2.5 text-sm md:absolute md:right-6 md:block lg:right-10 glow-button"
          onClick={() => navigate('/signup')}
          type="button"
        >
          Get Started
        </button>

        <button
          className="ml-auto p-2 text-foreground md:hidden"
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Toggle menu"
          type="button"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {isOpen && (
        <div className="animate-fade-in border-t border-border/10 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="container mx-auto flex flex-col gap-4 px-6 py-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="py-2 font-medium text-foreground/80 transition-colors hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              className="mt-2 px-6 py-3 text-center glow-button"
              onClick={() => {
                navigate('/signup');
                setIsOpen(false);
              }}
              type="button"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background pb-[250px] pt-32 md:pb-[300px] md:pt-40 lg:pb-[350px] lg:pt-48">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="landing-line-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="landing-line-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#EC4899" stopOpacity="0.2" />
            </linearGradient>
            <filter id="landing-glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M-100,200 Q300,100 600,300 T1200,200 T1600,400"
            stroke="url(#landing-line-1)"
            strokeWidth="2"
            fill="none"
            filter="url(#landing-glow)"
            className="animate-pulse-glow"
          />
          <path
            d="M1500,100 Q1200,300 800,200 T200,400 T-100,300"
            stroke="url(#landing-line-2)"
            strokeWidth="2"
            fill="none"
            filter="url(#landing-glow)"
            className="animate-pulse-glow"
            style={{ animationDelay: '1s' }}
          />
        </svg>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(262,83%,66%,0.18)_0%,_transparent_70%)]" />
      </div>

      <div className="container relative z-20 mx-auto px-6 text-center lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mt-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <span className="announcement-badge mb-8 inline-flex items-center gap-2">
                            Trusted by growing agencies
            </span>
          </div>

          <h1
            className="animate-fade-in-up text-4xl font-bold leading-[1.05] text-foreground opacity-0 md:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.25s' }}
          >
            RUN YOUR AGENCY <span className="gradient-text">WITHOUT CHAOS</span>
          </h1>

          <p
            className="mx-auto mb-10 mt-6 max-w-3xl animate-fade-in-up text-lg leading-relaxed text-foreground/65 opacity-0 md:text-xl"
            style={{ animationDelay: '0.35s' }}
          >
            Hire better people, manage projects calmly, and stop being the bottleneck, all with
            {' '}OnSwift, an all-in-one operating system for modern agencies.
          </p>

          <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.45s' }}>
            <CTAButton onClick={() => navigate('/signup')} className="px-10 py-4 text-lg">
              Get Started, It&apos;s free!
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
};

const DashboardShowcase = () => (
  <div
    className="pointer-events-none absolute left-1/2 z-10 w-full px-6 lg:px-10"
    style={{ bottom: 0, transform: 'translate(-50%, 50%)' }}
  >
    <div className="pointer-events-auto relative mx-auto max-w-5xl">
      <div
        className="absolute inset-0 rounded-3xl animate-pulse-glow"
        style={{
          background: 'radial-gradient(ellipse at center, hsla(262, 83%, 66%, 0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
          transform: 'scale(1.1)',
        }}
      />
      <div
        className="relative overflow-hidden rounded-3xl border-2 border-primary/30"
        style={{
          boxShadow: `
            0 0 40px hsla(250, 76%, 63%, 0.6),
            0 0 80px hsla(250, 76%, 63%, 0.4),
            0 0 120px hsla(250, 76%, 63%, 0.2),
            0 40px 120px hsla(250, 76%, 63%, 0.4)
          `,
        }}
      >
        <img src="/assets/dashboard-preview.png" alt="OnSwift dashboard interface" className="block h-auto w-full" />
      </div>
    </div>
  </div>
);

const HowItWorksSection = () => {
  const steps: HowItWorksStep[] = [
    {
      number: '1',
      title: 'Set Up Your Agency',
      description: 'Connect your projects, team, and workflows in minutes.',
      bullets: ['Import clients', 'Add your team', 'Create workflows', 'Set deadlines'],
      note: 'No complex setup. No learning curve.',
    },
    {
      number: '2',
      title: 'Organize & Automate',
      description: 'Let OnSwift structure your operations.',
      bullets: ['Smart task breakdown', 'Clear timelines', 'Automated follow-ups', 'Central dashboard'],
      note: 'Everything stays on track automatically.',
    },
    {
      number: '3',
      title: 'Deliver & Scale',
      description: 'Run projects with confidence.',
      bullets: ['Track progress live', 'Catch delays early', 'Maintain quality', 'Impress clients'],
      note: 'Deliver like a world-class agency.',
    },
  ];

  return (
    <section id="how-it-works" className="bg-background/80 py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-10">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <SectionEyebrow>How It Works</SectionEyebrow>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl lg:text-6xl">
            Run your agency like a real CEO, not a firefighter.
          </h2>
        </div>

        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_24px_90px_rgba(139,92,246,0.2)] md:p-10"
            >
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-3xl font-bold text-primary">
                  {step.number}
                </div>

                <div className="flex-1">
                  <h3 className="mb-3 text-2xl font-bold text-foreground md:text-3xl">{step.title}</h3>
                  <p className="mb-6 text-lg text-foreground/65">{step.description}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    {step.bullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="flex items-center gap-3 rounded-2xl border border-border/10 bg-background/50 px-4 py-3 text-foreground/85"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                          <Check className="h-4 w-4" />
                        </span>
                        <span className="font-medium">{bullet}</span>
                      </div>
                    ))}
                  </div>

                  {step.note ? <p className="mt-6 text-base font-medium text-primary/85">{step.note}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SolutionSection = () => {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardWidth = 620;

  const features: Feature[] = [
    {
      title: 'Smart Talent System',
      description: 'Build reliable teams without stress. Hire vetted professionals and assign roles logically, no more vibes-based decisions.',
      image: '/assets/feature-talent-matching.png',
    },
    {
      title: 'AI Operations Manager',
      description: 'Your invisible COO. Automatically plans timelines, detects delays, and keeps work organized.',
      image: '/assets/feature-auto-pm.png',
    },
    {
      title: 'Project & Workflow Hub',
      description: 'Know what’s happening. At all times. Track tasks, deadlines, SOPs, and quality in one place.',
      image: '/assets/feature-quality-control.png',
    },
    {
      title: 'Unified Communication',
      description: 'One source of truth. All project and team conversations in one calm workspace.',
      image: '/assets/feature-communication.png',
    },
    {
      title: 'Client Delivery System',
      description: 'Look professional. Stay consistent. Standardize onboarding, execution, and offboarding.',
      image: '/assets/feature-voice-briefing.png',
    },
    {
      title: 'Performance Dashboard',
      description: 'Full visibility. See workload, progress, risks, and results, instantly.',
      image: '/assets/feature-scale.png',
    },
  ];

  const scroll = (direction: 'prev' | 'next') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'next' ? cardWidth : -cardWidth,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section id="features" className="overflow-hidden bg-background py-24 lg:py-32">
      <div className="mx-auto mb-16 max-w-3xl px-6 text-center lg:px-10">
        <SectionEyebrow>Features</SectionEyebrow>
        <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl lg:text-6xl">
          Your All-in-One Agency Control System
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-foreground/65 md:text-xl">
          Everything you need to run calmly, in one platform.
        </p>
        <div className="mt-8">
          <CTAButton onClick={() => navigate('/signup')} className="px-8 py-3.5">
            Try OnSwift Now
          </CTAButton>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => scroll('prev')}
          className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-primary/20 text-foreground transition-all duration-300 hover:scale-110 hover:bg-primary/40 lg:left-8 lg:h-14 lg:w-14"
          aria-label="Previous feature"
          type="button"
        >
          <ChevronLeft className="h-6 w-6 lg:h-7 lg:w-7" />
        </button>

        <button
          onClick={() => scroll('next')}
          className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-primary/30 bg-primary/20 text-foreground transition-all duration-300 hover:scale-110 hover:bg-primary/40 lg:right-8 lg:h-14 lg:w-14"
          aria-label="Next feature"
          type="button"
        >
          <ChevronRight className="h-6 w-6 lg:h-7 lg:w-7" />
        </button>

        <div ref={scrollRef} className="flex overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {features.map((feature) => (
            <div key={feature.title} className="mx-5 w-[320px] flex-shrink-0 md:w-[450px] lg:w-[600px]">
              <div className="glass-card-feature flex h-full flex-col gap-6 p-8 lg:p-12">
                <div className="relative h-48 w-full overflow-hidden rounded-2xl lg:h-72">
                  <img src={feature.image} alt={feature.title} className="h-full w-full object-cover" />
                </div>
                <div>
                  <h3 className="mb-4 text-2xl font-bold text-foreground lg:text-3xl">{feature.title}</h3>
                  <p className="text-base leading-relaxed text-foreground/60 lg:text-lg">{feature.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const useCaseIcons: Record<UseCaseIcon, LucideIcon> = {
  coaches: Briefcase,
  agency: Building2,
  course: GraduationCap,
  freelancers: ShieldCheck,
  brands: Sparkles,
  remote: Globe,
};

const CreatorToolsSection = () => {
  const navigate = useNavigate();

  const useCases: UseCase[] = [
    {
      id: 'coaches',
      title: 'Coaches & Consultants',
      description: 'Deliver premium services without overwhelm.',
      icon: 'coaches',
      colSpan: 'md:col-span-2',
    },
    {
      id: 'agency',
      title: 'Agency Founders',
      description: 'Manage teams and clients with clarity.',
      icon: 'agency',
      colSpan: 'md:col-span-1',
    },
    {
      id: 'course',
      title: 'Course Creators',
      description: 'Run backend operations professionally.',
      icon: 'course',
      colSpan: 'md:col-span-1',
    },
    {
      id: 'freelancers',
      title: 'Expert Freelancers',
      description: 'Scale into agencies without chaos.',
      icon: 'freelancers',
      colSpan: 'md:col-span-2',
    },
    {
      id: 'brands',
      title: 'Personal Brands',
      description: 'Protect your reputation as you grow.',
      icon: 'brands',
      colSpan: 'md:col-span-1',
    },
    {
      id: 'remote',
      title: 'Remote Teams',
      description: 'Work smoothly across locations.',
      icon: 'remote',
      colSpan: 'md:col-span-1',
    },
  ];

  return (
    <section id="creator-tools" className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-6 lg:px-10">
        <div className="mx-auto mb-16 max-w-3xl text-center lg:mb-20">
          <SectionEyebrow>Social & Creator Tools</SectionEyebrow>
          <h2 className="mb-6 text-3xl font-bold text-foreground md:text-5xl lg:text-6xl">
            Built for Creators Who Are Becoming CEOs
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-foreground/60 md:text-xl">
            OnSwift supports how modern founders actually work.
          </p>
          <div className="mt-8">
            <CTAButton onClick={() => navigate('/signup')} className="px-8 py-3.5">
              Start Free Trial
            </CTAButton>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-3">
          {useCases.map((useCase) => {
            const Icon = useCaseIcons[useCase.icon];

            return (
              <div key={useCase.id} className={`group glass-card-usecase ${useCase.colSpan}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-between p-8 md:p-10">
                  <div>
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-foreground transition-transform duration-500 group-hover:scale-110">
                      <Icon className="h-6 w-6" strokeWidth={1.6} />
                    </div>
                    <h3 className="mb-4 text-2xl font-bold text-foreground md:text-3xl">{useCase.title}</h3>
                    <p className="text-base leading-relaxed text-foreground/60 md:text-lg">{useCase.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const TestimonialsSection = () => {
  const testimonials: Testimonial[] = [
    {
      quote: 'Before OnSwift, everything was in my head. Now my agency runs itself. I finally breathe again.',
      author: 'Daniel A.',
      role: 'Agency Founder',
    },
    {
      quote: 'We stopped missing deadlines. Clients trust us more. Revenue is up. Stress is down.',
      author: 'Sarah M.',
      role: 'Coach',
    },
    {
      quote: 'OnSwift feels like having a COO without hiring one.',
      author: 'James K.',
      role: 'Consultant',
    },
  ];

  return (
    <section className="bg-background/80 py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-10">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <SectionEyebrow>Testimonials</SectionEyebrow>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl lg:text-6xl">
            How Founders Use OnSwift to Stay in Control
          </h2>
          <p className="text-lg text-foreground/60 md:text-xl">
            Real stories from creators who chose calm growth.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl"
            >
              <p className="mb-8 text-lg leading-relaxed text-foreground/85">“{testimonial.quote}”</p>
              <div className="border-t border-border/10 pt-6">
                <p className="font-semibold text-foreground">{testimonial.author}</p>
                <p className="text-sm text-foreground/55">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FAQSection = () => {
  const faqs: FaqItem[] = [
    {
      question: 'Is OnSwift hard to set up?',
      answer: 'No. Most founders are fully set up in under 30 minutes.',
    },
    {
      question: 'Is this just another project management tool?',
      answer: 'No. OnSwift combines hiring, operations, communication, and AI into one system.',
    },
    {
      question: 'Who is OnSwift best for?',
      answer: 'Creators, coaches, consultants, and agencies making $3k–$50k+/month.',
    },
    {
      question: 'Can I use it with my current team?',
      answer: 'Yes. Import your existing freelancers and staff easily.',
    },
    {
      question: 'Do I need technical skills?',
      answer: 'No. If you can use WhatsApp, you can use OnSwift.',
    },
  ];

  return (
    <section id="faq" className="bg-background py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-10">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl lg:text-6xl">
            Everything You Want to Know
          </h2>
          <p className="text-lg text-foreground/60 md:text-xl">Still unsure? We&apos;ve got you.</p>
        </div>

        <div className="mx-auto max-w-4xl space-y-4">
          {faqs.map((item, index) => (
            <details
              key={item.question}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl open:border-primary/30"
              open={index === 0}
            >
              <summary className="cursor-pointer list-none text-left text-lg font-semibold text-foreground marker:content-none">
                {item.question}
              </summary>
              <p className="mt-4 text-base leading-relaxed text-foreground/60">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

const TrustedStatsSection = () => {
  const stats: Stat[] = [
    {
      value: '10,000+',
      label: 'Projects Managed Monthly',
      description: 'Founders trust OnSwift for smooth delivery.',
    },
    {
      value: '40+',
      label: 'Countries Worldwide',
      description: 'Used by creators and agencies globally.',
    },
    {
      value: '75%',
      label: 'Less Operational Stress',
      description: 'Founders report major burnout reduction.',
    },
    {
      value: '4.7/5',
      label: 'User Rating',
      description: 'Loved for simplicity and reliability.',
    },
  ];

  return (
    <section className="bg-background/80 py-24 lg:py-32">
      <div className="container mx-auto px-6 lg:px-10">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <SectionEyebrow>Trusted by Growing Agencies</SectionEyebrow>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-5xl lg:text-6xl">
            Calm Systems. Real Results.
          </h2>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[2rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl"
            >
              <p className="mb-3 text-4xl font-bold text-primary md:text-5xl">{stat.value}</p>
              <p className="mb-2 text-lg font-semibold text-foreground">{stat.label}</p>
              <p className="text-sm leading-relaxed text-foreground/55">{stat.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section id="final-cta" className="relative flex items-center justify-center overflow-hidden bg-background py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      <div className="absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/4 -translate-y-1/4 rounded-full bg-primary/30 opacity-50 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-[500px] w-[500px] translate-x-1/4 translate-y-1/4 rounded-full bg-accent/30 opacity-50 blur-[120px]" />

      <div className="container relative z-10 mx-auto px-6 lg:px-10">
        <div className="group relative mx-auto max-w-4xl overflow-hidden rounded-[3rem] border border-white/10 bg-white/5 p-8 text-center shadow-[0_0_60px_-15px_rgba(139,92,246,0.3)] backdrop-blur-xl md:p-16">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
          <div className="relative z-10">
            <SectionEyebrow>Final CTA</SectionEyebrow>
            <h2 className="mb-6 text-4xl font-bold leading-tight text-foreground md:text-6xl lg:text-7xl">
              Ready to Run Your Agency <span className="gradient-text">Without Chaos?</span>
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-foreground/60">
              Join the founders who chose peace over panic.
            </p>
            <CTAButton onClick={() => navigate('/signup')} className="group/cta px-12 py-5 text-xl">
              Get Started, It&apos;s Free!
              <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover/cta:translate-x-1" />
            </CTAButton>
          </div>
        </div>
      </div>
    </section>
  );
};

const Footer = () => (
  <footer className="border-t border-border/20 bg-background py-16">
    <div className="container mx-auto px-6 lg:px-10">
      <div className="border-t border-border/10 pt-8">
        <p className="text-center text-sm text-foreground/60">© 2025 OnSwift. Calm systems for growing agencies.</p>
      </div>
    </div>
  </footer>
);

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Navigation />
      <div className="relative">
        <HeroSection />
        <DashboardShowcase />
      </div>
      <HowItWorksSection />
      <SolutionSection />
      <CreatorToolsSection />
      <TestimonialsSection />
      <FAQSection />
      <TrustedStatsSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
