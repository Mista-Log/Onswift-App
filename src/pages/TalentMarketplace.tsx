import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { FreelancerCard } from "@/components/talent/FreelancerCard";
import { HireComingSoonModal } from "@/components/talent/HireComingSoonModal";
import { Button } from "@/components/ui/button";
import { Search, Zap, Users, Bot, Sparkles, Workflow, BrainCircuit, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { publicFetch } from "@/api/apiClient";
import { cn } from "@/lib/utils";

// ── Keyframe injection ────────────────────────────────────────────────────────

const TM_STYLES = `
  @keyframes tm-float {
    0%, 100% { transform: translateY(0px) scale(1); }
    50% { transform: translateY(-22px) scale(1.06); }
  }
  @keyframes tm-float-alt {
    0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
    33% { transform: translateY(-14px) scale(1.04) rotate(4deg); }
    66% { transform: translateY(10px) scale(0.97) rotate(-3deg); }
  }
  @keyframes tm-card-in {
    from { opacity: 0; transform: translateY(32px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes tm-text-in {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
  @keyframes tm-badge-in {
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0);     }
  }
  @keyframes tm-shimmer {
    from { background-position: -200% center; }
    to   { background-position:  200% center; }
  }
  @keyframes tm-pulse-ring {
    0%, 100% { box-shadow: 0 0 0 0 hsl(250 76% 63% / 0.4); }
    50%       { box-shadow: 0 0 0 8px hsl(250 76% 63% / 0); }
  }
`;

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: "All",     emoji: "✦",  keywords: [] as string[], color: "#a78bfa" },
  { label: "Design",  emoji: "🎨", keywords: ["design","ui","ux","graphic","illustrat","brand"], color: "#a78bfa" },
  { label: "Video",   emoji: "🎬", keywords: ["video","motion","film","edit","cinema"],           color: "#fb923c" },
  { label: "Audio",   emoji: "🎵", keywords: ["sound","audio","music","podcast"],                 color: "#34d399" },
  { label: "Dev",     emoji: "💻", keywords: ["dev","engineer","code","software","web"],          color: "#60a5fa" },
  { label: "3D",      emoji: "🧊", keywords: ["3d","model","sculpt","blend","maya"],              color: "#f472b6" },
  { label: "Photo",   emoji: "📸", keywords: ["photo","camera","portrait"],                       color: "#fbbf24" },
  { label: "Writing", emoji: "✍️", keywords: ["writ","content","copy","blog"],                    color: "#2dd4bf" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function TalentMarketplace() {
  const [searchQuery,    setSearchQuery]    = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [freelancers,    setFreelancers]    = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [hireModalOpen,    setHireModalOpen]    = useState(false);
  const [selectedTalent,   setSelectedTalent]   = useState<string | null>(null);
  const [agentsModalOpen,  setAgentsModalOpen]  = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res  = await publicFetch("/api/v1/user/talentprofile/");
        if (!res.ok) throw new Error();
        setFreelancers(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  const keywords = CATEGORIES.find(c => c.label === categoryFilter)?.keywords ?? [];

  const filtered = useMemo(() => freelancers.filter(f => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      !q ||
      (f.name ?? "").toLowerCase().includes(q) ||
      (f.role ?? "").toLowerCase().includes(q) ||
      (f.skills ?? []).some((s: string) => (s ?? "").toLowerCase().includes(q));
    const matchCat =
      categoryFilter === "All" ||
      keywords.some(kw => (f.role ?? "").toLowerCase().includes(kw));
    return matchSearch && matchCat;
  }), [freelancers, searchQuery, categoryFilter, keywords]);

  const uniqueSkills = useMemo(
    () => [...new Set(freelancers.flatMap(f => f.skills))].length,
    [freelancers]
  );

  const handleHire = (name: string) => { setSelectedTalent(name); setHireModalOpen(true); };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <MainLayout>
        <style>{TM_STYLES}</style>
        <div
          className="flex flex-col items-center justify-center gap-5 rounded-2xl"
          style={{
            minHeight: 320,
            background: "linear-gradient(135deg, hsl(270 55% 4%) 0%, hsl(260 50% 8%) 100%)",
          }}
        >
          <div
            className="h-12 w-12 rounded-full border-2 border-transparent"
            style={{
              borderTopColor: "hsl(250 76% 63%)",
              borderRightColor: "hsl(280 70% 60% / 0.5)",
              animation: "loader-spin 1s linear infinite",
            }}
          />
          <p style={{ color: "hsl(250 40% 70%)", fontSize: 14, letterSpacing: "0.08em" }}>
            CURATING TALENT…
          </p>
        </div>
      </MainLayout>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <style>{TM_STYLES}</style>

      <div className="space-y-5">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: "linear-gradient(135deg, hsl(270 55% 4%) 0%, hsl(262 50% 7%) 50%, hsl(270 55% 4%) 100%)",
            padding: "clamp(40px, 6vw, 72px) clamp(28px, 5vw, 64px)",
          }}
        >
          {/* Floating orbs */}
          <div className="pointer-events-none absolute" style={{
            top: -120, left: -120, width: 480, height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, hsl(260 80% 60% / 0.4) 0%, transparent 70%)",
            animation: "tm-float 9s ease-in-out infinite",
          }} />
          <div className="pointer-events-none absolute" style={{
            bottom: -80, right: -60, width: 360, height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, hsl(285 70% 50% / 0.3) 0%, transparent 70%)",
            animation: "tm-float-alt 13s ease-in-out infinite",
          }} />
          <div className="pointer-events-none absolute" style={{
            top: "30%", right: "20%", width: 180, height: 180,
            borderRadius: "50%",
            background: "radial-gradient(circle, hsl(310 70% 60% / 0.2) 0%, transparent 70%)",
            animation: "tm-float 7s ease-in-out infinite 2.5s",
          }} />

          {/* Noise overlay for texture */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
          />

          {/* Content */}
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div style={{ maxWidth: 620 }}>

              {/* Eyebrow */}
              <div
                className="mb-4 inline-flex items-center gap-2"
                style={{ animation: "tm-badge-in 0.6s ease-out 0.1s both" }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
                  color: "hsl(260 60% 75%)", textTransform: "uppercase",
                }}>
                  ✦ AI/Talent Marketplace
                </span>
                {/* <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "2px 10px", borderRadius: 999,
                  background: "hsl(145 70% 40% / 0.15)",
                  border: "1px solid hsl(145 70% 40% / 0.3)",
                  fontSize: 11, fontWeight: 600, color: "hsl(145 60% 60%)",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(145 70% 50%)", display: "inline-block", animation: "tm-pulse-ring 2s ease-in-out infinite" }} />
                  Live
                </span> */}
              </div>

              {/* Headline */}
              <h1
                style={{
                  fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)",
                  fontWeight: 900,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: "white",
                  animation: "tm-text-in 0.7s ease-out 0.2s both",
                }}
              >
                Hire the world's
                <br />
                best{" "}
                <span style={{
                  backgroundImage: "linear-gradient(90deg, hsl(273, 93%, 54%), #ffffff, hsl(273, 93%, 54%))",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "tm-shimmer 4s linear infinite",
                }}>
                Creative <br></br>talents & AI agents
                </span>
                <br />instantly.
              </h1>

              {/* Sub */}
              <p style={{
                marginTop: 20, fontSize: 16, color: "hsl(260 30% 65%)", lineHeight: 1.6,
                animation: "tm-text-in 0.7s ease-out 0.35s both",
              }}>
                Curated creatives. Agentic systems. Zero compromise. Your vision, perfectly executed.
              </p>

              {/* Stats */}
              {freelancers.length > 0 && (
                <div
                  className="flex flex-wrap gap-5 mt-5"
                  style={{ animation: "tm-text-in 0.7s ease-out 0.45s both" }}
                >
                  {[
                    { icon: <Users size={14} />, val: `${freelancers.length}`, label: "Talents" },
                    { icon: <Zap size={14} />,   val: `99+`,      label: "Agent skills" },
                  ].map(({ icon, val, label }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span style={{ color: "hsl(250 76% 70%)" }}>{icon}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "white" }}>{val}</span>
                      <span style={{ fontSize: 13, color: "hsl(260 25% 55%)" }}>{label}</span>
                    </div>
                  ))}
                </div>
              )}

             {/* Search WOULD BE ADDRESSED AT A LATER TIME */}
              {/* <div
                className="relative mt-6"
                style={{ animation: "tm-text-in 0.7s ease-out 0.55s both", maxWidth: 520 }}
              >
                <Search style={{
                  position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)",
                  color: "hsl(250 60% 65%)", width: 17, height: 17,
                }} />
                <input
                  type="text"
                  placeholder="Search by name, skill, or role…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", height: 52, paddingLeft: 50, paddingRight: 20,
                    background: "hsl(270 40% 10%)",
                    border: "1px solid hsl(250 50% 25% / 0.7)",
                    borderRadius: 14, color: "white", fontSize: 14,
                    outline: "none", transition: "border-color 200ms, box-shadow 200ms",
                    fontFamily: "inherit",
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = "hsl(250 76% 63% / 0.8)";
                    e.currentTarget.style.boxShadow  = "0 0 0 3px hsl(250 76% 63% / 0.15)";
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = "hsl(250 50% 25% / 0.7)";
                    e.currentTarget.style.boxShadow  = "none";
                  }}
                />
              </div> */}
            </div>

            {/* ── Explore Agents CTA (right slot) ─────────────────────────── */}
            <div
              className="flex flex-col items-start lg:items-end gap-3"
              style={{ animation: "tm-text-in 0.7s ease-out 0.6s both", flexShrink: 0 }}
            >
              {/* Label above the button */}
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
                color: "hsl(0, 0%, 100%)", textTransform: "uppercase",
              }}>
                ✦ Powered by AI
              </p>

              {/* Main button */}
              <button
                onClick={() => setAgentsModalOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "16px 28px", borderRadius: 16,
                  background: "linear-gradient(135deg, hsl(270 60% 16%), hsl(273, 93%, 54%))",
                  border: "1px solid hsl(270 50% 35% / 0.6)",
                  boxShadow: "0 0 32px hsl(270 70% 50% / 0.2), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
                  cursor: "pointer", transition: "all 220ms ease",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform   = "translateY(-3px)";
                  el.style.boxShadow   = "0 0 48px hsl(270 70% 55% / 0.35), inset 0 1px 0 hsl(0 0% 100% / 0.08)";
                  el.style.borderColor = "hsl(270 60% 50% / 0.8)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform   = "translateY(0)";
                  el.style.boxShadow   = "0 0 32px hsl(270 70% 50% / 0.2), inset 0 1px 0 hsl(0 0% 100% / 0.06)";
                  el.style.borderColor = "hsl(270 50% 35% / 0.6)";
                }}
              >
                {/* Pulsing icon container */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: "linear-gradient(135deg, hsl(273, 93%, 54%), hsl(273, 93%, 54%))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 16px hsl(270 70% 50% / 0.5)",
                  animation: "tm-pulse-ring 2.5s ease-in-out infinite",
                  flexShrink: 0,
                }}>
                  <Bot size={20} color="white" />
                </div>

                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "white", lineHeight: 1.2 }}>
                    Explore AI Agents
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(270 40% 65%)", marginTop: 2 }}>
                    Automate your processes
                  </div>
                </div>

                <span style={{ color: "hsl(270 50% 65%)", fontSize: 18, marginLeft: 4 }}>→</span>
              </button>

              {/* Small teaser chips */}
              <div className="flex gap-2">
                {["Custom Agents", "Always On", "AI-Native"].map(tag => (
                  <span key={tag} style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600,
                    background: "hsl(270 40% 12%)",
                    border: "1px solid hsl(270 35% 22%)",
                    color: "hsl(270 35% 60%)",
                    letterSpacing: "0.04em",
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── CATEGORY RAIL ─────────────────────────────────────────────────── */}
        {/* <div className="flex gap-2 overflow-x-auto py-0.5" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => {
            const active = categoryFilter === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => setCategoryFilter(cat.label)}
                style={{
                  flexShrink: 0,
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: active
                    ? `linear-gradient(135deg, ${cat.color}30, ${cat.color}18)`
                    : "hsl(270 25% 10% / 0.5)",
                  border: `1px solid ${active ? cat.color + "60" : "hsl(270 25% 20% / 0.8)"}`,
                  color: active ? cat.color : "hsl(260 20% 55%)",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                  transition: "all 180ms ease",
                  boxShadow: active ? `0 0 12px ${cat.color}30` : "none",
                  fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: cat.emoji === "✦" ? 11 : 14 }}>{cat.emoji}</span>
                {cat.label}
              </button>
            );
          })}
        </div> */}

        {/* ── RESULTS META (NUMBER OF FREELANCERS)──────────────────────────────────────────────────── */}
        {/* {freelancers.length > 0 && (
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 13, color: "hsl(260 20% 50%)" }}>
              <span style={{ fontWeight: 700, color: "hsl(var(--foreground))" }}>
                {filtered.length}
              </span>{" "}
              creator{filtered.length !== 1 ? "s" : ""}
              {categoryFilter !== "All" && (
                <> in <span style={{ color: CATEGORIES.find(c => c.label === categoryFilter)?.color }}>
                  {categoryFilter}
                </span></>
              )}
            </p>
          </div>
        )} */}

        {/* ── GRID ──────────────────────────────────────────────────────────── */}
        {freelancers.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-5 rounded-2xl"
            style={{
              minHeight: 320,
              background: "linear-gradient(135deg, hsl(0, 0%, 100%) 0%, hsl(0, 0%, 100%) 100%)",
              border: "1px dashed hsl(0, 0%, 100%)",
            }}
          >
            <span style={{ fontSize: 52 }}>🌟</span>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 800, fontSize: 18, color: "white" }}>The stage is being set</p>
              <p style={{ marginTop: 8, fontSize: 14, color: "hsl(0, 0%, 100%)", maxWidth: 280 }}>
                Talented creators are joining Onswift. Check back soon — it's going to be exciting.
              </p>
            </div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f, i) => (
              <div
                key={f.id}
                style={{ animation: `tm-card-in 0.55s ease-out ${i * 0.07}s both` }}
              >
                <FreelancerCard
                  {...f}
                  featured={i === 0}
                  onHire={() => handleHire(f.name)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-4 rounded-2xl"
            style={{
              minHeight: 260,
              background: "linear-gradient(135deg, hsl(270 50% 4%) 0%, hsl(260 45% 8%) 100%)",
              border: "1px dashed hsl(270 40% 18%)",
            }}
          >
            <span style={{ fontSize: 44 }}>🔍</span>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontWeight: 700, fontSize: 16, color: "white" }}>No creators match</p>
              <p style={{ marginTop: 6, fontSize: 13, color: "hsl(260 25% 55%)" }}>
                Try a different search or pick another category
              </p>
            </div>
            <button
              onClick={() => { setSearchQuery(""); setCategoryFilter("All"); }}
              style={{
                marginTop: 4, padding: "8px 20px",
                background: "hsl(270 40% 14%)",
                border: "1px solid hsl(270 35% 24%)",
                borderRadius: 10, color: "hsl(260 30% 70%)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      <HireComingSoonModal
        open={hireModalOpen}
        onClose={() => setHireModalOpen(false)}
        talentName={selectedTalent || ""}
      />

      {/* ── Agents Coming Soon Modal ─────────────────────────────────────── */}
      <Dialog open={agentsModalOpen} onOpenChange={setAgentsModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden" style={{ borderRadius: 20, border: "1px solid hsla(290, 100%, 50%, 0.12)" }}>
          <DialogHeader className="sr-only">
            <DialogTitle>AI Agents — Coming Soon</DialogTitle>
          </DialogHeader>

          {/* White header */}
          <div style={{
            background: "#ffffff",
            padding: "36px 32px 28px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Orb */}
            <div style={{
              position: "absolute", top: -60, right: -60,
              width: 200, height: 200, borderRadius: "50%",
              background: "radial-gradient(circle, hsl(270 70% 55% / 0.12) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Icon */}
            <div style={{
              width: 60, height: 60, borderRadius: 16, marginBottom: 16,
              background: "linear-gradient(135deg, hsl(0, 0%, 100%))",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 28px hsl(270 70% 50% / 0.45)",
            }}>
              <img
                src="/onswift-purple-logo.png"
                alt="OnSwift logo"
                className="h-48 w-48 object-contain"
              />
        </div>

            {/* Coming Soon badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRadius: 999, marginBottom: 14,
              background: "hsl(270 60% 95%)",
              border: "1px solid hsl(270 60% 85%)",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "hsl(270 70% 50%)", display: "inline-block",
                animation: "tm-pulse-ring 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "hsl(270 60% 40%)", textTransform: "uppercase" }}>
                Coming Soon
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, color: "hsl(270 20% 15%)", lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0 }}>
              AI Agents are{" "}
              <span style={{
                backgroundImage: "linear-gradient(90deg, hsl(273, 93%, 54%), hsl(286, 100%, 51%), hsl(273, 93%, 54%))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                almost here
              </span>
            </h2>
            <p style={{ marginTop: 8, fontSize: 14, color: "hsl(260 15% 45%)", lineHeight: 1.55, fontWeight: 500 }}>
              We're building a new class of AI-powered agents designed specifically for creative studios, agencies, and solo creators. Deploy once, let them run forever.
            </p>
          </div>

          {/* Purple feature section */}
          <div style={{ padding: "24px 32px 28px", background: "hsl(273, 93%, 54%)" }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255, 255, 255, 0.85)", textTransform: "uppercase", marginBottom: 16 }}>
              What agents will do for you
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { icon: <Workflow size={15} />, title: "Custom Automated Workflows", desc: "Build multi-step pipelines that handle briefing, approval, and delivery without you lifting a finger." },
                { icon: <BrainCircuit size={15} />, title: "Smart Client Communication", desc: "Agents that draft updates, chase approvals, and keep clients informed, 24/7, in your voice." },
                { icon: <Sparkles size={15} />, title: "Creative Asset Generation", desc: "From briefs to mood boards to copy, agents that create alongside you, not instead of you." },
                { icon: <Rocket size={15} />, title: "Always-On, Zero Downtime", desc: "Unlike human collaborators, agents never sleep. Your studio operates around the clock." },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                    background: "rgba(255, 255, 255, 0.12)",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255, 255, 255, 0.95)",
                  }}>
                    {icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "white", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{title}</div>
                    <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.85)", marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setAgentsModalOpen(false)}
              style={{
                marginTop: 24, width: "100%", height: 48,
                background: "white",
                border: "none", borderRadius: 12,
                color: "hsl(270 60% 45%)", fontWeight: 700, fontSize: 14,
                cursor: "pointer", letterSpacing: "0.02em",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.15)",
                fontFamily: "inherit",
                transition: "all 200ms ease",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "hsl(270 95% 97%)";
                el.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "white";
                el.style.transform = "translateY(0)";
              }}
            >
              Notify me when it's live 🎉
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
