import type { BranchId } from "./schema";

// ---------------------------------------------------------------------------
// External events: pre-scripted, fully automatic shocks that fire on their
// own during the round — no facilitator delivery, no branch decision. Each
// one lands as an announcement at its branch AND moves that branch's score
// directly, so branches feel real, competitive movement that isn't tied to
// anything they chose. At debrief, compare this against the score movement
// that DID come from their own actions (slips, interactions, cards).
//
// impactType "nps"    -> added directly to the NPS score bucket (0-50 scale)
// impactType "morale" -> added directly to the morale delta (0-100 scale,
//                        same spirit/magnitude as MORALE_WEIGHTS in storage)
// Neither touches the raw "Avg NPS" stat — that stays a genuine record of
// actual customer taps, so the debrief reveal stays honest.
// ---------------------------------------------------------------------------

export type ExternalEventImpactType = "nps" | "morale";

export interface ExternalEventDef {
  id: string;
  branch: BranchId;
  title: string;
  message: string; // shown verbatim as the branch's announcement
  tone: "positive" | "negative" | "neutral";
  impactType: ExternalEventImpactType;
  impactAmount: number; // can be negative
  triggerMinute: number; // elapsed round minutes at which it fires
}

export const EXTERNAL_EVENTS: ExternalEventDef[] = [
  {
    id: "a-ext-staff-shortage",
    branch: "a",
    title: "Unplanned staff shortage",
    message:
      "One of your tellers went on unplanned leave this morning — two customers couldn't be served on time. Outside anyone's control, but it's going to show up in your score.",
    tone: "negative",
    impactType: "nps",
    impactAmount: -4,
    triggerMinute: 5,
  },
  {
    id: "a-ext-smooth-systems",
    branch: "a",
    title: "Smooth systems morning",
    message:
      "Your systems ran without a single hiccup all morning — that quiet reliability is giving your score a small boost.",
    tone: "positive",
    impactType: "nps",
    impactAmount: 3,
    triggerMinute: 19,
  },
  {
    id: "b-ext-overdue-flag",
    branch: "b",
    title: "Overdue request flagged",
    message:
      "Head office just flagged one of your policy requests from last week as overdue. Nobody in the room today caused it — but morale takes the hit.",
    tone: "negative",
    impactType: "morale",
    impactAmount: -8,
    triggerMinute: 10,
  },
  {
    id: "b-ext-manager-praise",
    branch: "b",
    title: "Regional manager praise",
    message:
      "The regional manager singled out your branch for good teamwork on this morning's call. A small morale lift — no action needed on your side.",
    tone: "positive",
    impactType: "morale",
    impactAmount: 6,
    triggerMinute: 24,
  },
  {
    id: "c-ext-queue-backup",
    branch: "c",
    title: "Queue backup outside the branch",
    message:
      "A queue backup outside the branch delayed three customers by ten minutes before they even reached the counter. That's going to cost you some score.",
    tone: "negative",
    impactType: "nps",
    impactAmount: -3,
    triggerMinute: 6,
  },
  {
    id: "c-ext-backlog-cleared",
    branch: "c",
    title: "Backlog cleared overnight",
    message:
      "Back-office cleared your entire backlog overnight without being asked. A quiet win for morale.",
    tone: "positive",
    impactType: "morale",
    impactAmount: 5,
    triggerMinute: 17,
  },
];

export const EXTERNAL_EVENT_BY_ID: Record<string, ExternalEventDef> = Object.fromEntries(
  EXTERNAL_EVENTS.map((e) => [e.id, e]),
);
