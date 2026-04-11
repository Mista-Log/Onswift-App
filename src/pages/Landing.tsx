import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Menu, Minus, Plus, X } from 'lucide-react';

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
  large?: boolean;
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

const TEAL = '#00d4aa';

const TealCheck = () => (
  <span
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
    style={{ background: TEAL }}
  >
    <Check className="h-4 w-4 text-white" strokeWidth={3} />
  </span>
);

const TealX = () => (
  <span
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
    style={{ background: TEAL }}
  >
    <X className="h-4 w-4 text-white" strokeWidth={3} />
  </span>
);

const SectionBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block rounded-full px-5 py-2 text-sm font-semibold text-white"
    style={{ background: 'rgba(124, 92, 232, 0.35)', border: '1px solid rgba(124, 92, 232, 0.5)' }}>
    {children}
  </span>
);

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
  ];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 md:px-8 lg:px-12">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3"
        style={{
          background: 'rgba(15, 10, 30, 0.85)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <a href="/" className="flex items-center">
          <img src="/onswift-logo-white.png" alt="OnSwift" className="h-7 w-auto" />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          className="hidden rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 transition-all hover:bg-white/90 md:block"
          onClick={() => navigate('/signup')}
          type="button"
        >
          Get Started
        </button>

        <button
          className="p-2 text-white md:hidden"
          onClick={() => setIsOpen((o) => !o)}
          aria-label="Toggle menu"
          type="button"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {isOpen && (
        <div
          className="mx-auto mt-2 max-w-6xl rounded-2xl p-5 md:hidden"
          style={{
            background: 'rgba(15, 10, 30, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="py-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <button
              className="mt-2 rounded-full bg-white py-2.5 text-sm font-semibold text-gray-900"
              onClick={() => { navigate('/signup'); setIsOpen(false); }}
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
      className="reveal relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-28 pb-16 text-center"
      data-reveal
      style={{ background: 'hsl(270 50% 5%)' }}
    >
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, hsla(262,83%,46%,0.35) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto mt-50 max-w-4xl px-6 md:mt-56">
        <h1
          className="animate-fade-in-up mb-6 text-5xl font-black leading-[1.05] text-white opacity-0 md:text-7xl lg:text-8xl"
          style={{ animationDelay: '0.1s' }}
        >
          Run Your Agency<br />Without Chaos
        </h1>

        <p
          className="animate-fade-in-up mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/60 opacity-0 md:text-lg"
          style={{ animationDelay: '0.25s' }}
        >
          Hire better people, manage projects calmly, and stop being the bottleneck,
          all with OnSwift, an all-in-one operating system for modern agencies.
        </p>

        <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0.4s' }}>
          <button
            className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 transition-all hover:bg-white/90 hover:shadow-lg"
            onClick={() => navigate('/signup')}
            type="button"
          >
            Get Started, It&apos;s Free!
          </button>
        </div>
      </div>

      {/* Dashboard preview */}
      <div className="relative z-10 mx-auto mt-16 w-full max-w-5xl px-6">
        <div
          className="relative overflow-hidden rounded-2xl border border-white/10"
          style={{
            boxShadow: '0 0 60px hsla(262,83%,56%,0.4), 0 40px 80px rgba(0,0,0,0.5)',
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
  <section className="reveal py-12" data-reveal style={{ background: 'hsl(270 50% 5%)' }}>
    <div className="mx-auto max-w-5xl px-6">
      <p className="mb-8 text-center text-sm font-medium tracking-widest text-white/40 uppercase">
        Trusted By
      </p>
      <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
        {['OVERBOOKED', 'MATHETES', 'Kaicension', 'AGENCYE'].map((brand) => (
          <span
            key={brand}
            className="text-base font-bold tracking-wider text-white/25 transition-colors hover:text-white/50"
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
  <section className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(268 48% 4%)' }}>
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
        <img
          src="/assets/onswift_customer.png"
          alt="OnSwift Customer"
          className="w-full max-w-xs shrink-0 rounded-3xl border border-white/10 lg:w-72"
        />

        {/* Content */}
        <div className="flex-1">
          <h2 className="mb-4 text-3xl font-black leading-tight md:text-4xl lg:text-5xl" style={{ color: TEAL }}>
            You Didn&apos;t Start an Agency to Become a Project Manager.
          </h2>
          <p className="mb-8 text-base text-white/55 md:text-lg">
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
                <TealX />
                <span className="text-base font-medium text-white/85 md:text-lg">{pain}</span>
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
  <section className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(268 48% 4%)' }}>
    <div className="mx-auto max-w-4xl px-6 text-center">
      <p className="text-2xl font-black leading-snug text-white md:text-3xl lg:text-4xl">
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
      large: true,
    },
    {
      title: 'Quality & Accountability',
      description: 'Every task has clear ownership.',
      image: '/assets/feature-communication.png',
      large: true,
      // imageClassName: 'object-contain object-center',
      // imageWrapClassName: 'flex items-center justify-center',
    },
  ];

  return (
    <section id="features" className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(270 50% 5%)' }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge>Features</SectionBadge>
          <h2 className="mt-5 text-3xl font-black md:text-4xl lg:text-5xl" style={{ color: TEAL }}>
            Everything Your Agency Needs, <br />In One Place.
          </h2>
        </div>

        {/* Top row: 3 cards */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.slice(0, 3).map((f) => (
            <div
              key={f.title}
              className="glass-card-feature flex flex-col overflow-hidden rounded-2xl p-0"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
            >
              <div className={`overflow-hidden bg-white/5 p-4 ${f.imageWrapClassName ?? ''}`}>
                <img src={f.image} alt={f.title} className={`h-auto w-full ${f.imageClassName ?? ''}`} />
              </div>
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
                <p className="text-base leading-relaxed text-white/55">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row: 2 larger cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.slice(3).map((f) => (
            <div
              key={f.title}
              className="glass-card-feature flex flex-col overflow-hidden rounded-2xl p-0"
              style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
            >
              <div className={`overflow-hidden bg-white/5 p-4 ${f.imageWrapClassName ?? ''}`}>
                <img src={f.image} alt={f.title} className={`h-auto w-full ${f.imageClassName ?? ''}`} />
              </div>
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold text-white">{f.title}</h3>
                <p className="text-base leading-relaxed text-white/55">{f.description}</p>
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
    <section id="how-it-works" className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(268 48% 4%)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-14 text-center">
          <SectionBadge>How it Works</SectionBadge>
          <h2 className="mt-5 text-3xl font-black md:text-4xl lg:text-5xl" style={{ color: TEAL }}>
            All-in-One Operating <br />System for Agencies.
          </h2>
        </div>

        <div className="flex flex-col gap-6">
          {steps.map((step) => (
            <div
              key={step.title}
              className="overflow-hidden rounded-3xl"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className={`flex flex-col gap-8 p-8 lg:flex-row lg:items-center lg:gap-12 lg:p-12 ${step.imageLeft ? 'lg:flex-row-reverse' : ''}`}>
                {/* Text */}
                <div className="flex-1">
                  <h3 className="mb-3 text-2xl font-black text-white md:text-3xl">{step.title}</h3>
                  <p className="mb-6 text-base text-white/55">{step.description}</p>
                  <ul className="flex flex-col gap-3">
                    {step.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-3">
                        <TealCheck />
                        <span className="text-base font-medium text-white/85">{b}</span>
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

  return (
    <section id="creator-tools" className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(270 50% 5%)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge>Social &amp; Creator Tools</SectionBadge>
          <h2 className="mt-5 text-3xl font-black text-white md:text-4xl lg:text-5xl">
            Built for Agencies &amp; Creators<br />Who Are Scaling into Agencies
          </h2>
          <p className="mt-4 text-base text-white/55">
            OnSwift supports how modern founders actually work.
          </p>
        </div>
          {/* {Card Section} */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.id}
              className="overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="p-6">
                <h3 className="mb-2 text-lg font-bold text-white">{card.title}</h3>
                <p className="mb-4 text-sm leading-relaxed text-white/55">{card.description}</p>
              </div>
              <div className="overflow-hidden bg-white/5 p-4">
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
    <section id="testimonials" className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(268 48% 4%)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="mb-12 text-center">
          <SectionBadge>Testimonials</SectionBadge>
          <h2 className="mt-5 text-3xl font-black md:text-4xl lg:text-5xl" style={{ color: TEAL }}>
            What Founders Who Uses <br />Onswift Says Says
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="flex flex-col justify-between rounded-2xl p-7"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <p className="mb-6 text-sm leading-relaxed text-white/75">{t.quote}</p>
              <div className="flex items-center gap-3 border-t border-white/10 pt-5">
                <img
                  src={t.avatar}
                  alt={t.author}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{t.author}</p>
                  <p className="text-xs text-white/45">{t.role}</p>
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
    <section id="faq" className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(270 50% 5%)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
          {/* Left: title */}
          <div className="lg:w-80 lg:shrink-0">
            <SectionBadge>FAQ</SectionBadge>
            <h2 className="mt-5 text-3xl font-black leading-tight md:text-4xl" style={{ color: TEAL }}>
              Everything You Want to Know
            </h2>
            <p className="mt-4 text-base text-white/50">Still unsure? We&apos;ve got you.</p>
          </div>

          {/* Right: accordion */}
          <div className="flex flex-1 flex-col gap-3">
            {faqs.map((item, i) => (
              <div
                key={item.question}
                className="overflow-hidden rounded-2xl transition-colors"
                style={{
                  background: open === i ? 'rgba(124,92,232,0.15)' : 'rgba(255,255,255,0.04)',
                  border: open === i ? '1px solid rgba(124,92,232,0.4)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <button
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                  onClick={() => setOpen(open === i ? null : i)}
                  type="button"
                >
                  <span className="text-base font-semibold text-white">{item.question}</span>
                  <span className="ml-4 shrink-0 text-white/60">
                    {open === i ? <Minus size={18} /> : <Plus size={18} />}
                  </span>
                </button>
                {open === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm leading-relaxed text-white/60">{item.answer}</p>
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
    <section className="reveal py-20 lg:py-28" data-reveal style={{ background: 'hsl(268 48% 4%)' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div
          className="mx-auto max-w-4xl overflow-hidden rounded-3xl p-10 text-center md:p-16"
          style={{
            background: 'linear-gradient(140deg, #0b0f1e 0%, #2a144f 45%, #6e2ccf 85%, #8a4ae8 100%)',
          }}
        >
          <h2 className="mb-5 text-3xl font-black leading-tight text-white md:text-5xl lg:text-6xl">
            Run Your Agency<br />Without Chaos
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-white/70">
            Hire better people, manage projects calmly, and stop being the bottleneck,
            all with OnSwift, an all-in-one operating system for agencies.
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 transition-all hover:bg-white/90"
            onClick={() => navigate('/signup')}
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
    style={{ background: 'hsl(270 50% 5%)', borderTop: '1px solid rgba(255,255,255,0.06)' }}
  >
    <div className="mx-auto max-w-6xl px-6 lg:px-10">
      <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
        {/* Col 1: Logo + tagline */}
        <div>
          <img src="/onswift-logo-white.png" alt="OnSwift" className="mb-4 h-7 w-auto" />
          <p className="text-sm leading-relaxed text-white/45">
            Hire better people, manage projects calmly, and stop being the bottleneck,
            all with OnSwift, an all-in-one operating system for agencies.
          </p>
        </div>

        {/* Col 2: Company */}
        <div>
          <p className="mb-4 text-sm font-semibold text-white">Company</p>
          <ul className="flex flex-col gap-3">
            {['About Us', 'Contact', 'Product', 'Newsletter', 'Blogs', 'Pricing'].map((link) => (
              <li key={link}>
                <a href="#" className="text-sm text-white/45 transition-colors hover:text-white/80">{link}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Resources */}
        <div>
          <p className="mb-4 text-sm font-semibold text-white">Resources</p>
          <ul className="flex flex-col gap-3">
            {['Terms of Service', 'Privacy Policy'].map((link) => (
              <li key={link}>
                <a href="#" className="text-sm text-white/45 transition-colors hover:text-white/80">{link}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-12 border-t border-white/8 pt-8">
        <p className="text-center text-xs text-white/30">© 2025 OnSwift. Calm systems for growing agencies.</p>
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

    let hideTimer: number | undefined;
    const loaderTimer = window.setTimeout(() => {
      setIsLoaded(true);
      hideTimer = window.setTimeout(() => setShowLoader(false), 300);
    }, 5000);

    return () => {
      window.clearTimeout(loaderTimer);
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
    <div className="dark min-h-screen" style={{ background: 'hsl(270 50% 5%)' }}>
      {showLoader && (
        <div className={`loader-screen ${isLoaded ? 'is-fading' : ''}`} aria-hidden="true">
          <div className="loader-center">
            <span className="loader-ring loader-ring--a" />
            <span className="loader-ring loader-ring--b" />
            <img src="/onswift logo.png" alt="OnSwift" className="loader-logo" />
          </div>
        </div>
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
