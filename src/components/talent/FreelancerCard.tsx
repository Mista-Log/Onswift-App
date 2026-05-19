import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FreelancerCardProps {
  id: string;
  name: string;
  role: string;
  avatar: string;
  skills: string[];
  bio: string;
  featured?: boolean;
  className?: string;
  onHire?: () => void;
  onClick?: () => void;
}

// ── Role → visual identity mapping ───────────────────────────────────────────

const ROLE_THEMES = [
  {
    keywords: ["design","ui","ux","graphic","illustrat","brand"],
    gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)",
    glow: "hsl(260 80% 60% / 0.45)",
    accent: "#a78bfa",
    chip: { bg: "hsl(260 80% 60% / 0.12)", border: "hsl(260 70% 60% / 0.3)", color: "#c4b5fd" },
  },
  {
    keywords: ["video","motion","film","edit","cinema"],
    gradient: "linear-gradient(135deg, #ea580c 0%, #dc2626 50%, #be123c 100%)",
    glow: "hsl(20 90% 55% / 0.45)",
    accent: "#fb923c",
    chip: { bg: "hsl(20 90% 55% / 0.12)", border: "hsl(20 80% 55% / 0.3)", color: "#fdba74" },
  },
  {
    keywords: ["sound","audio","music","podcast"],
    gradient: "linear-gradient(135deg, #059669 0%, #0891b2 50%, #0e7490 100%)",
    glow: "hsl(160 80% 40% / 0.45)",
    accent: "#34d399",
    chip: { bg: "hsl(160 70% 40% / 0.12)", border: "hsl(160 60% 40% / 0.3)", color: "#6ee7b7" },
  },
  {
    keywords: ["dev","engineer","code","software","web"],
    gradient: "linear-gradient(135deg, #1d4ed8 0%, #0891b2 50%, #0e7490 100%)",
    glow: "hsl(220 85% 55% / 0.45)",
    accent: "#60a5fa",
    chip: { bg: "hsl(220 80% 55% / 0.12)", border: "hsl(220 70% 55% / 0.3)", color: "#93c5fd" },
  },
  {
    keywords: ["3d","model","sculpt","blend","maya","zbrush"],
    gradient: "linear-gradient(135deg, #be185d 0%, #7c3aed 50%, #4f46e5 100%)",
    glow: "hsl(310 75% 55% / 0.45)",
    accent: "#f472b6",
    chip: { bg: "hsl(310 70% 55% / 0.12)", border: "hsl(310 60% 55% / 0.3)", color: "#f9a8d4" },
  },
  {
    keywords: ["photo","camera","portrait"],
    gradient: "linear-gradient(135deg, #b45309 0%, #d97706 50%, #f59e0b 100%)",
    glow: "hsl(38 90% 55% / 0.45)",
    accent: "#fbbf24",
    chip: { bg: "hsl(38 90% 55% / 0.12)", border: "hsl(38 80% 55% / 0.3)", color: "#fde68a" },
  },
  {
    keywords: ["writ","content","copy","blog","journalist"],
    gradient: "linear-gradient(135deg, #0f766e 0%, #059669 50%, #16a34a 100%)",
    glow: "hsl(170 80% 40% / 0.45)",
    accent: "#2dd4bf",
    chip: { bg: "hsl(170 70% 40% / 0.12)", border: "hsl(170 60% 40% / 0.3)", color: "#99f6e4" },
  },
];

const DEFAULT_THEME = {
  gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6366f1 100%)",
  glow: "hsl(250 76% 63% / 0.45)",
  accent: "#a78bfa",
  chip: { bg: "hsl(250 76% 63% / 0.12)", border: "hsl(250 70% 63% / 0.3)", color: "#c4b5fd" },
};

