import type { BillingCycle } from "@/lib/burnrate";

// Bundle rules — when a user has the listed standalone services, a single bundle
// can replace them for less. Prices are documented as current US-market values
// in USD cents at the time of authoring; users may need to adjust for their
// region/plan tier. We don't fetch live prices.

export interface BundleRule {
  id: string;
  label: string;
  description: string;
  replaces: string[]; // service names — case-insensitive match against Subscription.name
  minMatches: number; // require at least N of `replaces` present
  bundleMonthlyCents: number;
  bundleBillingCycle: BillingCycle;
  bundleNotes?: string;
  bundleCancelUrl?: string;
}

export const bundleRules: BundleRule[] = [
  {
    id: "apple-one-individual",
    label: "Apple One Individual",
    description: "Bundles Apple Music, Apple TV+, and iCloud+ 50GB.",
    replaces: ["Apple Music", "Apple TV+", "iCloud+"],
    minMatches: 2,
    bundleMonthlyCents: 1995,
    bundleBillingCycle: "monthly",
    bundleNotes: "$19.95/mo individual plan (US, 2026).",
  },
  {
    id: "apple-one-family",
    label: "Apple One Family",
    description: "Up to six people share Apple Music, Apple TV+, iCloud+ 200GB.",
    replaces: ["Apple Music", "Apple TV+", "iCloud+"],
    minMatches: 3,
    bundleMonthlyCents: 2595,
    bundleBillingCycle: "monthly",
    bundleNotes: "$25.95/mo family plan (US, 2026).",
  },
  {
    id: "apple-one-premier",
    label: "Apple One Premier",
    description: "Adds Apple Arcade, News+, Fitness+ to Family — for ~$38/mo.",
    replaces: ["Apple Music", "Apple TV+", "iCloud+", "Apple Arcade", "Apple News+", "Apple Fitness+"],
    minMatches: 4,
    bundleMonthlyCents: 3795,
    bundleBillingCycle: "monthly",
    bundleNotes: "$37.95/mo premier plan (US, 2026).",
  },
  {
    id: "disney-bundle",
    label: "Disney Bundle (Duo Premium)",
    description: "Disney+ + Hulu (no ads) in one plan.",
    replaces: ["Disney+", "Hulu"],
    minMatches: 2,
    bundleMonthlyCents: 1999,
    bundleBillingCycle: "monthly",
    bundleNotes: "$19.99/mo Duo Premium (US, 2026).",
  },
  {
    id: "disney-trio-premium",
    label: "Disney Trio Premium",
    description: "Disney+ + Hulu + ESPN+ in one plan.",
    replaces: ["Disney+", "Hulu", "ESPN+"],
    minMatches: 3,
    bundleMonthlyCents: 2599,
    bundleBillingCycle: "monthly",
    bundleNotes: "$25.99/mo Trio Premium (US, 2026).",
  },
  {
    id: "xbox-game-pass-ultimate",
    label: "Xbox Game Pass Ultimate",
    description: "Rolls Game Pass for Console + PC + EA Play + Xbox Live Gold into one sub.",
    replaces: ["Xbox Game Pass", "Xbox Game Pass for PC", "EA Play", "Xbox Live Gold"],
    minMatches: 2,
    bundleMonthlyCents: 1999,
    bundleBillingCycle: "monthly",
    bundleNotes: "$19.99/mo Ultimate plan (US, 2026).",
  },
  {
    id: "youtube-premium-music",
    label: "YouTube Premium (includes YouTube Music)",
    description: "Premium covers both YouTube ad-free and YouTube Music.",
    replaces: ["YouTube Premium", "YouTube Music"],
    minMatches: 2,
    bundleMonthlyCents: 1399,
    bundleBillingCycle: "monthly",
    bundleNotes: "$13.99/mo (US, 2026). Drop YouTube Music separately.",
  },
];
