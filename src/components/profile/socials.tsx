import type { IconType } from "react-icons";
import {
  FaBehance,
  FaDribbble,
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
  FaThreads,
  FaTiktok,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The networks people can add to a profile. The key is what the server stores in `social_links`. */
export const SOCIALS: { key: string; label: string; placeholder: string; Icon: IconType }[] = [
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/yourname", Icon: FaLinkedinIn },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/yourhandle", Icon: FaXTwitter },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourhandle", Icon: FaInstagram },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchannel", Icon: FaYoutube },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourhandle", Icon: FaTiktok },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourpage", Icon: FaFacebookF },
  { key: "threads", label: "Threads", placeholder: "https://threads.net/@yourhandle", Icon: FaThreads },
  { key: "github", label: "GitHub", placeholder: "https://github.com/yourname", Icon: FaGithub },
  { key: "behance", label: "Behance", placeholder: "https://behance.net/yourname", Icon: FaBehance },
  { key: "dribbble", label: "Dribbble", placeholder: "https://dribbble.com/yourname", Icon: FaDribbble },
];

export type SocialValues = Record<string, string>;

/** The saved links, as a form value with every network present (empty when not set). */
export function toSocialValues(saved?: Record<string, string | undefined> | null): SocialValues {
  return Object.fromEntries(SOCIALS.map((s) => [s.key, saved?.[s.key] ?? ""]));
}

interface SocialLinksEditorProps {
  value: SocialValues;
  onChange: (next: SocialValues) => void;
}

/** One field per network, each with its logo. */
export function SocialLinksEditor({ value, onChange }: SocialLinksEditorProps) {
  return (
    <section className="glass-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Social Links</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {SOCIALS.map(({ key, label, placeholder, Icon }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`social-${key}`}>{label}</Label>
            <div className="relative">
              <Icon aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`social-${key}`}
                value={value[key] ?? ""}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                placeholder={placeholder}
                className="pl-10"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