function getTheme(role: string | null | undefined) {
  const r = (role ?? "").toLowerCase();
  return ROLE_THEMES.find(t => t.keywords.some(k => r.includes(k))) ?? DEFAULT_THEME;
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function FreelancerCard({
  name,
  role,
  avatar,
  skills,
  bio,
  featured = false,
  className,
  onHire,
  onClick,
}: FreelancerCardProps) {
  const theme = getTheme(role);

  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        borderRadius: 18,
        overflow: "hidden",
        background: "#ffffff",
        border: `1px solid ${featured ? theme.accent + "40" : "hsl(270 25% 92%)"}`,
        boxShadow: featured ? `0 0 28px ${theme.glow}` : "0 2px 12px hsl(270 30% 10% / 0.08)",
        cursor: onClick ? "pointer" : "default",
        transition: "transform 250ms ease, box-shadow 250ms ease, border-color 250ms ease",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform   = "translateY(-5px) scale(1.01)";
        el.style.boxShadow   = featured
          ? `0 20px 50px ${theme.glow}, 0 4px 30px hsl(270 30% 10% / 0.12)`
          : "0 12px 32px hsl(270 30% 10% / 0.12)";
        el.style.borderColor = theme.accent + "50";
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform   = "translateY(0) scale(1)";
        el.style.boxShadow   = featured
          ? `0 0 28px ${theme.glow}`
          : "0 2px 12px hsl(270 30% 10% / 0.08)";
        el.style.borderColor = featured ? theme.accent + "40" : "hsl(270 25% 92%)";
      }}
    >
      {/* ── Cover image area ─────────────────────────────────────────────── */}
      <div style={{ position: "relative", height: 110, background: theme.gradient, flexShrink: 0 }}>
        {/* Subtle noise grain on the gradient */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.08,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }} />

        {/* Featured badge */}
        {featured && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 12px", borderRadius: 999,
            background: "hsl(0 0% 100% / 0.15)",
            backdropFilter: "blur(8px)",
            border: "1px solid hsl(0 0% 100% / 0.25)",
            fontSize: 11, fontWeight: 700, color: "white",
            letterSpacing: "0.06em",
          }}>
            ⭐ FEATURED
          </div>
        )}

        {/* Available dot - top right */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 999,
          background: "hsl(0 0% 0% / 0.3)",
          backdropFilter: "blur(6px)",
          fontSize: 11, fontWeight: 600, color: "hsl(145 60% 70%)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "hsl(145 70% 50%)", display: "inline-block" }} />
          Available
        </div>
      </div>

      {/* ── Avatar overlap ───────────────────────────────────────────────── */}
      <div style={{
        marginTop: -32, marginLeft: 20, zIndex: 10, position: "relative",
        display: "flex", alignItems: "flex-end", gap: 14,
      }}>
        <div style={{
          borderRadius: "50%",
          padding: 3,
          background: theme.gradient,
          boxShadow: `0 0 20px ${theme.glow}`,
          flexShrink: 0,
        }}>
          <div style={{
            borderRadius: "50%",
            padding: 2,
            background: "hsl(270 30% 95%)",
          }}>
            <Avatar style={{ width: 60, height: 60 }}>
              <AvatarImage src={avatar} alt={name} />
              <AvatarFallback style={{
                background: `${theme.gradient}`,
                color: "white", fontSize: 20, fontWeight: 800,
              }}>
                {name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 20px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>

        {/* Name + role */}
        <div>
          <h3 style={{
            fontSize: 16, fontWeight: 800, color: "Black",
            letterSpacing: "-0.01em", lineHeight: 1.2,
          }}>
            {name}
          </h3>
          <p style={{
            marginTop: 3, fontSize: 13, fontWeight: 600,
            background: theme.gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {role}
          </p>
        </div>

        {/* Skills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {skills.slice(0, 3).map(skill => (
            <span key={skill} style={{
              padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: theme.chip.bg,
              border: `1px solid ${theme.chip.border}`,
              color: theme.chip.color,
            }}>
              {skill}
            </span>
          ))}
          {skills.length > 3 && (
            <span style={{
              padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: "hsl(270 20% 95%)",
              border: "1px solid hsl(270 25% 88%)",
              color: "hsl(270 15% 45%)",
            }}>
              +{skills.length - 3} more
            </span>
          )}
        </div>

        {/* Bio */}
        <p style={{
          fontSize: 13, color: "hsl(270 15% 50%)", lineHeight: 1.6,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden", flex: 1,
        }}>
          {bio}
        </p>

        {/* Hire CTA */}
        <button
          onClick={e => { e.stopPropagation(); onHire?.(); }}
          style={{
            width: "100%", height: 44,
            background: theme.gradient,
            border: "none", borderRadius: 12,
            color: "white", fontWeight: 700, fontSize: 14,
            cursor: "pointer", letterSpacing: "0.02em",
            boxShadow: `0 0 18px ${theme.glow}`,
            transition: "opacity 200ms, box-shadow 200ms, transform 200ms",
            fontFamily: "inherit",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.opacity    = "0.92";
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${theme.glow}`;
            (e.currentTarget as HTMLElement).style.transform  = "scale(1.01)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.opacity    = "1";
            (e.currentTarget as HTMLElement).style.boxShadow = `0 0 18px ${theme.glow}`;
            (e.currentTarget as HTMLElement).style.transform  = "scale(1)";
          }}
        >
          Hire Now →
        </button>
      </div>
    </div>
  );
}
