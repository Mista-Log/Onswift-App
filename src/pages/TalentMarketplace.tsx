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

        {/* HERO hidden */}

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
