import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { secureFetch } from "@/api/apiClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface Creator {
  id: string;
  user_id: string;
  name: string;
  company?: string | null;
  avatar?: string | null;
}

const initials = (name: string) =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);

/** The creators this talent works with, each with a way into their profile. Hidden when there are none. */
export function MyCreatorsCard() {
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await secureFetch("/api/v3/my-creators/");
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (Array.isArray(data)) setCreators(data);
        }
      } catch {
        /* the card just stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (creators.length === 0) return null;

  return (
    <section className="glass-card p-5 sm:p-6 md:p-7" aria-label="My creators">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">My Creators (Hirers)</h3>
      </div>
      <ul className="space-y-3">
        {creators.map((c) => (
          <li key={c.id} className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={c.avatar || undefined} alt={c.name} className="object-cover" />
              <AvatarFallback className="bg-primary/20 text-primary">{initials(c.name || "") || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
              {c.company && <p className="truncate text-xs text-muted-foreground">{c.company}</p>}
            </div>
            <Button asChild size="sm" className="shrink-0">
              <Link to={`/profile/${c.user_id}`} aria-label={`View ${c.name}'s profile`}>
                View Profile
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
