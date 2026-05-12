// Overlap rules — categories where having more than one of these tends to be wasteful.
// We don't tell users which to cancel; we surface the overlap and let them decide.

export interface OverlapRule {
  id: string;
  label: string;
  category: string;
  matchNames: string[];
  minMatches: number;
  advice: string;
}

export const overlapRules: OverlapRule[] = [
  {
    id: "overlap-video",
    label: "Multiple video streamers",
    category: "entertainment",
    matchNames: [
      "Netflix",
      "Hulu",
      "Max",
      "HBO Max",
      "Disney+",
      "Apple TV+",
      "Peacock",
      "Paramount+",
      "Amazon Prime",
      "Prime Video",
      "YouTube TV",
    ],
    minMatches: 3,
    advice: "Most households actively watch only one or two streamers each month — consider rotating.",
  },
  {
    id: "overlap-music",
    label: "Multiple music streamers",
    category: "music",
    matchNames: [
      "Spotify",
      "Apple Music",
      "YouTube Music",
      "Amazon Music",
      "Amazon Music Unlimited",
      "Tidal",
    ],
    minMatches: 2,
    advice: "Only one music subscription is usually active. Pick a favorite and cancel the rest.",
  },
  {
    id: "overlap-cloud",
    label: "Multiple cloud-storage plans",
    category: "cloud/storage",
    matchNames: ["Dropbox", "Google One", "iCloud+", "OneDrive", "Box", "pCloud"],
    minMatches: 2,
    advice: "Consolidating storage usually unlocks a cheaper tier and avoids duplicated files.",
  },
  {
    id: "overlap-ai",
    label: "Multiple AI-assistant subscriptions",
    category: "productivity",
    matchNames: [
      "ChatGPT Plus",
      "Claude Pro",
      "Gemini Advanced",
      "Perplexity Pro",
      "Copilot Pro",
      "Mistral Pro",
    ],
    minMatches: 2,
    advice: "Power users often have multiple; casual users rarely need more than one.",
  },
  {
    id: "overlap-vpn",
    label: "Multiple VPN subscriptions",
    category: "productivity",
    matchNames: ["NordVPN", "ExpressVPN", "Surfshark", "Proton VPN", "Mullvad"],
    minMatches: 2,
    advice: "One VPN is enough for almost every use case — cancel the duplicates.",
  },
];
