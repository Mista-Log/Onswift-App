import { useEffect, useState, type ReactNode } from "react";
import { CalendarDays, ExternalLink, ImageOff, Link as LinkIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { linkLabel, safeHref } from "@/lib/profileLinks";
import { SOCIALS } from "./socials";

export interface FeaturedItem {
  id: string;
  title: string;
  link: string;
  image: string | null;
}

/** What someone else sees of a person. Same shape the server sends from /api/v1/profiles/<id>/. */
export interface ProfileData {
  id?: string;
  role: string;
  full_name: string;
  avatar?: string | null;
  /** Wide cover image (best at 1584 x 396, the LinkedIn banner size). */
  banner?: string | null;
  headline: string;
  bio: string;
  skills: string[];
  links: string[];
  social_links: Record<string, string | undefined>;
  featured: FeaturedItem[];
  stats: { label: string; value: number }[];
  member_since?: number | null;
  /** The creator's public link name (onswift.org/<handle>), sent only while that link is switched on. */
  handle?: string | null;
}

type Tab = "info" | "work" | "links";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);

/** True on desktop-width screens, and only when the caller asked for the wide layout. */
function useIsWide(enabled: boolean) {
  const query = "(min-width: 1024px)";
  const [wide, setWide] = useState(
    () => enabled && typeof window !== "undefined" && !!window.matchMedia?.(query)?.matches,
  );
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const sync = () => setWide(!!mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, [enabled]);
  return wide;
}

interface ProfileViewProps {
  profile: ProfileData;
  /** Buttons under the name (Message, Edit...). The page decides; the view just lays them out. */
  actions?: ReactNode;
  /**
   * "stacked" (default): one phone-style column, whatever the screen. Used by the previews.
   * "wide": the same column on phones and tablets; on desktop the identity moves to a left column
   * beside a grid of work, like a portfolio site.
   */
  layout?: "stacked" | "wide";
  className?: string;
}

/**
 * A portfolio-style profile: a cover band with the avatar overlapping it, name and bio, pill buttons,
 * then tabs for Info (the numbers and skills), Work (featured pieces as large cards) and Links.
 */
export function ProfileView({ profile, actions, layout = "stacked", className }: ProfileViewProps) {
  const twoCol = useIsWide(layout === "wide");
  const [tab, setTab] = useState<Tab>("work");
  const [open, setOpen] = useState<FeaturedItem | null>(null);

  const web = profile.links.map((l) => ({ label: linkLabel(l), href: safeHref(l) })).filter((l) => l.href);
  // Known networks, in a fixed order, each only if it has a real web link.
  const social = SOCIALS.map((s) => ({ ...s, href: safeHref(profile.social_links[s.key]) })).filter((s) => s.href);

  // On desktop the Info lives in the left column, so it isn't a tab there.
  const tabs: [Tab, string][] = twoCol
    ? [["work", "Work"], ["links", "Links"]]
    : [["info", "Info"], ["work", "Work"], ["links", "Links"]];
  const active: Tab = twoCol && tab === "info" ? "work" : tab;

  const info = (
    <div className="space-y-6">
      <dl className="space-y-2.5">
        {profile.stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">{s.label}</dt>
            <dd className="text-base font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      {profile.skills.length > 0 && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span key={skill} className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-foreground">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
      {profile.member_since && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          On OnSwift since {profile.member_since}
        </p>
      )}
    </div>
  );

  const identity = (
    <div className={cn("px-4", twoCol ? "text-left" : "text-center")}>
      <Avatar
        className={cn(
          "-mt-12 h-24 w-24 border-4 border-background bg-background shadow-sm",
          twoCol ? "lg:-mt-14 lg:h-28 lg:w-28" : "mx-auto",
        )}
      >
        <AvatarImage src={profile.avatar || undefined} alt={profile.full_name} className="object-cover" />
        <AvatarFallback className="bg-secondary text-2xl">{initials(profile.full_name) || "?"}</AvatarFallback>
      </Avatar>
      <h2 className="mt-3 break-words text-2xl font-bold leading-tight">{profile.full_name || "Your name"}</h2>
      {profile.headline && <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>}
      {profile.bio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>}

      {social.length > 0 && (
        <ul aria-label="Social links" className={cn("mt-4 flex flex-wrap gap-2", !twoCol && "justify-center")}>
          {social.map(({ key, label, Icon, href }) => (
            <li key={key}>
              <a
                href={href!}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="h-4 w-4" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}

      {actions && <div className="mt-5 flex flex-col gap-2 [&>*]:w-full [&>*]:rounded-full">{actions}</div>}
    </div>
  );

  const content = (
    <div className="min-w-0">
      <div role="tablist" aria-label="Profile sections" className={cn("flex gap-6 border-b border-border/60", !twoCol && "px-4")}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={active === key}
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px border-b-2 py-3 text-sm font-medium transition-colors",
              active === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={cn("pt-5", !twoCol && "px-4")}>
        {active === "info" && info}

        {active === "work" &&
          (profile.featured.length > 0 ? (
            <ul className={cn("grid gap-4", layout === "wide" ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
              {profile.featured.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(item)}
                    aria-label={item.title ? `Open ${item.title}` : "Open featured work"}
                    className="group relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title || "Featured work"}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <ImageOff className="m-auto h-6 w-6 text-muted-foreground" />
                    )}
                    {(item.title || item.link) && (
                      <span className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-3 pt-12 text-left text-sm font-semibold leading-snug text-white">
                        <span className="line-clamp-2 flex-1">{item.title}</span>
                        {item.link && <ExternalLink className="h-4 w-4 shrink-0" />}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-14 text-center text-sm text-muted-foreground">Nothing featured yet.</p>
          ))}

        {active === "links" &&
          (web.length > 0 ? (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/60">
              {web.map((l, i) => (
                <li key={`${l.href}-${i}`}>
                  <a
                    href={l.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-secondary/60"
                  >
                    <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-14 text-center text-sm text-muted-foreground">No links added yet.</p>
          ))}
      </div>
    </div>
  );

  return (
    <div className={cn("w-full text-foreground", layout === "stacked" && "mx-auto max-w-xl", className)}>
      {/*
        Cover band, in the LinkedIn banner shape (1584 x 396, i.e. 4:1). It is capped at 16rem tall so it
        doesn't swallow a wide desktop page; past that the image is cropped top and bottom. Without an
        image it is a brand gradient that reads in both themes. The avatar overlaps its bottom edge.
      */}
      <div
        data-testid="profile-banner"
        className={cn(
          "relative aspect-[1584/396] max-h-64 min-h-24 w-full overflow-hidden",
          !profile.banner &&
            "bg-[linear-gradient(135deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.55)_55%,hsl(var(--primary)/0.25)_100%)]",
          twoCol && "rounded-xl",
        )}
      >
        {profile.banner && <img src={profile.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      </div>

      {twoCol ? (
        <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-10 px-2">
          <aside>
            {identity}
            <div className="mt-8 px-4">{info}</div>
          </aside>
          <div className="pt-6">{content}</div>
        </div>
      ) : (
        <>
          {identity}
          <div className="mt-6">{content}</div>
        </>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          {open?.image && <img src={open.image} alt={open.title || "Featured work"} className="max-h-[70vh] w-full bg-black/90 object-contain" />}
          <div className="space-y-2 p-4">
            <DialogTitle className="text-base">{open?.title || "Featured work"}</DialogTitle>
            <DialogDescription className="sr-only">Featured work by {profile.full_name}</DialogDescription>
            {safeHref(open?.link) && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <a href={safeHref(open?.link)!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Visit link
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
