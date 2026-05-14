// v5 Feature 7: cancellation playbooks. Each entry encodes the steps a
// user typically follows, scripts they can copy, gotchas to watch for,
// and an expected retention offer when applicable.

export interface CancellationPlaybook {
  id: string;
  serviceName: string;
  matchService: string[];
  domain?: string;
  cancelUrl?: string;
  steps: string[];
  scripts: Array<{ label: string; body: string }>;
  gotchas: string[];
  expectedRetentionOffer?: {
    kind: "percent" | "months-free" | "tier-downgrade";
    valueText: string;
  };
  estimatedMinutes: number;
  lastVerifiedOn: string;
}

export const CANCELLATION_PLAYBOOKS: readonly CancellationPlaybook[] = [
  {
    id: "netflix",
    serviceName: "Netflix",
    matchService: ["netflix", "netflix.com"],
    domain: "netflix.com",
    cancelUrl: "https://www.netflix.com/cancelplan",
    steps: [
      "Sign in on the web (mobile apps hide the option behind the App Store).",
      "Open Account → Membership & billing → 'Cancel Membership'.",
      "Confirm the cancellation date — Netflix keeps access until the period ends.",
      "Save the confirmation email; the account stays restorable for 10 months.",
    ],
    scripts: [
      {
        label: "If asked why you're leaving",
        body: "I'm trimming streaming subs this quarter and rotating instead. Thanks for the years, but I'm done for now.",
      },
    ],
    gotchas: [
      "The mobile app links out to your phone's app store; cancel on web.",
      "Pausing isn't the same as cancelling — Netflix dropped 'Pause' in 2024.",
      "Restart later by signing back in within 10 months; your profiles + history return.",
    ],
    estimatedMinutes: 3,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "spotify",
    serviceName: "Spotify",
    matchService: ["spotify", "spotify.com"],
    domain: "spotify.com",
    cancelUrl: "https://www.spotify.com/account/subscription/cancel/",
    steps: [
      "Open the Account page on the web.",
      "Subscription → 'Available plans' → 'Cancel Premium'.",
      "Skip the survey or fill it in — cancellation still applies.",
      "Confirm the final date; downloaded songs stop playing then.",
    ],
    scripts: [
      {
        label: "Retention pushback",
        body: "I'm consolidating to one music service. Not interested in a discount — I want to cancel.",
      },
    ],
    gotchas: [
      "Family plan owners must transfer ownership or cancel for everyone.",
      "Apple App Store subscriptions need to be cancelled in iOS Settings instead.",
      "Free tier remains free — you don't lose your library, just downloads + skips.",
    ],
    expectedRetentionOffer: { kind: "months-free", valueText: "3 months free" },
    estimatedMinutes: 4,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "hulu",
    serviceName: "Hulu",
    matchService: ["hulu", "hulu.com"],
    domain: "hulu.com",
    cancelUrl: "https://secure.hulu.com/account",
    steps: [
      "Sign in on the web and open Account.",
      "Under 'Your Subscription', click 'Cancel'.",
      "Reject the retention offer (or take it) and confirm.",
      "Service runs until the end of the billing period.",
    ],
    scripts: [
      {
        label: "If they offer a discount",
        body: "I'm rotating streamers and won't be back for a few months. Thanks anyway.",
      },
    ],
    gotchas: [
      "Bundled with Disney+/ESPN? Cancel via Disney Bundle settings instead.",
      "Live TV plans have a separate cancellation flow.",
      "Hulu often offers $1.99/mo for 12 months — only take it if you'd otherwise watch.",
    ],
    expectedRetentionOffer: { kind: "percent", valueText: "~75% off for 12 months" },
    estimatedMinutes: 4,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "max",
    serviceName: "Max",
    matchService: ["max", "hbo", "hbo max"],
    domain: "max.com",
    cancelUrl: "https://www.max.com/settings/subscription",
    steps: [
      "Open Settings → Subscription on the web.",
      "Choose 'Cancel Subscription' (not 'Pause').",
      "Confirm and save the email — access continues until period end.",
    ],
    scripts: [
      { label: "If a tier downgrade is offered", body: "Not interested in ads. Please complete the cancellation." },
    ],
    gotchas: [
      "If billed through Amazon Prime Channels, cancel in Amazon's Memberships.",
      "House of the Dragon-season hooks: schedule cancel for after the finale.",
    ],
    estimatedMinutes: 3,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "disney-plus",
    serviceName: "Disney+",
    matchService: ["disney+", "disneyplus", "disney plus"],
    domain: "disneyplus.com",
    cancelUrl: "https://www.disneyplus.com/account/subscription",
    steps: [
      "Sign in and open Account → Subscription.",
      "Click your active plan → 'Cancel Subscription'.",
      "Confirm the cancellation reason and submit.",
    ],
    scripts: [],
    gotchas: [
      "Disney Bundle (with Hulu/ESPN+) requires cancelling the bundle, not Disney+ alone.",
      "Apple/Roku-billed accounts must cancel via that store.",
    ],
    estimatedMinutes: 3,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "apple-tv",
    serviceName: "Apple TV+",
    matchService: ["apple tv+", "apple tv plus", "appletv"],
    domain: "tv.apple.com",
    steps: [
      "iPhone: Settings → [your name] → Subscriptions → Apple TV+ → Cancel.",
      "Mac: System Settings → Apple Account → Subscriptions.",
      "Web: tv.apple.com → click your initials → Settings → Subscriptions.",
    ],
    scripts: [],
    gotchas: [
      "Bundled in Apple One? Cancel the bundle or downgrade tier instead.",
      "Family Sharing keeps the sub for the organizer only.",
    ],
    estimatedMinutes: 2,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "apple-music",
    serviceName: "Apple Music",
    matchService: ["apple music"],
    domain: "music.apple.com",
    steps: [
      "iPhone Settings → [your name] → Subscriptions → Apple Music → Cancel.",
      "Or open Music app → Listen Now → profile icon → Manage Subscription.",
      "Confirm and screenshot — access continues until period end.",
    ],
    scripts: [],
    gotchas: [
      "Family plans cancel for every member.",
      "Apple One subscribers cancel through the bundle, not Apple Music alone.",
    ],
    estimatedMinutes: 2,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "youtube-premium",
    serviceName: "YouTube Premium",
    matchService: ["youtube premium", "youtube music premium"],
    domain: "youtube.com",
    cancelUrl: "https://www.youtube.com/paid_memberships",
    steps: [
      "Visit youtube.com/paid_memberships on the web while signed in.",
      "Click 'Deactivate' → confirm.",
      "Ad-free continues until billing period ends.",
    ],
    scripts: [],
    gotchas: [
      "Family plans cancel for everyone.",
      "iOS billing requires cancelling in App Store subscriptions instead.",
    ],
    estimatedMinutes: 2,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "youtube-tv",
    serviceName: "YouTube TV",
    matchService: ["youtube tv"],
    domain: "tv.youtube.com",
    cancelUrl: "https://tv.youtube.com/settings/membership",
    steps: [
      "tv.youtube.com → Settings → Membership.",
      "'Manage' → 'Cancel Membership'.",
      "Pick 'Cancel Membership' (not 'Pause').",
    ],
    scripts: [
      { label: "Pause vs cancel", body: "I'd rather cancel — pausing keeps payment info on file." },
    ],
    gotchas: [
      "YouTube TV often discounts $20-30/mo on retention — take if you'd otherwise watch.",
      "If you subscribe via NFL Sunday Ticket, cancellation might affect the add-on.",
    ],
    expectedRetentionOffer: { kind: "percent", valueText: "$10-$30/mo off for 3-6 months" },
    estimatedMinutes: 5,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "amazon-prime",
    serviceName: "Amazon Prime",
    matchService: ["amazon prime", "prime"],
    domain: "amazon.com",
    cancelUrl: "https://www.amazon.com/gp/help/customer/display.html?nodeId=GHFRP3NCQ876ZGZD",
    steps: [
      "Amazon Account → 'Prime Membership' → 'End Membership'.",
      "Choose 'End on [date]' or 'End now' for a prorated refund.",
      "Decline the retention offers (slow-shipping, ad-free Prime Video tier, etc).",
    ],
    scripts: [],
    gotchas: [
      "Cancelling Prime removes 2-day shipping, Prime Video, Music basic, and Kindle benefits.",
      "Student / EBT discounts have different cancellation pages.",
    ],
    expectedRetentionOffer: { kind: "months-free", valueText: "Free trial extension or $20-40 credit" },
    estimatedMinutes: 6,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "audible",
    serviceName: "Audible",
    matchService: ["audible"],
    domain: "audible.com",
    cancelUrl: "https://www.audible.com/account/membership-details",
    steps: [
      "Sign in on the web → Account → Membership Details.",
      "Click 'Cancel Membership'.",
      "Decline the retention offer (free credit, paused plan) — or take it for one cycle.",
      "Confirm and screenshot the confirmation.",
    ],
    scripts: [],
    gotchas: [
      "Unused credits expire 30 days after cancellation — spend them first.",
      "Cancelling on iPad/iPhone goes through Apple ID Subscriptions instead.",
    ],
    expectedRetentionOffer: { kind: "months-free", valueText: "Up to 3 free months or bonus credits" },
    estimatedMinutes: 5,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "adobe-creative-cloud",
    serviceName: "Adobe Creative Cloud",
    matchService: ["adobe creative cloud", "adobe cc", "creative cloud"],
    domain: "adobe.com",
    cancelUrl: "https://account.adobe.com/plans",
    steps: [
      "Visit account.adobe.com/plans.",
      "Click 'Manage plan' → 'Cancel your plan'.",
      "Choose a reason → confirm — annual plans incur an early termination fee unless within 14 days.",
    ],
    scripts: [
      {
        label: "Fee waiver request",
        body: "I'm cancelling early due to a change in work. Would you waive the early termination fee or extend a one-month pause instead?",
      },
    ],
    gotchas: [
      "Annual paid monthly: 50% of remaining months billed as ETF.",
      "Switch to 'Photography' plan instead — fewer apps, same files.",
      "Cancel inside 14 days of signing up for a full refund.",
    ],
    expectedRetentionOffer: { kind: "percent", valueText: "2 months at 50% off" },
    estimatedMinutes: 7,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "notion",
    serviceName: "Notion",
    matchService: ["notion"],
    domain: "notion.so",
    steps: [
      "Settings & members → Billing.",
      "'Cancel subscription' at the bottom.",
      "Choose monthly or annual — annual is prorated only via support.",
    ],
    scripts: [],
    gotchas: [
      "Free plan is generous — you keep most data on downgrade.",
      "AI add-on cancels separately.",
    ],
    estimatedMinutes: 3,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "figma",
    serviceName: "Figma",
    matchService: ["figma"],
    domain: "figma.com",
    steps: [
      "Open the team's Settings → Plans.",
      "Downgrade to Starter or 'Cancel paid plan'.",
      "Save attribution — files migrate to free Starter limits.",
    ],
    scripts: [],
    gotchas: [
      "You lose unlimited files on paid plans — export what matters.",
      "Education plans cancel through admin emails only.",
    ],
    estimatedMinutes: 4,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "chatgpt-plus",
    serviceName: "ChatGPT Plus",
    matchService: ["chatgpt plus", "openai chatgpt"],
    domain: "chat.openai.com",
    cancelUrl: "https://chat.openai.com/#settings/Subscription",
    steps: [
      "Open Settings → Subscription.",
      "'Cancel plan'.",
      "Access continues until billing cycle end.",
    ],
    scripts: [],
    gotchas: [
      "Mobile apps redirect to the App Store — cancel there if you bought via iOS.",
      "Re-enabling later is one click; rate limits drop back to free.",
    ],
    estimatedMinutes: 2,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "claude-pro",
    serviceName: "Claude Pro",
    matchService: ["claude pro", "anthropic claude"],
    domain: "claude.ai",
    cancelUrl: "https://claude.ai/settings/billing",
    steps: [
      "Open claude.ai → Settings → Plans & billing.",
      "Click 'Cancel subscription'.",
      "Confirm — Pro features stay until billing cycle end.",
    ],
    scripts: [],
    gotchas: [
      "Anthropic console (api.anthropic.com) usage bills separately — cancel API team plans there.",
    ],
    estimatedMinutes: 2,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "nordvpn",
    serviceName: "NordVPN",
    matchService: ["nordvpn", "nord vpn"],
    domain: "nordvpn.com",
    cancelUrl: "https://my.nordaccount.com/dashboard/nordvpn/",
    steps: [
      "Open my.nordaccount.com → NordVPN → Manage.",
      "'Turn off auto-renewal' — Nord doesn't expose a direct cancel button.",
      "For a refund within 30 days, contact support via the chat widget with order ID.",
    ],
    scripts: [
      {
        label: "Refund request",
        body: "I subscribed [date] and would like a refund under the 30-day money-back guarantee. Order ID: [###].",
      },
    ],
    gotchas: [
      "Multi-year plans only refund if requested in 30 days.",
      "Support will offer 80%+ off — accept only if you'll actually use it.",
    ],
    expectedRetentionOffer: { kind: "percent", valueText: "80% off 1-year renewal" },
    estimatedMinutes: 10,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "doordash-dashpass",
    serviceName: "DoorDash DashPass",
    matchService: ["doordash dashpass", "dashpass"],
    domain: "doordash.com",
    steps: [
      "Open the DoorDash app → Account → DashPass.",
      "'End Subscription'.",
      "Confirm — service continues until billing date.",
    ],
    scripts: [],
    gotchas: [
      "Chase Sapphire holders may get DashPass complimentary — check before paying.",
      "Promo codes for a year free do not extend automatically.",
    ],
    estimatedMinutes: 2,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "peloton",
    serviceName: "Peloton",
    matchService: ["peloton", "peloton membership", "peloton app"],
    domain: "onepeloton.com",
    cancelUrl: "https://members.onepeloton.com/preferences/membership",
    steps: [
      "Sign in to members.onepeloton.com → Preferences → Membership.",
      "Choose 'Cancel'.",
      "Hardware members must also cancel the connected fitness membership separately.",
    ],
    scripts: [],
    gotchas: [
      "App-only members: cancel via App Store/Play Store subscriptions.",
      "Resale concerns: deactivate cleanly so the next owner can register.",
    ],
    estimatedMinutes: 5,
    lastVerifiedOn: "2026-04-01",
  },
  {
    id: "grammarly",
    serviceName: "Grammarly",
    matchService: ["grammarly"],
    domain: "grammarly.com",
    cancelUrl: "https://account.grammarly.com/subscription",
    steps: [
      "Open account.grammarly.com → Subscription.",
      "Click 'Cancel Subscription'.",
      "Reject retention offers (50% off, downgrade to Free).",
    ],
    scripts: [
      { label: "If pushed to downgrade", body: "I'll stick with the free tier — please complete the cancellation." },
    ],
    gotchas: [
      "Cancelling within 7 days of purchase qualifies for a full refund.",
      "Premium features (Generative AI prompts) revert immediately.",
    ],
    expectedRetentionOffer: { kind: "percent", valueText: "50% off for 6 months" },
    estimatedMinutes: 4,
    lastVerifiedOn: "2026-04-01",
  },
];

