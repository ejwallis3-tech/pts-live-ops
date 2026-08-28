import type { BranchId } from "./schema";

// ---------------------------------------------------------------------------
// Fixed catalog of the 7 dilemma/disruption cards from "Passionate to Serve
// - Role and Dilemma Cards". These stay physical, private, paper cards
// handed out by the facilitator — the app never displays their text on a
// branch's shared laptop. It only tracks WHEN each is due, as a live
// checklist on the Facilitator Control page, replacing a stopwatch.
//
// Timing source: Facilitator Pack, Block 3 instructions #23.
//   - The 4 "start" cards are opened by Customers at setup (round minute 0).
//   - The 3 "disruption" cards are delivered privately mid-round at fixed
//     elapsed-minute marks.
// ---------------------------------------------------------------------------

export type CardKind = "start" | "disruption";

export interface DilemmaCard {
  id: string;
  kind: CardKind;
  branch: BranchId;
  role: string; // who it's handed to
  title: string;
  dilemma: string; // short framing line
  triggerMinute: number; // elapsed round minutes at which it's due
}

export const DILEMMA_CARDS: DilemmaCard[] = [
  {
    id: "a-customer-verification-delay",
    kind: "start",
    branch: "a",
    role: "Customer",
    title: "The Verification Delay",
    dilemma: "Serving quickly vs. applying controls consistently",
    triggerMinute: 0,
  },
  {
    id: "a-customer-exception-request",
    kind: "start",
    branch: "a",
    role: "Customer",
    title: "The Exception Request",
    dilemma: "Making an exception vs. protecting fairness",
    triggerMinute: 0,
  },
  {
    id: "b-customer-policy-challenge",
    kind: "start",
    branch: "b",
    role: "Customer",
    title: "The Policy Challenge",
    dilemma: "Defending policy vs. acknowledging customer frustration",
    triggerMinute: 0,
  },
  {
    id: "c-customer-second-exception-request",
    kind: "start",
    branch: "c",
    role: "Customer",
    title: "The Second Exception Request",
    dilemma: "Making an exception vs. protecting fairness (variant)",
    triggerMinute: 0,
  },
  {
    id: "b-back-office-escalation",
    kind: "disruption",
    branch: "b",
    role: "Back-office",
    title: "Escalation",
    dilemma: "This exact problem happened before and was never fixed — escalate, or stay quiet?",
    triggerMinute: 8,
  },
  {
    id: "b-second-frontline-approval-chain",
    kind: "disruption",
    branch: "b",
    role: "Second Frontline",
    title: "Approval Chain",
    dilemma: "Confident you could resolve this alone — but policy requires a slip-carried sign-off first.",
    triggerMinute: 15,
  },
  {
    id: "a-frontline-capacity-gap",
    kind: "disruption",
    branch: "a",
    role: "Frontline",
    title: "Capacity Gap",
    dilemma: "Told to reassure the customer before confirming it's actually possible.",
    triggerMinute: 22,
  },
];

export const CARD_BY_ID: Record<string, DilemmaCard> = Object.fromEntries(
  DILEMMA_CARDS.map((c) => [c.id, c]),
);
