import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Branches are fixed: a, b, c (matches the physical room design).
// ---------------------------------------------------------------------------
export const BRANCH_IDS = ["a", "b", "c"] as const;
export type BranchId = (typeof BRANCH_IDS)[number];

export const BRANCH_NAMES: Record<BranchId, string> = {
  a: "Branch A",
  b: "Branch B",
  c: "Branch C",
};

// Slip-carry routing rule: A -> B, B -> C, C -> A
export const ROUTES_TO: Record<BranchId, BranchId> = { a: "b", b: "c", c: "a" };

export const INTERACTION_TYPES = ["dilemma", "quick_ask", "other"] as const;
export const INTERACTION_OUTCOMES = ["resolved", "escalated", "promise_broken"] as const;
export const DESK_TYPES = ["policy_risk", "back_office"] as const;
export const SLIP_OUTCOMES = ["approved", "declined"] as const;

// ---------------------------------------------------------------------------
// Interactions: a Customer <-> Frontline exchange at a branch desk.
// ---------------------------------------------------------------------------
export const interactions = sqliteTable("interactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branch: text("branch").notNull(), // BranchId
  interactionType: text("interaction_type").notNull().default("other"), // INTERACTION_TYPES, finalized on completion
  status: text("status").notNull().default("active"), // active | completed
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  resolutionSeconds: integer("resolution_seconds"),
  outcome: text("outcome"), // INTERACTION_OUTCOMES
  npsScore: integer("nps_score"), // 0-10, entered by the customer
  createdAt: integer("created_at").notNull(),
});

export const insertInteractionSchema = createInsertSchema(interactions).pick({
  branch: true,
  startedAt: true,
  createdAt: true,
});
export const completeInteractionSchema = z.object({
  outcome: z.enum(INTERACTION_OUTCOMES),
  npsScore: z.number().int().min(0).max(10),
  interactionType: z.enum(INTERACTION_TYPES),
});
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;
export type Interaction = typeof interactions.$inferSelect;

// ---------------------------------------------------------------------------
// Slips: a Frontline request carried across the room to another branch's
// Policy/Risk or Back-office desk. Logged at the sending branch's station.
// ---------------------------------------------------------------------------
export const slips = sqliteTable("slips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branch: text("branch").notNull(), // sending BranchId
  targetBranch: text("target_branch").notNull(), // receiving BranchId (per routing rule)
  deskType: text("desk_type").notNull(), // DESK_TYPES
  status: text("status").notNull().default("active"), // active | completed
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  resolutionSeconds: integer("resolution_seconds"),
  outcome: text("outcome"), // SLIP_OUTCOMES
  createdAt: integer("created_at").notNull(),
});

export const insertSlipSchema = createInsertSchema(slips).pick({
  branch: true,
  targetBranch: true,
  deskType: true,
  startedAt: true,
  createdAt: true,
});
export const completeSlipSchema = z.object({
  outcome: z.enum(SLIP_OUTCOMES),
});
export type InsertSlip = z.infer<typeof insertSlipSchema>;
export type Slip = typeof slips.$inferSelect;

// ---------------------------------------------------------------------------
// Settings: singleton row controlling the round + leaderboard reveal state.
// ---------------------------------------------------------------------------
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  leaderboardRevealed: integer("leaderboard_revealed", { mode: "boolean" }).notNull().default(false),
  roundStartedAt: integer("round_started_at"),
  roundEndedAt: integer("round_ended_at"),
});

export type Settings = typeof settings.$inferSelect;
export const updateSettingsSchema = z.object({
  leaderboardRevealed: z.boolean().optional(),
  roundStartedAt: z.number().nullable().optional(),
  roundEndedAt: z.number().nullable().optional(),
});
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// ---------------------------------------------------------------------------
// Card triggers: server-tracked delivery checklist for the 7 fixed
// dilemma/disruption cards (catalog lives in shared/cards.ts). Cards stay
// physical/private — this only records WHEN each became due and whether the
// facilitator has marked it delivered, for the Control page checklist.
// ---------------------------------------------------------------------------
export const cardTriggers = sqliteTable("card_triggers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: text("card_id").notNull().unique(),
  triggeredAt: integer("triggered_at").notNull(),
  deliveredAt: integer("delivered_at"),
});

export type CardTrigger = typeof cardTriggers.$inferSelect;

export interface CardState {
  id: string;
  kind: "start" | "disruption";
  branch: BranchId;
  role: string;
  title: string;
  dilemma: string;
  triggerMinute: number;
  due: boolean; // elapsed round time has reached triggerMinute
  triggeredAt: number | null;
  deliveredAt: number | null;
}

// ---------------------------------------------------------------------------
// External events: pre-scripted shocks (catalog lives in shared/external-
// events.ts) that fire fully automatically once the round reaches their
// trigger minute — no facilitator delivery, no branch decision. Firing
// both posts an announcement AND applies a direct score adjustment.
// ---------------------------------------------------------------------------
export const externalEventTriggers = sqliteTable("external_event_triggers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull().unique(),
  firedAt: integer("fired_at").notNull(),
});

export type ExternalEventTrigger = typeof externalEventTriggers.$inferSelect;

export interface ExternalEventState {
  id: string;
  branch: BranchId;
  title: string;
  message: string;
  tone: "positive" | "negative" | "neutral";
  impactType: "nps" | "morale";
  impactAmount: number;
  triggerMinute: number;
  due: boolean;
  firedAt: number | null;
}

// ---------------------------------------------------------------------------
// Announcements: short broadcast messages shown at a branch's shared laptop
// (or all branches). "system" ones are generated automatically from slip and
// interaction outcomes (cross-team relationship effects, morale-linked).
// "facilitator" ones are typed and sent live from the Control page.
// ---------------------------------------------------------------------------
export const ANNOUNCEMENT_SOURCES = ["system", "facilitator", "event"] as const;
export const ANNOUNCEMENT_TONES = ["positive", "negative", "neutral"] as const;

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  branch: text("branch").notNull(), // BranchId or "all"
  message: text("message").notNull(),
  source: text("source").notNull().default("system"), // ANNOUNCEMENT_SOURCES
  tone: text("tone").notNull().default("neutral"), // ANNOUNCEMENT_TONES
  createdAt: integer("created_at").notNull(),
});

export const createAnnouncementSchema = z.object({
  branch: z.string(), // BranchId or "all"
  message: z.string().min(1).max(280),
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof createAnnouncementSchema>;

// ---------------------------------------------------------------------------
// Dashboard aggregate shape (computed server-side, not a table).
// ---------------------------------------------------------------------------
export interface BranchStats {
  branch: BranchId;
  name: string;
  interactionsCompleted: number;
  interactionsActive: number;
  avgNps: number | null;
  avgResolutionSeconds: number | null;
  slipsSent: number;
  slipsResolved: number;
  slipsActive: number;
  avgSlipResolutionSeconds: number | null;
  slipsByDesk: Record<string, number>;
  morale: number; // 0-100, baseline 50
  score: number;
  scoreBreakdown: {
    npsPoints: number;
    throughputPoints: number;
    speedPoints: number;
    collaborationPoints: number;
    moralePoints: number;
  };
}