/**
 * Find the playbook whose matchService entries hit the given subscription name.
 */
export function findPlaybook(serviceName: string): CancellationPlaybook | null {
  const needle = serviceName.trim().toLowerCase();
  if (!needle) return null;
  for (const playbook of CANCELLATION_PLAYBOOKS) {
    if (playbook.matchService.some((variant) => needle.includes(variant) || variant.includes(needle))) {
      return playbook;
    }
  }
  return null;
}

/**
 * Fallback playbook used when no match exists — keeps the coach flow usable.
 */
export const GENERIC_PLAYBOOK: CancellationPlaybook = {
  id: "generic",
  serviceName: "Unknown service",
  matchService: [],
  steps: [
    "Find the service's account / billing page (search 'cancel <name>').",
    "Disable auto-renewal first if cancellation isn't immediate.",
    "Take a screenshot of any confirmation.",
    "Set a calendar reminder for the next billing date to confirm the charge didn't repeat.",
  ],
  scripts: [
    {
      label: "When pressed for a reason",
      body: "I'm reducing recurring expenses. Not interested in a discount — thank you.",
    },
  ],
  gotchas: [
    "App-store-managed subs (iOS / Android) require cancellation in those settings, not the service.",
    "Refunds within the cancellation window usually require asking explicitly.",
  ],
  estimatedMinutes: 5,
  lastVerifiedOn: "2026-04-01",
};
