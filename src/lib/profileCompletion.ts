import type { User } from "@/contexts/AuthContext";

/** How complete a talent's profile is, 0 to 100. One rule, shared by the dashboard and the top bar. */
export function profileCompletion(user: User | null | undefined): number {
  if (!user) return 0;
  return (
    (user.full_name ? 10 : 0) +
    (user.professional_title ? 15 : 0) +
    (user.bio ? 15 : 0) +
    (user.skills?.length ? 15 : 0) +
    (user.portfolioLink ? 15 : 0) +
    (user.hourlyRate ? 10 : 0) +
    (user.availability ? 10 : 0)
  );
}
