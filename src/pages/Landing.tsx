import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Menu, Minus, Plus, X } from 'lucide-react';
import { DashboardPreview } from '@/components/landing/DashboardPreview';

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

// One italic word inside a heading, echoing the hero's "With Ease". Rule: one word, never a
// whole line, and only in a few sections.
const SerifAccent = ({ children }: { children: React.ReactNode }) => (
  <span className="font-instrument-serif italic">{children}</span>
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
// should toggle back when scrolled away (the element-level scroll reveal is set up in `Landing` below).
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
  const [onDark, setOnDark] = useState(true);
  const [hidden, setHidden] = useState(false);
  const navigate = useNavigate();

  // Over the violet top of the hero the nav is clear with white text. Past it, the nav turns into a
  // frosted pill so it stays readable over any section, and it tucks away while scrolling down
  // (so it never sits on top of what you're reading) and slides back the moment you scroll up.
  useEffect(() => {
    let lastY = window.scrollY;
    const update = () => {
      const y = window.scrollY;
      const hero = document.getElementById('top');
      const darkUntil = hero ? hero.offsetHeight * 0.4 : window.innerHeight * 0.5;
      const overHero = y < darkUntil;
      setOnDark(overHero);
      if (overHero) setHidden(false);
      else if (Math.abs(y - lastY) > 6) setHidden(y > lastY);
      lastY = y;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const navLinks = [
    { label: 'Home', href: '#top' },
    { label: 'Product', href: '#product' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ];

  const linkColor = onDark ? 'text-white/80 hover:text-white' : 'text-gray-700 hover:text-black';
  const ctaColor = onDark ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-[#5b3fc4]';

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 px-4 pt-4 transition-transform duration-300 ease-out md:px-8 lg:px-12 ${
        hidden && !isOpen ? '-translate-y-[120%]' : 'translate-y-0'
      }`}
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full border px-5 py-3 transition-all duration-300 ${
          onDark
            ? 'border-transparent bg-transparent shadow-none'
            : 'border-black/[0.06] bg-white/75 shadow-[0_8px_30px_rgba(59,31,143,0.10)] backdrop-blur-xl'
        }`}
      >
        <a href="#top" className="flex items-center">
          <img
            src="/onswift-logo-white.png"
            alt="OnSwift"
            className="h-7 w-auto transition-[filter] duration-300"
            style={{ filter: onDark ? 'none' : 'brightness(0)' }}
          />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={`inline-block py-3 text-sm font-medium transition-colors duration-300 ${linkColor}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          className={`hidden min-h-[40px] rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 md:block ${ctaColor}`}
          onClick={() => navigate('/get-started')}
          type="button"
        >
          Get Started
        </button>

        <div className="flex items-center gap-2 md:hidden">
          <button
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${ctaColor}`}
            onClick={() => navigate('/get-started')}
            type="button"
          >
            Get Started
          </button>
          <button
            className={`flex h-12 w-12 items-center justify-center transition-colors duration-300 ${onDark ? 'text-white' : 'text-black'}`}
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
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="py-2 text-sm font-medium text-gray-600 transition-colors hover:text-black"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              className="mt-2 rounded-full bg-black py-2.5 text-sm font-semibold text-white"
              onClick={() => { navigate('/get-started'); setIsOpen(false); }}
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

  return (
    <section
      id="top"
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-28 pb-16 text-center"
      // Lavender-to-violet: deep violet behind the white headline for contrast, easing into soft
      // lavender behind the dashboard so the hero melts into the white section below.
      style={{ background: 'linear-gradient(180deg, #3b1f8f 0%, #5b3fc4 30%, #8b6cf0 55%, #c4b5fd 80%, #ede9fe 100%)' }}
    >
      {/* Soft glow accents for depth */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 15% 20%, rgba(196,181,253,0.35), transparent 70%), radial-gradient(ellipse 50% 35% at 85% 35%, rgba(167,139,250,0.3), transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto mt-3 max-w-5xl px-6 md:mt-40">
        {/* Each line rises from under its own mask edge, with a soft bounce. */}
        <h1 className="mb-6 font-instrument-serif text-3xl leading-[1.1] text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl">
          <span className="reveal-item reveal-mask" data-reveal-item data-reveal-delay="150">
            <span>Run Your Service Business</span>
          </span>
          <span className="reveal-item reveal-mask" data-reveal-item data-reveal-delay="450">
            <span className="italic">With Ease .</span>
          </span>
        </h1>

        <p
          className="reveal-item mx-auto mb-10 max-w-xl text-base font-light leading-relaxed text-white/70 md:text-lg"
          data-reveal-item
          data-reveal-delay="1000"
        >
          OnSwift is the operating system for service businesses. You run the projects, your team
          delivers, your clients follow along, and an AI agent handles the busywork in between.
        </p>

        <div
          className="reveal-item hero-cta-split flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          data-reveal-item
          data-reveal-delay="1300"
        >
          <button
            className="group inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-medium text-black transition-all hover:bg-white/90 hover:shadow-lg"
            onClick={() => navigate('/get-started')}
            type="button"
          >
            Get Started
            
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

      {/* Dashboard preview: 15% wider than max-w-5xl (64rem), with light skimming its border */}
      <div
        className="reveal-item relative z-10 mx-auto mt-16 w-full max-w-[73.6rem] px-6"
        data-reveal-item
        data-reveal-delay="1600"
      >
        <div className="relative">
          <div
            className="relative overflow-hidden rounded-2xl border border-white/40"
            style={{
              boxShadow: '0 0 60px rgba(124,92,232,0.35), 0 40px 80px rgba(59,31,143,0.35)',
            }}
          >
            <DashboardPreview />
          </div>
          <div className="hero-ring-glow" aria-hidden="true">
            <div className="hero-ring" />
          </div>
          <div className="hero-ring" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
};

// ─── Trusted By ───────────────────────────────────────────────────────────────

const TrustedBySection = () => (
  <section className="py-12" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div className="mx-auto max-w-5xl px-6">
      <p className="mb-8 text-center text-sm font-medium tracking-widest text-gray-600 uppercase">
        Trusted by growing service businesses
      </p>
      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
        {['OVERBOOKED', 'MATHETES', 'Kaicension', 'AGENCYE'].map((brand) => (
          <span
            key={brand}
            data-reveal-item
            className="text-base font-bold tracking-wider text-gray-500 transition-colors hover:text-black"
          >
            {brand}
          </span>
        ))}
      </div>
    </div>
  </section>
  
);

// ─── Bridge Statement ─────────────────────────────────────────────────────────

// The statement pins to the screen on its own, then fades out as the reader keeps scrolling.
// The section is taller than the viewport so the pinned stretch has room to play out.
const BridgeStatement = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const text = textRef.current;
    if (!section || !text || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 → 1 while it rises into view; then 1 → 0 over the back half of the pinned stretch.
      const enter = clamp(1 - rect.top / (vh * 0.6));
      const progress = clamp(-rect.top / Math.max(1, rect.height - vh));
      const exit = 1 - clamp((progress - 0.3) / 0.6);
      text.style.opacity = String(Math.min(enter, exit));
      text.style.translate = `0 ${(1 - exit) * -40}px`;
      text.style.filter = exit < 1 ? `blur(${(1 - exit) * 6}px)` : '';
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section ref={sectionRef} className="relative h-[200vh]" style={{ background: '#ffffff' }}>
      <div className="sticky top-0 flex h-screen items-center justify-center">
        <p
          ref={textRef}
          className="mx-auto max-w-4xl px-6 text-center text-2xl leading-snug text-black md:text-3xl lg:text-4xl"
        >
          OnSwift puts your projects, your team and your clients in one workspace, with an AI agent
          that keeps it all moving. The business keeps running, even when you step out of the room.
        </p>
      </div>
    </section>
  );
};

// ─── Why OnSwift ──────────────────────────────────────────────────────────────

const WHY_CARDS = [
  { src: '/canv-1.png', alt: 'Easy to Use: simple enough to get started without a learning curve.' },
  { src: '/canv-2.png', alt: 'Operations All in One Place: everything you need to manage your operations, together.' },
  { src: '/canv-3.png', alt: 'Save Time & Energy: spend less time managing the work and more time doing it.' },
];

const WhyOnSwiftSection = () => (
  <section id="product" className="py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="mb-12 flex flex-col items-center text-center">
        <span
          className="mb-5 inline-flex items-center rounded-full bg-black px-3 py-1.5 font-semibold uppercase tracking-[0.12em] text-white"
          style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '8.8px', lineHeight: 1 }}
        >
          Why OnSwift?
        </span>
       
          
        
        <h2 className="mb-4 text-left text-3xl font-instrument-serif font-normal leading-tight text-black md:text-5xl lg:text-6xl">
            Cause <SerifAccent>why not?</SerifAccent>
          </h2>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {WHY_CARDS.map((card) => (
          <img
            key={card.src}
            src={card.src}
            alt={card.alt}
            loading="lazy"
            className="mx-auto w-full max-w-sm rounded-3xl transition-transform duration-300 hover:-translate-y-1"
          />
        ))}
      </div>
    </div>
  </section>
);

// ─── Problem Section ──────────────────────────────────────────────────────────

const ProblemSection = () => (
  <section className="py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-16">
        {/* Content */}
        <div className="flex-1">
          <h2 className="mb-4 text-left text-3xl font-instrument-serif font-normal leading-tight text-black md:text-5xl lg:text-6xl">
            Did You Start a Business to Become a Problem Manager? We <SerifAccent>doubt</SerifAccent> that
          </h2>
          <p className="mb-8 text-base text-gray-600 md:text-lg">
            You built it because you&apos;re great at the work. Somewhere along the way, the work became:
          </p>
          <ul className="flex flex-col gap-4">
            {[
              'Chasing updates across WhatsApp, email and DMs',
              'Paying for five tools that don’t talk to each other',
              'Hearing about missed deadlines after your client does',
              'Re-explaining feedback buried in screenshots and threads',
              'Being the only person who knows where everything is',
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



// ─── Features Bento ───────────────────────────────────────────────────────────

const FeaturesSection = () => {
  const features: FeatureCard[] = [
    {
      title: 'Your Team, Organized',
      description: 'Invite staff and freelancers with one link. Everyone sees exactly the work assigned to them, nothing more.',
      image: '/assets/feature-talent-matching.png',
    },
    {
      title: 'AI Agent',
      description: 'Ask in plain English. It sets up projects, assigns tasks and chases updates, and checks with you before it changes anything.',
      image: '/assets/feature-auto-pm.png',
    },
    {
      title: 'Approvals, Built In',
      description: 'Deliverables are submitted, reviewed and approved in one place, with every revision on record.',
      image: '/assets/feature-quality-control.png',
    },
    {
      title: 'Founder Dashboard & Analytics',
      description: 'Delivery, workload and project health at a glance, so you catch slippage before your client does.',
      image: '/assets/feature-scale.png',
    },
    {
      title: 'Client Portal',
      description: 'Clients onboard through your own forms, follow progress live and message you directly. No more status-update emails.',
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
      className="py-20 transition-colors duration-700 lg:py-28"
      data-reveal
      style={{
        background: inView ? 'hsl(250 76% 63%)' : '#ffffff',
        borderTop: inView ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge light={inView}>Features</SectionBadge>
          <h2 className={`mt-5 text-4xl font-instrument-serif font-normal transition-colors duration-700 md:text-5xl lg:text-6xl ${inView ? 'text-white' : 'text-black'}`}>
            One Workspace <br />That Has Every Moving Part.
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
                <h3 className="mb-2 text-2xl font-instrument-serif font-normal text-black">{f.title}</h3>
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
                <h3 className="mb-2 text-2xl font-instrument-serif font-normal text-black">{f.title}</h3>
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
      title: 'Bring Your Business In',
      description: 'Set up in minutes, not weeks.',
      bullets: [
        'Create projects in a click, or just ask the AI agent',
        'Invite your team with a single link',
        'Send clients a branded onboarding form',
        
      ],
      image: '/assets/feature-invite.png',
      imageLeft: false,
    },
    {
      title: 'Run the Work',
      description: 'Everyone knows what to do next, without asking you.',
      bullets: [
        'Tasks with clear owners, stages and due dates',
        'Conversations next to the work, not lost in WhatsApp',
        'Files and docs right where the project lives',
        'An AI agent that handles the follow-ups',
      ],
      image: '/assets/feature-project-dashboard.png',
      imageLeft: true,
    },
    {
      title: 'Deliver & Grow',
      description: 'Ship work clients approve, and take on more of it.',
      bullets: [
        'Add clients without adding chaos',
        'Clients track progress in their own portal',
        'Review and approve deliverables in one place',
        'Analytics on delivery and team performance',
      ],
      image: '/assets/feature-deadliner.png',
      imageLeft: false,
    },
  ];

  // lg+ only (where the cards pin). A card that has just pinned gets a small settle; cards
  // that a newer card has covered ease back and dim, so the stack reads as layered.
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const cards = cardRefs.current.filter((c): c is HTMLDivElement => !!c);
      const stuck = cards.map((card, i) => wide.matches && card.getBoundingClientRect().top <= 104 + i * 24 + 1);
      cards.forEach((card, i) => {
        const covered = stuck[i] && stuck.slice(i + 1).some(Boolean);
        card.classList.toggle('is-stuck', stuck[i] && !covered);
        card.classList.toggle('is-covered', covered);
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <section id="how-it-works" className="py-20 lg:py-28" style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-14 text-center" data-reveal>
          <SectionBadge>How it Works</SectionBadge>
          <h2 className="mt-5 text-4xl font-instrument-serif font-normal text-black md:text-5xl lg:text-6xl">
            From Kickoff to Client Approval, <br />in One <SerifAccent>Flow</SerifAccent>.
          </h2>
        </div>

        {/* Sticky stack: each step pins a little lower than the last as you scroll, so they pile up like cards.
            lg+ only — on small screens the cards are already too tall to pin without feeling broken, so they
            just scroll normally. */}
        <div className="flex flex-col gap-6">
          {steps.map((step, index) => (
            <div
              key={step.title}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              className="how-card overflow-hidden rounded-3xl lg:sticky"
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
                  <h3 className="mb-3 text-3xl font-instrument-serif font-normal text-black md:text-4xl">{step.title}</h3>
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
      id: "creators",
      title: 'For Creators & Founders',
      description: 'Run every project, person and client from one dashboard, from a one-person studio to a 50-person agency. Delegate with confidence and get your evenings back.',
      image: '/assets/feature-blur.png',
    },
    {
      id: "teams",
      title: "For Your Team",
      description: "Staff and freelancers, local or remote, get a clear list of what's theirs, when it's due and where the files are. Less pinging, more doing.",
      image: '/assets/feature-soup.png',
    },
    {
      id: "clients",
      title: "For Your Clients",
      description: "A professional portal to onboard, follow progress, review work and talk to you. Clients feel looked after without chasing you for updates.",
      image: "/assets/feature-client-portal.png",
    },
    {
      id: "consultants",
      title: "For Coaches & Consultants",
      description: "Deliver a premium client experience with the back office of a much larger firm, without hiring an operations manager.",
      image: '/assets/feature-coaching-d.png',
    },
  ];

  const [sectionRef, inView] = useInViewToggle<HTMLElement>();

  return (
    <section
      id="creator-tools"
      ref={sectionRef}
      className="py-20 transition-colors duration-700 lg:py-28"
      data-reveal
      style={{
        background: inView ? '#000000' : '#ffffff',
        borderTop: inView ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge light={inView}>Who It&apos;s For</SectionBadge>
          <h2 className={`mt-5 text-4xl font-instrument-serif font-normal transition-colors duration-700 md:text-5xl lg:text-6xl ${inView ? 'text-white' : 'text-black'}`}>
            One Platform<br />For Every Side of the Work.
          </h2>
          <p className={`mt-4 text-base transition-colors duration-700 ${inView ? 'text-white/80' : 'text-gray-600'}`}>
            Creators get control, teams get clarity and clients get confidence.
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
                <h3 className="mb-2 text-2xl font-instrument-serif font-normal text-black">{card.title}</h3>
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
    <section id="testimonials" className="py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge>Testimonials</SectionBadge>
          <h2 className="mt-5 text-4xl font-instrument-serif font-normal text-black md:text-5xl lg:text-6xl">
            Founders Who Stopped <br />Being the Bottleneck
          </h2>
        </div>

        {/* Large quote cards: a wide soft-gradient card beside a narrow solid accent,
            then the third quote across the full width. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {testimonials.map((t, i) => {
            const accent = i === 1;
            return (
              <figure
                key={t.author}
                className={`relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-2xl p-7 md:min-h-[420px] md:p-9 ${
                  i === 0 ? 'lg:col-span-3' : i === 1 ? 'lg:col-span-2' : 'lg:col-span-5 lg:min-h-[320px]'
                }`}
                style={{
                  background: accent
                    ? '#7c5ce8'
                    : i === 0
                      ? 'linear-gradient(160deg, #dcd3ff 0%, #ece8ff 45%, #f6f2ff 100%)'
                      : 'linear-gradient(160deg, #e8f0ff 0%, #efeaff 55%, #f8f5ff 100%)',
                }}
              >
                {/* Faint oversized quote mark as the watermark */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 80"
                  className="pointer-events-none absolute -right-8 top-1/2 w-[340px] -translate-y-1/2 md:w-[420px]"
                  fill={accent ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.55)'}
                >
                  <path d="M0 80V48C0 22 12 6 36 0l5 10C28 15 22 24 21 36h19v44H0Zm56 0V48C56 22 68 6 92 0l5 10C84 15 78 24 77 36h19v44H56Z" />
                </svg>

                <blockquote
                  className={`relative max-w-xl pl-[0.4em] text-xl leading-snug tracking-tight md:text-2xl lg:text-[1.7rem] ${
                    accent ? 'text-white' : 'text-[#14112a]'
                  }`}
                  style={{ textIndent: '-0.4em' }}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <figcaption className="relative mt-10 flex items-center gap-4">
                  <img src={t.avatar} alt={t.author} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                  <span className={`h-9 w-px ${accent ? 'bg-white/30' : 'bg-black/10'}`} aria-hidden="true" />
                  <span>
                    <span className={`block text-sm font-semibold ${accent ? 'text-white' : 'text-black'}`}>{t.author}</span>
                    <span className={`block text-xs ${accent ? 'text-white/75' : 'text-gray-600'}`}>{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const FAQSection = () => {
  const [open, setOpen] = useState<number | null>(null);

  const faqs: FaqItem[] = [
    { question: 'Is this just another project management tool?', answer: 'No. Project tools stop at tasks. OnSwift runs the whole service business: your team, your client portal, onboarding forms, approvals, files, chat and analytics, with an AI agent working across all of it.' },
    { question: 'Who is OnSwift for?', answer: 'Service businesses that deliver work for clients: agencies, studios, creators scaling into agencies, coaches and consultants. It works for a team of one and a team of fifty.' },
    { question: 'What does the AI agent actually do?', answer: 'It knows your workspace. Ask it to set up a project, break work into tasks, assign people or summarize where things stand. Anything that changes your data is proposed first and only runs when you approve it.' },
    { question: 'What can my clients see?', answer: 'Only what you invite them to. Each client gets their own portal for the projects they’re part of, where they can follow progress, fill in your forms and message you.' },
    { question: 'Can I bring my current team?', answer: 'Yes. Invite staff and freelancers with a link and they’re in. Everyone sees just the work assigned to them.' },
    { question: 'How long does it take to set up?', answer: 'Most founders are up and running in under 30 minutes. No technical skills needed: if you can use WhatsApp, you can use OnSwift.' },
  ];

  return (
    <section id="faq" className="py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          {/* Left: title */}
          <div className="lg:w-80 lg:shrink-0">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="mt-5 text-4xl font-instrument-serif font-normal leading-tight text-black md:text-5xl">
              Questions, Answered
            </h2>
            <p className="mt-4 text-base text-gray-600">
              Still unsure? <a href="#contact" className="font-medium text-[#5b3fc4] hover:underline">Talk to us.</a>
            </p>
          </div>

          {/* Right: accordion */}
          <div className="flex flex-1 flex-col gap-3">
            {faqs.map((item, i) => (
              <div
                key={item.question}
                data-reveal-item
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
    <section className="py-20 lg:py-28" data-reveal style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div
          className="mx-auto max-w-4xl overflow-hidden rounded-3xl p-10 text-center md:p-16"
          style={{
            background: 'linear-gradient(140deg, #2d1b5e 0%, #46299c 50%, #5b3fc4 100%)',
          }}
        >
          <h2 className="mb-5 text-4xl font-instrument-serif font-normal leading-tight text-white md:text-6xl lg:text-7xl">
            Stop Being<br />the <SerifAccent>Bottleneck</SerifAccent>.
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-white/80">
            Bring your projects, your team and your clients into one calm workspace.
            Set up in minutes. Free to start.
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 transition-all hover:bg-white/90"
            onClick={() => navigate('/get-started')}
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

// Public contact address shown in the footer's Contact column.
const CONTACT_EMAIL = 'contact.support@onswift.org';

const Footer = () => (
  <footer
    id="contact"
    className="py-16"
    data-reveal
    style={{ background: '#ffffff', borderTop: '1px solid rgba(0,0,0,0.08)' }}
  >
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
        {/* Col 1: Logo + tagline */}
        <div>
          <img src="/onswift-logo-white.png" alt="OnSwift" className="mb-4 h-7 w-auto" style={{ filter: 'brightness(0)' }} />
          <p className="text-sm leading-relaxed text-gray-600">
            The operating system for service businesses. Projects, team and clients in one calm
            workspace, with an AI agent that keeps it all moving.
          </p>
        </div>

        {/* Col 2: Company */}
        <div>
          <p className="mb-4 text-sm font-semibold text-black">Company</p>
          <ul className="flex flex-col gap-3">
            {[
              { label: 'Product', href: '#product' },
              { label: 'FAQ', href: '#faq' },
              { label: 'Blog', href: '/blog' },
            ].map((link) => (
              <li key={link.label}>
                {link.href.startsWith('/') ? (
                  <Link to={link.href} className="inline-block py-1 text-sm text-gray-600 transition-colors hover:text-black">{link.label}</Link>
                ) : (
                  <a href={link.href} className="inline-block py-1 text-sm text-gray-600 transition-colors hover:text-black">{link.label}</a>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Contact */}
        <div>
          <p className="mb-4 text-sm font-semibold text-black">Contact</p>
          <p className="mb-3 text-sm leading-relaxed text-gray-600">
            Questions, partnerships or a walkthrough for your team? We reply within one business day.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-block py-1 text-sm font-semibold text-[#5b3fc4] transition-colors hover:text-black"
          >
            {CONTACT_EMAIL}
          </a>
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
        <p className="text-center text-xs text-gray-600">© {new Date().getFullYear()} OnSwift. The operating system for service businesses.</p>
      </div>
    </div>
  </footer>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

// Pieces inside a [data-reveal] section that animate in on their own, in reading order.
// An element already inside a picked element is skipped, so a card moves as one unit.
const REVEAL_PICK = 'h1, h2, h3, p, li, img, button, blockquote, span[class*="rounded-full"], .grid > *, [data-reveal-item]';
const REVEAL_STAGGER_MS = 120;
const REVEAL_MAX_STAGGER = 6;

function collectRevealItems(): HTMLElement[] {
  const picked: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('#top [data-reveal-item]'));
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((section) => {
    section.querySelectorAll<HTMLElement>(REVEAL_PICK).forEach((el) => {
      if (!picked.some((p) => p === el || p.contains(el))) picked.push(el);
    });
  });
  return picked;
}

export default function Landing() {
  // Layout effect: items are hidden before the first paint, so nothing flashes in and back out.
  useLayoutEffect(() => {
    const items = collectRevealItems();
    items.forEach((el) => el.classList.add('reveal-item'));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entering = entries
          .filter((e) => e.isIntersecting && !e.target.classList.contains('is-visible'))
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);

        entering.forEach((entry, i) => {
          const el = entry.target as HTMLElement;
          // The hero's slow choreographed delays apply on first load only; later passes use the stagger.
          const fixed = el.dataset.revealDelay;
          delete el.dataset.revealDelay;
          el.style.setProperty(
            '--reveal-delay',
            `${fixed ?? Math.min(i, REVEAL_MAX_STAGGER) * REVEAL_STAGGER_MS}ms`
          );
          el.classList.add('is-visible');
        });

        entries.forEach((entry) => {
          if (entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          // Left through the top (reader scrolled down past it): next time it comes back from above.
          const exitedAbove = entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0);
          el.style.setProperty('--reveal-from', exitedAbove ? '-1' : '1');
          el.classList.remove('is-visible');
        });
      },
      // A small inset so items animate once they're properly on screen, not at the very edge.
      { threshold: 0, rootMargin: '-6% 0px -6% 0px' }
    );

    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '#ffffff' }}>
      <div>
        <Navigation />
        <HeroSection />
        <TrustedBySection />
        <BridgeStatement />
        <WhyOnSwiftSection />
        <ProblemSection />
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
