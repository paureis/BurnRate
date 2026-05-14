import {
  Activity,
  BriefcaseBusiness,
  Cloud,
  Code2,
  Dumbbell,
  Gamepad2,
  Music,
  Newspaper,
  Sparkles,
  Tv,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { addDaysDateInputValue, todayDateInputValue, type BillingCycle, type PlannedPriceChange } from "@/lib/burnrate";

export type View = "dashboard" | "subscriptions" | "trials" | "simulator" | "share";
export type SortKey = "cost" | "name" | "nextBillingDate" | "category";

export interface SubscriptionDraft {
  name: string;
  cost: string;
  billingCycle: BillingCycle;
  category: string;
  nextBillingDate: string;
  notes: string;
  color: string;
  icon: string;
  currency: string;
  cancellingOn: string;
  tags: string[];
  priceChanges: PlannedPriceChange[];
}

export interface TrialDraft {
  name: string;
  trialStartDate: string;
  trialEndDate: string;
  costAfterTrial: string;
  remindMe: boolean;
}

export const storageKeys = {
  subscriptions: "burnrate.subscriptions.v1",
  trials: "burnrate.trials.v1",
  theme: "burnrate.theme.v1",
  trialAlertsDismissed: "burnrate.trialAlertsDismissed.v1",
  budget: "burnrate.budget.v1",
  preferences: "burnrate.preferences.v1",
  ledger: "burnrate.ledger.v1",
  vault: "burnrate.vault.v1",
  recommendationsDismissed: "burnrate.recommendations.dismissed.v1",
  // v4
  views: "burnrate.views.v1",
  categories: "burnrate.categories.v1",
  history: "burnrate.history.v1",
};

export const iconMap: Record<string, LucideIcon> = {
  tv: Tv,
  briefcase: BriefcaseBusiness,
  dumbbell: Dumbbell,
  music: Music,
  cloud: Cloud,
  newspaper: Newspaper,
  gamepad: Gamepad2,
  utensils: Utensils,
  wallet: WalletCards,
  code: Code2,
  activity: Activity,
  sparkles: Sparkles,
};

export const iconOptions = [
  { value: "wallet", label: "Wallet" },
  { value: "tv", label: "TV" },
  { value: "briefcase", label: "Work" },
  { value: "dumbbell", label: "Fitness" },
  { value: "music", label: "Music" },
  { value: "cloud", label: "Cloud" },
  { value: "newspaper", label: "News" },
  { value: "gamepad", label: "Gaming" },
  { value: "utensils", label: "Food" },
  { value: "code", label: "Code" },
  { value: "activity", label: "Activity" },
];

export function newSubscriptionDraft(baseCurrency = "USD"): SubscriptionDraft {
  return {
    name: "",
    cost: "",
    billingCycle: "monthly",
    category: "other",
    nextBillingDate: todayDateInputValue(),
    notes: "",
    color: "#ff5a3d",
    icon: "wallet",
    currency: baseCurrency,
    cancellingOn: "",
    tags: [],
    priceChanges: [],
  };
}

export function newTrialDraft(): TrialDraft {
  return {
    name: "",
    trialStartDate: todayDateInputValue(),
    trialEndDate: addDaysDateInputValue(14),
    costAfterTrial: "",
    remindMe: true,
  };
}

export function daysUntilDate(date: string): number {
  const today = new Date();
  const targetParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!targetParts) {
    return 0;
  }
  const target = new Date(Number(targetParts[1]), Number(targetParts[2]) - 1, Number(targetParts[3]));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}
