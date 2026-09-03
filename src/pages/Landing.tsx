import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Menu, Minus, Plus, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FaqItem {
  question: string;
  answer: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  avatar: string;
}

interface CreatorCard {
  id: string;
  title: string;
  description: string;
  image: string;
}

interface FeatureCard {
  title: string;
  description: string;
  image: string;
  imageClassName?: string;
  imageWrapClassName?: string;
}

interface HowItWorksStep {
  title: string;
  description: string;
  bullets: string[];
  image: string;
  imageLeft?: boolean;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const PURPLE = '#5b3fc4'; // accent — deep purple, verified ≥7:1 contrast on white for text and solid fills

const CheckBadge = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black">
    <Check className="h-4 w-4 text-white" strokeWidth={3} />
  </span>
);

const XBadge = () => (
  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black">
    <X className="h-4 w-4 text-white" strokeWidth={3} />
  </span>
);

const SectionBadge = ({ children, light }: { children: React.ReactNode; light?: boolean }) => (
  <span
    className="inline-block rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-700"
    style={
      light
        ? { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', color: '#ffffff' }
        : { background: 'rgba(124, 92, 232, 0.10)', border: '1px solid rgba(124, 92, 232, 0.35)', color: PURPLE }
    }
  >
    {children}
  </span>
);

// Continuous (non-unobserving) in-view tracker — used where a section's color scheme
// should toggle back when scrolled away, unlike the one-shot `reveal`/`data-reveal` fade-in below.
function useInViewToggle<T extends HTMLElement>(threshold = 0) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold, rootMargin: '-10% 0px -10% 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { label: 'Home', href: '#top' },
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Creator Tools', href: '#creator-tools' },
    { label: 'Testimonials', href: '#testimonials' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Blog', href: '/blog', isRoute: true },
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-8 lg:px-12">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3"
        style={{
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(0,0,0,0.08)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <a href="/" className="flex items-center">
          <img src="/onswift-logo-white.png" alt="OnSwift" className="h-7 w-auto" style={{ filter: 'brightness(0)' }} />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link
                key={link.label}
                to={link.href}
                className="inline-block py-3 text-sm font-medium text-gray-600 transition-colors hover:text-black"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="inline-block py-3 text-sm font-medium text-gray-600 transition-colors hover:text-black"
              >
                {link.label}
              </a>
            )
          )}
        </div>

        <button
          className="hidden min-h-[40px] rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#5b3fc4] md:block"
          onClick={() => navigate('/login')}
          type="button"
        >
          Get Started
        </button>

        <div className="flex items-center gap-2 md:hidden">
          <button
            className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-[#5b3fc4]"
            onClick={() => navigate('/login')}
            type="button"
          >
            Get Started
          </button>
          <button
            className="flex h-12 w-12 items-center justify-center text-black"
            onClick={() => setIsOpen((o) => !o)}
            aria-label="Toggle menu"
            type="button"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {isOpen && (
        <div
          className="mx-auto mt-2 max-w-6xl rounded-2xl p-5 md:hidden"
          style={{
            background: 'rgba(255,255,255,0.98)',
            border: '1px solid rgba(0,0,0,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
          }}
        >
          <div className="flex flex-col gap-3">
            {navLinks.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.label}
                  to={link.href}
                  className="py-2 text-sm font-medium text-gray-600 transition-colors hover:text-black"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="py-2 text-sm font-medium text-gray-600 transition-colors hover:text-black"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              )
            )}
            <button
              className="mt-2 rounded-full bg-black py-2.5 text-sm font-semibold text-white"
              onClick={() => { navigate('/login'); setIsOpen(false); }}
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

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HeroSection = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDimmed, setVideoDimmed] = useState(false);

  // Softens the hard cut when the video loops: dims it just before/after the
  // restart point so the jump is masked by a brief fade rather than a visible jump cut.
  const handleVideoTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const nearLoopBoundary = video.duration - video.currentTime < 0.4 || video.currentTime < 0.4;
    setVideoDimmed(nearLoopBoundary);
  };

  return (
    <section
      id="top"
      className="reveal relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-28 pb-16 text-center"
      data-reveal
      style={{ background: '#0a0a0a' }}
    >
      {/* Fullscreen looping background video */}
      <video
        ref={videoRef}
        className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out ${videoDimmed ? 'opacity-20' : 'opacity-100'}`}
        src="/assets/hero-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onTimeUpdate={handleVideoTimeUpdate}
        aria-hidden="true"
      />

      {/* Dark overlay for text legibility over the video */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.7) 100%)' }}
      />

      <div className="relative z-10 mx-auto mt-3 max-w-5xl px-6 md:mt-40">
        <h1
          className="animate-fade-in-up mb-6 font-instrument-serif text-3xl leading-[1.1] text-white opacity-0 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
          style={{ animationDelay: '0.1s' }}
        >
          Run Your Agency<br /><span className="italic">Without</span> Chaos
        </h1>

        <p
          className="animate-fade-in-up mx-auto mb-10 max-w-xl text-base font-light leading-relaxed text-white/70 opacity-0 md:text-lg"
          style={{ animationDelay: '0.25s' }}
        >
          Hire better people, manage projects calmly, and stop being the bottleneck,
          all with OnSwift, an all-in-one operating system for modern agencies.
        </p>

        <div
          className="animate-fade-in-up flex flex-col items-center gap-4 opacity-0 sm:flex-row sm:justify-center"
          style={{ animationDelay: '0.4s' }}
        >
          <button
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 hover:shadow-lg"
            onClick={() => navigate('/login')}
            type="button"
          >
            Get Started, It&apos;s Free!
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>

          <a
            href="#how-it-works"
            className="group inline-flex items-center gap-2 rounded-full border border-white/40 px-7 py-3 text-sm font-medium text-white transition-all hover:border-white/60 hover:bg-white/10"
          >
            See How It Works
            <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
          </a>
        </div>
      </div>

      {/* Dashboard preview */}
      <div className="relative z-10 mx-auto mt-16 w-full max-w-5xl px-6">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10"
          style={{
            boxShadow: '0 0 60px rgba(124,92,232,0.35), 0 40px 80px rgba(0,0,0,0.5)',
          }}
        >
          <img
            src="/assets/dashboard-preview.png"
            alt="OnSwift dashboard"
            className="block h-auto w-full"
          />
        </div>
      </div>
    </section>
  );
};

// ─── Trusted By ───────────────────────────────────────────────────────────────

const TrustedBySection = () => (
  <section className="reveal py-12" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div className="mx-auto max-w-5xl px-6">
      <p className="mb-8 text-center text-sm font-medium tracking-widest text-gray-600 uppercase">
        Trusted By
      </p>
      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
        {['OVERBOOKED', 'MATHETES', 'Kaicension', 'AGENCYE'].map((brand) => (
          <span
            key={brand}
            className="text-base font-bold tracking-wider text-gray-500 transition-colors hover:text-black"
          >
            {brand}
          </span>
        ))}
      </div>
    </div>
  </section>
);

// ─── Problem Section ──────────────────────────────────────────────────────────

const ProblemSection = () => (
  <section className="reveal py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
        <img
          src="/assets/onswift_customer.png"
          alt="OnSwift Customer"
          className="w-full max-w-xs shrink-0 rounded-3xl border border-black/10 lg:w-72"
        />

        {/* Content */}
        <div className="flex-1">
          <h2 className="mb-4 text-1xl font-bold leading-tight text-black md:text-4xl lg:text-5xl">
            You Didn&apos;t Start an Agency to Become a Project Manager.
          </h2>
          <p className="mb-8 text-base text-gray-600 md:text-lg">
            You started your agency because you&apos;re great at what you do. But now, you&apos;re:
          </p>
          <ul className="flex flex-col gap-4">
            {[
              'Chasing freelancers',
              'Managing five different tools',
              'Following up on missed deadlines',
              'Fixing mistakes',
              'Holding everything in your head',
            ].map((pain) => (
              <li key={pain} className="flex items-center gap-4">
                <XBadge />
                <span className="text-base font-medium text-gray-800 md:text-lg">{pain}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

// ─── Bridge Statement ─────────────────────────────────────────────────────────

const BridgeStatement = () => (
  <section className="reveal py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div className="mx-auto max-w-4xl px-6 text-center">
      <p className="text-2xl leading-snug text-black md:text-3xl lg:text-4xl">
        But that is over now. OnSwift brings hiring, operations, and Client Delivery into one simple AI-led system.
      </p>
    </div>
  </section>
);

// ─── Features Bento ───────────────────────────────────────────────────────────

const FeaturesSection = () => {
  const features: FeatureCard[] = [
    {
      title: 'Vetted Talent Marketplace',
      description: 'Hire reliable talents without gambling on quality.',
      image: '/assets/feature-talent-matching.png',
    },
    {
      title: 'AI Operations Manager',
      description: 'Your invisible project manager that never sleeps.',
      image: '/assets/feature-auto-pm.png',
    },
    {
      title: 'Unified Workspace',
      description: 'Tasks, communication, files, and timelines, together.',
      image: '/assets/feature-quality-control.png',
    },
    {
      title: 'Founder Dashboard',
      description: 'See your entire agency at a glance.',
      image: '/assets/feature-scale.png',
    },
    {
      title: 'Quality & Accountability',
      description: 'Every task has clear ownership.',
      image: '/assets/feature-communication.png',
      // imageClassName: 'object-contain object-center',
      // imageWrapClassName: 'flex items-center justify-center',
    },
  ];

  const [sectionRef, inView] = useInViewToggle<HTMLElement>();

  return (
    <section
      id="features"
      ref={sectionRef}
      className="reveal py-20 transition-colors duration-700 lg:py-28"
      data-reveal
      style={{
        background: inView ? 'hsl(250 76% 63%)' : '#ffffff',
        borderTop: inView ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge light={inView}>Features</SectionBadge>
          <h2 className={`mt-5 text-3xl font-bold transition-colors duration-700 md:text-4xl lg:text-5xl ${inView ? 'text-white' : 'text-black'}`}>
            Everything Your Agency Needs, <br />In One Place.
          </h2>
        </div>

        {/* Top row: 3 cards */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.slice(0, 3).map((f) => (
            <div key={f.title} className="glass-card-feature flex flex-col overflow-hidden rounded-xl p-0">
              <div className={`overflow-hidden bg-white p-4 ${f.imageWrapClassName ?? ''}`}>
                <img src={f.image} alt={f.title} className={`h-auto w-full ${f.imageClassName ?? ''}`} />
              </div>
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold text-black">{f.title}</h3>
                <p className="text-base leading-relaxed text-gray-600">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row: 2 larger cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.slice(3).map((f) => (
            <div key={f.title} className="glass-card-feature flex flex-col overflow-hidden rounded-xl p-0">
              <div className={`overflow-hidden bg-white p-4 ${f.imageWrapClassName ?? ''}`}>
                <img src={f.image} alt={f.title} className={`h-auto w-full ${f.imageClassName ?? ''}`} />
              </div>
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold text-black">{f.title}</h3>
                <p className="text-base leading-relaxed text-gray-600">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── How It Works ─────────────────────────────────────────────────────────────

const HowItWorksSection = () => {
  const steps: HowItWorksStep[] = [
    {
      title: 'Set Up Your Agency',
      description: 'Connect your projects, team, and workflows in minutes.',
      bullets: ['Import clients', 'Add your team', 'Create projects', 'Set deadlines'],
      image: '/assets/feature-invite.png',
      imageLeft: false,
    },
    {
      title: 'Organize & Automate',
      description: 'Let OnSwift structure your operations.',
      bullets: ['Smart task breakdown', 'Clear timelines', 'Automated follow-ups', 'Central dashboard'],
      image: '/assets/feature-project-dashboard.png',
      imageLeft: true,
    },
    {
      title: 'Deliver & Scale',
      description: 'Run projects with confidence.',
      bullets: ['Track progress live', 'Catch delays early', 'Maintain quality', 'Impress clients'],
      image: '/assets/feature-deadliner.png',
      imageLeft: false,
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-28" style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="reveal mb-14 text-center" data-reveal>
          <SectionBadge>How it Works</SectionBadge>
          <h2 className="mt-5 text-3xl font-bold text-black md:text-4xl lg:text-5xl">
            All-in-One Operating <br />System for Agencies.
          </h2>
        </div>

        {/* Sticky stack: each step pins a little lower than the last as you scroll, so they pile up like cards.
            lg+ only — on small screens the cards are already too tall to pin without feeling broken, so they
            just scroll normally. */}
        <div className="flex flex-col gap-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="overflow-hidden rounded-3xl lg:sticky"
              style={{
                background: '#fafafa',
                border: '1px solid rgba(0,0,0,0.08)',
                top: `${104 + index * 24}px`,
                zIndex: index + 1,
              }}
            >
              <div className={`flex flex-col gap-8 p-8 lg:flex-row lg:items-center lg:gap-12 lg:p-12 ${step.imageLeft ? 'lg:flex-row-reverse' : ''}`}>
                {/* Text */}
                <div className="flex-1">
                  <h3 className="mb-3 text-2xl font-black text-black md:text-3xl">{step.title}</h3>
                  <p className="mb-6 text-base text-gray-600">{step.description}</p>
                  <ul className="flex flex-col gap-3">
                    {step.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3">
                        <CheckBadge />
                        <span className="text-base font-medium text-gray-800">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Screenshot */}
                <div className="w-full overflow-hidden rounded-2xl lg:w-[55%]">
                  <img src={step.image} alt={step.title} className="h-auto w-full object-cover" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Creator Tools ────────────────────────────────────────────────────────────

const CreatorToolsSection = () => {
  const cards: CreatorCard[] = [
    {
      id: "agency",
      title: 'Agency Founders',
      description: 'Creators Scaling into Agencies, Small Agencies (3–10 People), Growing Agencies (10–50 People) can now manage teams and clients with clarity.',
      image: '/assets/feature-blur.png',
    },
    {
      id: "freelance",
      title: "Freelancers & Solopreneurs",
      description: "Manage clients, projects, and income streams without the chaos of scaling alone.",
      image: "/assets/feature-client-portal.png",
    },
    {
      id: "remote",
      title: "Remote Teams",
      description: "Work smoothly across locations.",
      image: '/assets/feature-soup.png',
    },
    {
      id: "coaches",
      title: "Coaches & Consultants",
      description: "Coaches & Consultants can now run backend operations professionally, deliver premium services without overwhelm.",
      image: '/assets/feature-coaching-d.png',
    },
  ];

  const [sectionRef, inView] = useInViewToggle<HTMLElement>();

  return (
    <section
      id="creator-tools"
      ref={sectionRef}
      className="reveal py-20 transition-colors duration-700 lg:py-28"
      data-reveal
      style={{
        background: inView ? '#000000' : '#ffffff',
        borderTop: inView ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge light={inView}>Social &amp; Creator Tools</SectionBadge>
          <h2 className={`mt-5 text-3xl font-bold transition-colors duration-700 md:text-4xl lg:text-5xl ${inView ? 'text-white' : 'text-black'}`}>
            Built for Agencies &amp; Creators<br />Who Are Scaling into Agencies
          </h2>
          <p className={`mt-4 text-base transition-colors duration-700 ${inView ? 'text-white/80' : 'text-gray-600'}`}>
            OnSwift supports how modern founders actually work.
          </p>
        </div>
          {/* {Card Section} */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="overflow-hidden rounded-xl"
              style={{
                background: '#fafafa',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold text-black">{card.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-gray-600">{card.description}</p>
              </div>
              <div className="overflow-hidden bg-white p-4">
                <img src={card.image} alt={card.title} className="h-auto w-full object-contain" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TestimonialsSection = () => {
  const testimonials: Testimonial[] = [
    {
  quote: 'Before this, I was constantly putting out fires. Now I have full visibility into every client and project we crossed 6 figures and I finally feel in control of the agency.',
  author: 'Daniel Araromi',
  role: 'CEO, Overbooked',
  avatar: '/assets/testimony-auth/daniel-araromi.png',
},
{
  quote: 'Managing capital and client relationships at the same time was overwhelming. This gave us the structure to scale without dropping the ball on either side.',
  author: 'Clinkton Okhai',
  role: 'CEO, Mathetes Capital',
  avatar: '/assets/testimony-auth/clinkton-okhai.png',
},
{
  quote: 'I used to run everything in my head. Now the whole team knows what to do, when to do it, and nothing slips through the cracks. Game changer for a growing agency.',
  author: 'Caleb Benson',
  role: 'CEO, Aency E',
  avatar: '/assets/testimony-auth/caleb-benson.png',
},
  ];

  return (
    <section id="testimonials" className="reveal py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge>Testimonials</SectionBadge>
          <h2 className="mt-5 text-3xl font-bold text-black md:text-4xl lg:text-5xl">
            What Founders Who Uses <br />Onswift Says
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="flex flex-col justify-between rounded-xl p-7"
              style={{
                background: '#fafafa',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <p className="mb-6 text-sm leading-relaxed text-gray-700">{t.quote}</p>
              <div className="flex items-center gap-3 border-t border-black/10 pt-5">
                <img
                  src={t.avatar}
                  alt={t.author}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-black">{t.author}</p>
                  <p className="text-xs text-gray-600">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  const faqs: FaqItem[] = [
    { question: 'Is OnSwift hard to set up?', answer: 'No. Most founders are fully set up in under 30 minutes. We guide you through the entire process.' },
    { question: 'Is this just another project management tool?', answer: 'No. OnSwift combines hiring, operations, communication, and AI into one unified system built for agencies.' },
    { question: 'Who is OnSwift best for?', answer: 'Creators, coaches, consultants, and agencies making $3k–$50k+/month who want to scale without chaos.' },
    { question: 'Can I use it with my current team?', answer: 'Yes. Import your existing freelancers and staff easily. No disruption to your current workflows.' },
    { question: 'Do I need technical skills?', answer: 'No. If you can use WhatsApp, you can use OnSwift. It\'s designed for non-technical founders.' },
  ];

  return (
    <section id="faq" className="reveal py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          {/* Left: title */}
          <div className="lg:w-80 lg:shrink-0">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-black md:text-4xl">
              Everything You Want to Know
            </h2>
            <p className="mt-4 text-base text-gray-600">Still unsure? We&apos;ve got you.</p>
          </div>

          {/* Right: accordion */}
          <div className="flex flex-1 flex-col gap-3">
            {faqs.map((item, i) => (
              <div
                key={item.question}
                className={`overflow-hidden rounded-2xl transition-shadow ${open === i ? '' : 'hover:shadow-[inset_0_0_0_1px_rgba(124,92,232,0.35)]'}`}
                style={{
                  background: open === i ? 'rgba(124,92,232,0.08)' : '#fafafa',
                  border: open === i ? '1px solid rgba(124,92,232,0.4)' : '1px solid rgba(0,0,0,0.08)',
                }}
              >
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                  onClick={() => setOpen(open === i ? null : i)}
                  type="button"
                  aria-expanded={open === i}
                  aria-controls={`faq-panel-${i}`}
                >
                  <span className="text-base font-semibold text-black">{item.question}</span>
                  <span className={`ml-4 shrink-0 ${open === i ? 'text-[#5b3fc4]' : 'text-gray-500'}`}>
                    {open === i ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </button>
                {open === i && (
                  <div id={`faq-panel-${i}`} role="region" className="px-6 pb-5">
                    <p className="text-sm leading-relaxed text-gray-600">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Final CTA ────────────────────────────────────────────────────────────────

const FinalCTA = () => {
  const navigate = useNavigate();

  return (
    <section className="reveal py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div
          className="mx-auto max-w-4xl overflow-hidden rounded-3xl p-10 text-center md:p-16"
          style={{
            background: 'linear-gradient(140deg, #2d1b5e 0%, #46299c 50%, #5b3fc4 100%)',
          }}
        >
          <h2 className="mb-5 text-3xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            Run Your Agency<br />Without Chaos
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-white/80">
            Hire better people, manage projects calmly, and stop being the bottleneck,
            all with OnSwift, an all-in-one operating system for agencies.
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 transition-all hover:bg-white/90"
            onClick={() => navigate('/login')}
            type="button"
          >
            Get Started, It&apos;s Free!
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────

const Footer = () => (
  <footer
    className="reveal py-16"
    data-reveal
    style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.08)' }}
  >
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        {/* Col 1: Logo + tagline */}
        <div>
          <img src="/onswift-logo-white.png" alt="OnSwift" className="mb-4 h-7 w-auto" style={{ filter: 'brightness(0)' }} />
          <p className="text-sm leading-relaxed text-gray-600">
            Hire better people, manage projects calmly, and stop being the bottleneck,
            all with OnSwift, an all-in-one operating system for agencies.
          </p>
        </div>

        {/* Col 2: Company */}
        <div>
          <p className="mb-4 text-sm font-semibold text-black">Company</p>
          <ul className="flex flex-col gap-3">
            {['About Us', 'Contact', 'Product', 'Newsletter', 'Blogs', 'Pricing'].map((link) => (
              <li key={link}>
                <a href="#" className="inline-block py-1 text-sm text-gray-600 transition-colors hover:text-black">{link}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Resources */}
        <div>
          <p className="mb-4 text-sm font-semibold text-black">Resources</p>
          <ul className="flex flex-col gap-3">
            {['Terms of Service', 'Privacy Policy'].map((link) => (
              <li key={link}>
                <a href="#" className="inline-block py-1 text-sm text-gray-600 transition-colors hover:text-black">{link}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 border-t border-black/10 pt-8">
        <p className="text-center text-xs text-gray-600">© 2025 OnSwift. Calm systems for growing agencies.</p>
      </div>
    </div>
  </footer>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [showLoader, setShowLoader] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const hasSeenLoader = sessionStorage.getItem('landingLoaderSeen') === '1';
    if (hasSeenLoader) {
      setShowLoader(false);
      setIsLoaded(true);
      return undefined;
    }

    sessionStorage.setItem('landingLoaderSeen', '1');

    const MIN_DISPLAY_MS = 400; // avoid a jarring flash on fast loads
    const MAX_DISPLAY_MS = 1200; // hard ceiling so slow assets never hold the page hostage
    const startedAt = Date.now();

    let settled = false;
    let hideTimer: number | undefined;

    const settle = () => {
      if (settled) return;
      settled = true;
      const remaining = Math.max(MIN_DISPLAY_MS - (Date.now() - startedAt), 0);
      window.setTimeout(() => {
        setIsLoaded(true);
        hideTimer = window.setTimeout(() => setShowLoader(false), 300);
      }, remaining);
    };

    const heroImage = new Image();
    heroImage.onload = settle;
    heroImage.onerror = settle;
    heroImage.src = '/assets/dashboard-preview.png';

    const maxTimer = window.setTimeout(settle, MAX_DISPLAY_MS);

    return () => {
      window.clearTimeout(maxTimer);
      if (hideTimer) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = showLoader ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [showLoader]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -10% 0px',
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>
      {showLoader && (
        <>
          <div className={`loader-screen ${isLoaded ? 'is-fading' : ''}`} aria-hidden="true">
            <div className="loader-center">
              <span className="loader-ring loader-ring--a" />
              <span className="loader-ring loader-ring--b" />
              <img src="/onswift logo.png" alt="OnSwift" className="loader-logo" style={{ filter: 'brightness(0)' }} />
            </div>
          </div>
          <span className="sr-only" role="status" aria-live="polite">Loading OnSwift…</span>
        </>
      )}

      <div className={`page-shell ${isLoaded ? 'page-shell--visible' : ''}`}>
        <Navigation />
        <HeroSection />
        <TrustedBySection />
        <ProblemSection />
        <BridgeStatement />
        <FeaturesSection />
        <HowItWorksSection />
        <CreatorToolsSection />
        <TestimonialsSection />
        <FAQSection />
        <FinalCTA />
        <Footer />
      </div>
    </div>
  );
}
