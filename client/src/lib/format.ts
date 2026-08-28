export function formatSeconds(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null) return "—";
  const s = Math.round(totalSeconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export function formatElapsed(startedAtMs: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  return formatSeconds(s);
}

export function formatNps(nps: number | null | undefined): string {
  if (nps == null) return "—";
  return nps.toFixed(1);
}

export const BRANCH_LABEL: Record<string, string> = {
  a: "Branch A",
  b: "Branch B",
  c: "Branch C",
};

export const DESK_LABEL: Record<string, string> = {
  policy_risk: "Policy / Risk",
  back_office: "Back-office",
};

export const OUTCOME_LABEL: Record<string, string> = {
  resolved: "Resolved",
  escalated: "Escalated",
  promise_broken: "Promise broken",
  approved: "Approved",
  declined: "Declined",
};

export const INTERACTION_TYPE_LABEL: Record<string, string> = {
  dilemma: "Dilemma card",
  quick_ask: "Quick-ask slip",
  other: "Other",
};

export function formatMorale(morale: number | null | undefined): string {
  if (morale == null) return "—";
  return String(Math.round(morale));
}

export function moraleTone(morale: number): "positive" | "neutral" | "negative" {
  if (morale >= 65) return "positive";
  if (morale <= 35) return "negative";
  return "neutral";
}

export const TONE_BADGE_CLASS: Record<string, string> = {
  positive: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  negative: "bg-destructive/15 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground border-card-border",
};

export const MORALE_COLOR_CLASS: Record<string, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
  neutral: "text-foreground",
};
