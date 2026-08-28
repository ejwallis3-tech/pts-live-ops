import {
  interactions,
  slips,
  settings,
  cardTriggers,
  externalEventTriggers,
  announcements,
  BRANCH_IDS,
  BRANCH_NAMES,
  ROUTES_TO,
  type BranchId,
  type Interaction,
  type InsertInteraction,
  type Slip,
  type InsertSlip,
  type Settings,
  type BranchStats,
  type CardState,
  type ExternalEventState,
  type Announcement,
} from "@shared/schema";
import { DILEMMA_CARDS, CARD_BY_ID } from "@shared/cards";
import { EXTERNAL_EVENTS, EXTERNAL_EVENT_BY_ID } from "@shared/external-events";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";
import path from "node:path";

// DATA_DIR lets us point the SQLite file at a Render persistent disk's mount
// path (e.g. /var/data) in production, while defaulting to the project root
// for local development — unchanged behavior when the env var isn't set.
const dataDir = process.env.DATA_DIR || process.cwd();
const sqlite = new Database(path.join(dataDir, "data.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Self-healing schema: applies any pending SQL migrations on startup.
// Safe to run on every boot — drizzle tracks which migrations already ran
// in a bookkeeping table, so this is a no-op once the schema is current.
// Critical for fresh hosts (e.g. a new Render deploy) where the SQLite
// file starts out completely empty.
migrate(db, { migrationsFolder: path.join(process.cwd(), "migrations") });

// Scoring weights — transparent, not scientific. Shown in the dashboard's
// "how this is calculated" breakdown so the facilitator can unpack it live.
const SCORE_WEIGHTS = {
  npsPerPoint: 5, // avg NPS (0-10) * 5 => max 50
  throughputPerInteraction: 2, // completed interactions, capped
  throughputCap: 10, // max 10 interactions counted => max 20 pts
  speedTargetSeconds: 240, // 4 minutes: at/under this, full speed points
  speedMaxPoints: 20,
  collabPerSlip: 2, // resolved slips, capped
  collabCap: 5, // max 5 slips counted => max 10 pts
  moraleMaxPoints: 20, // morale (0-100) scaled onto this
};

// Morale weights — transparent, not scientific, same spirit as SCORE_WEIGHTS.
// Morale is fully re-derived each time from stored interactions/slips (never
// stored as mutable state), matching how the main score is computed.
const MORALE_BASE = 50;
const MORALE_FAST_SECONDS = 120; // slip resolved at/under this = "fast"
const MORALE_WEIGHTS = {
  slipSenderApprovedFast: 6,
  slipSenderApprovedSlow: 2,
  slipSenderDeclined: -6,
  slipResolverApprovedFast: 3,
  slipResolverApprovedSlow: 1,
  slipResolverDeclined: -2,
  interactionResolved: 1,
  interactionEscalated: -4,
  interactionPromiseBroken: -6,
};

function computeScore(input: {
  avgNps: number | null;
  interactionsCompleted: number;
  avgResolutionSeconds: number | null;
  slipsResolved: number;
  morale: number;
  externalNpsPoints: number;
}) {
  const rawNpsPoints =
    (input.avgNps != null ? input.avgNps * SCORE_WEIGHTS.npsPerPoint : 0) + input.externalNpsPoints;
  const npsPoints = Math.round(Math.max(0, Math.min(50, rawNpsPoints)) * 10) / 10;
  const throughputPoints =
    Math.min(input.interactionsCompleted, SCORE_WEIGHTS.throughputCap) * SCORE_WEIGHTS.throughputPerInteraction;
  let speedPoints = 0;
  if (input.avgResolutionSeconds != null) {
    const ratio = Math.max(0, Math.min(1, (SCORE_WEIGHTS.speedTargetSeconds - input.avgResolutionSeconds + SCORE_WEIGHTS.speedTargetSeconds) / (SCORE_WEIGHTS.speedTargetSeconds * 2)));
    // Simpler: full points if avg <= target, decaying linearly to 0 at 3x target
    const cap = SCORE_WEIGHTS.speedTargetSeconds * 3;
    const clamped = Math.max(0, Math.min(cap, input.avgResolutionSeconds));
    speedPoints = Math.round((1 - clamped / cap) * SCORE_WEIGHTS.speedMaxPoints * 10) / 10;
  }
  const collaborationPoints = Math.min(input.slipsResolved, SCORE_WEIGHTS.collabCap) * SCORE_WEIGHTS.collabPerSlip;
  const moralePoints = Math.round((input.morale / 100) * SCORE_WEIGHTS.moraleMaxPoints * 10) / 10;
  const total = Math.round((npsPoints + throughputPoints + speedPoints + collaborationPoints + moralePoints) * 10) / 10;
  return {
    score: total,
    scoreBreakdown: { npsPoints, throughputPoints, speedPoints, collaborationPoints, moralePoints },
  };
}

export interface IStorage {
  // Interactions
  startInteraction(input: InsertInteraction): Promise<Interaction>;
  completeInteraction(id: number, outcome: string, npsScore: number, interactionType: string): Promise<Interaction | undefined>;
  listInteractions(branch?: BranchId): Promise<Interaction[]>;

  // Slips
  startSlip(input: InsertSlip): Promise<Slip>;
  completeSlip(id: number, outcome: string): Promise<Slip | undefined>;
  listSlips(branch?: BranchId): Promise<Slip[]>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Pick<Settings, "leaderboardRevealed" | "roundStartedAt" | "roundEndedAt">>): Promise<Settings>;

  // Cards (facilitator checklist — content stays physical/private)
  getCardsState(): Promise<CardState[]>;
  markCardDelivered(cardId: string): Promise<CardState | undefined>;

  // External events — auto-fire on the round clock, or the facilitator can
  // trigger one early from the Control page when they want it to land now.
  getExternalEventsState(): Promise<ExternalEventState[]>;
  triggerExternalEvent(eventId: string): Promise<ExternalEventState>;

  // Announcements
  listAnnouncements(branch?: string): Promise<Announcement[]>;
  createAnnouncement(
    branch: string,
    message: string,
    source: "system" | "facilitator" | "event",
    tone: "positive" | "negative" | "neutral",
  ): Promise<Announcement>;

  // Aggregates
  getDashboard(): Promise<BranchStats[]>;
  resetAll(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async startInteraction(input: InsertInteraction): Promise<Interaction> {
    return db.insert(interactions).values(input).returning().get();
  }

  async completeInteraction(id: number, outcome: string, npsScore: number, interactionType: string): Promise<Interaction | undefined> {
    const existing = db.select().from(interactions).where(eq(interactions.id, id)).get();
    if (!existing) return undefined;
    const endedAt = Date.now();
    const resolutionSeconds = Math.max(0, Math.round((endedAt - existing.startedAt) / 1000));
    const row = db
      .update(interactions)
      .set({ status: "completed", endedAt, resolutionSeconds, outcome, npsScore, interactionType })
      .where(eq(interactions.id, id))
      .returning()
      .get();
    if (row && outcome === "escalated") {
      await this.createAnnouncement(
        row.branch,
        "A customer interaction had to be escalated — morale takes a hit.",
        "system",
        "negative",
      );
    } else if (row && outcome === "promise_broken") {
      await this.createAnnouncement(
        row.branch,
        "A promise made to a customer couldn't be kept — trust erodes fast when that happens.",
        "system",
        "negative",
      );
    }
    return row;
  }

  async listInteractions(branch?: BranchId): Promise<Interaction[]> {
    const q = db.select().from(interactions).orderBy(desc(interactions.createdAt));
    const rows = q.all();
    return branch ? rows.filter((r) => r.branch === branch) : rows;
  }

  async startSlip(input: InsertSlip): Promise<Slip> {
    return db.insert(slips).values(input).returning().get();
  }

  async completeSlip(id: number, outcome: string): Promise<Slip | undefined> {
    const existing = db.select().from(slips).where(eq(slips.id, id)).get();
    if (!existing) return undefined;
    const endedAt = Date.now();
    const resolutionSeconds = Math.max(0, Math.round((endedAt - existing.startedAt) / 1000));
    const row = db
      .update(slips)
      .set({ status: "completed", endedAt, resolutionSeconds, outcome })
      .where(eq(slips.id, id))
      .returning()
      .get();
    if (row) {
      const resolverName = BRANCH_NAMES[row.targetBranch as BranchId];
      const deskLabel = row.deskType === "policy_risk" ? "Policy/Risk" : "Back-office";
      if (outcome === "declined") {
        await this.createAnnouncement(
          row.branch,
          `${resolverName} declined your ${deskLabel} request — that one's a dead end.`,
          "system",
          "negative",
        );
      } else if (outcome === "approved") {
        const fast = (resolutionSeconds ?? 0) <= MORALE_FAST_SECONDS;
        await this.createAnnouncement(
          row.branch,
          fast
            ? `${resolverName} approved your ${deskLabel} request in ${resolutionSeconds}s — momentum holding.`
            : `${resolverName} eventually approved your ${deskLabel} request after ${resolutionSeconds}s — but it cost you time.`,
          "system",
          fast ? "positive" : "neutral",
        );
      }
    }
    return row;
  }

  async listSlips(branch?: BranchId): Promise<Slip[]> {
    const q = db.select().from(slips).orderBy(desc(slips.createdAt));
    const rows = q.all();
    return branch ? rows.filter((r) => r.branch === branch) : rows;
  }

  async getCardsState(): Promise<CardState[]> {
    const settingsRow = await this.getSettings();
    const roundStartedAt = settingsRow.roundStartedAt;
    const roundElapsedMs = roundStartedAt ? (settingsRow.roundEndedAt ?? Date.now()) - roundStartedAt : null;
    const existingTriggers = db.select().from(cardTriggers).all();
    const triggerByCardId = new Map(existingTriggers.map((t) => [t.cardId, t]));

    return DILEMMA_CARDS.map((card) => {
      const elapsedMinutes = roundElapsedMs != null ? roundElapsedMs / 60000 : -1;
      const due = roundStartedAt != null && elapsedMinutes >= card.triggerMinute;
      let trigger = triggerByCardId.get(card.id);
      if (due && !trigger) {
        trigger = db
          .insert(cardTriggers)
          .values({ cardId: card.id, triggeredAt: Date.now() })
          .returning()
          .get();
      }
      return {
        id: card.id,
        kind: card.kind,
        branch: card.branch,
        role: card.role,
        title: card.title,
        dilemma: card.dilemma,
        triggerMinute: card.triggerMinute,
        due,
        triggeredAt: trigger?.triggeredAt ?? null,
        deliveredAt: trigger?.deliveredAt ?? null,
      };
    });
  }

  async markCardDelivered(cardId: string): Promise<CardState | undefined> {
    if (!CARD_BY_ID[cardId]) return undefined;
    const existing = db.select().from(cardTriggers).where(eq(cardTriggers.cardId, cardId)).get();
    if (existing) {
      db.update(cardTriggers).set({ deliveredAt: Date.now() }).where(eq(cardTriggers.cardId, cardId)).run();
    } else {
      db.insert(cardTriggers).values({ cardId, triggeredAt: Date.now(), deliveredAt: Date.now() }).run();
    }
    const states = await this.getCardsState();
    return states.find((c) => c.id === cardId);
  }

  // Atomically marks one event fired and posts its announcement. Returns
  // true if this call actually fired it, false if it was already fired
  // (by the clock or another request) — callers no-op on false.
  private fireEvent(ev: (typeof EXTERNAL_EVENTS)[number]): boolean {
    try {
      db.insert(externalEventTriggers).values({ eventId: ev.id, firedAt: Date.now() }).run();
    } catch {
      return false; // unique constraint — already fired
    }
    db.insert(announcements)
      .values({ branch: ev.branch, message: ev.message, source: "event", tone: ev.tone, createdAt: Date.now() })
      .run();
    return true;
  }

  // Checks every external event's due time against the current round clock
  // and, the first time one crosses its trigger minute, fires it. Idempotent
  // — safe to call from any frequently-polled endpoint so firing never
  // depends on one specific page being open. The facilitator can also jump
  // the queue via triggerExternalEvent below.
  private fireDueExternalEvents(): void {
    const settingsRow = db.select().from(settings).get();
    if (!settingsRow || settingsRow.roundStartedAt == null) return;
    const roundElapsedMs = (settingsRow.roundEndedAt ?? Date.now()) - settingsRow.roundStartedAt;
    const elapsedMinutes = roundElapsedMs / 60000;
    const firedIds = new Set(db.select().from(externalEventTriggers).all().map((t) => t.eventId));
    for (const ev of EXTERNAL_EVENTS) {
      if (firedIds.has(ev.id) || elapsedMinutes < ev.triggerMinute) continue;
      this.fireEvent(ev);
    }
  }

  // Facilitator-initiated: fire a specific event right now, regardless of
  // its scheduled trigger minute. Throws if the id is unknown or it has
  // already fired (by the clock or a previous manual trigger).
  async triggerExternalEvent(eventId: string): Promise<ExternalEventState> {
    const ev = EXTERNAL_EVENT_BY_ID[eventId];
    if (!ev) throw new Error(`Unknown external event id: ${eventId}`);
    const alreadyFired = db.select().from(externalEventTriggers).where(eq(externalEventTriggers.eventId, eventId)).get();
    if (alreadyFired) throw new Error("Event has already fired");
    const fired = this.fireEvent(ev);
    if (!fired) throw new Error("Event has already fired");
    const states = await this.getExternalEventsState();
    return states.find((s) => s.id === eventId)!;
  }

  async getExternalEventsState(): Promise<ExternalEventState[]> {
    this.fireDueExternalEvents();
    const settingsRow = await this.getSettings();
    const roundStartedAt = settingsRow.roundStartedAt;
    const roundElapsedMs = roundStartedAt ? (settingsRow.roundEndedAt ?? Date.now()) - roundStartedAt : null;
    const existingTriggers = db.select().from(externalEventTriggers).all();
    const triggerByEventId = new Map(existingTriggers.map((t) => [t.eventId, t]));

    return EXTERNAL_EVENTS.map((ev) => {
      const elapsedMinutes = roundElapsedMs != null ? roundElapsedMs / 60000 : -1;
      const due = roundStartedAt != null && elapsedMinutes >= ev.triggerMinute;
      const trigger = triggerByEventId.get(ev.id);
      return {
        id: ev.id,
        branch: ev.branch,
        title: ev.title,
        message: ev.message,
        tone: ev.tone,
        impactType: ev.impactType,
        impactAmount: ev.impactAmount,
        triggerMinute: ev.triggerMinute,
        due,
        firedAt: trigger?.firedAt ?? null,
      };
    });
  }

  async listAnnouncements(branch?: string): Promise<Announcement[]> {
    const rows = db.select().from(announcements).orderBy(desc(announcements.createdAt)).all();
    if (!branch) return rows;
    return rows.filter((r) => r.branch === branch || r.branch === "all");
  }

  async createAnnouncement(
    branch: string,
    message: string,
    source: "system" | "facilitator" | "event",
    tone: "positive" | "negative" | "neutral",
  ): Promise<Announcement> {
    return db.insert(announcements).values({ branch, message, source, tone, createdAt: Date.now() }).returning().get();
  }

  async getSettings(): Promise<Settings> {
    let row = db.select().from(settings).get();
    if (!row) {
      row = db.insert(settings).values({ leaderboardRevealed: false }).returning().get();
    }
    return row;
  }

  async updateSettings(patch: Partial<Pick<Settings, "leaderboardRevealed" | "roundStartedAt" | "roundEndedAt">>): Promise<Settings> {
    const current = await this.getSettings();
    return db.update(settings).set(patch).where(eq(settings.id, current.id)).returning().get();
  }

  async getDashboard(): Promise<BranchStats[]> {
    this.fireDueExternalEvents();
    const allInteractions = db.select().from(interactions).all();
    const allSlips = db.select().from(slips).all();
    const firedExternalTriggers = db.select().from(externalEventTriggers).all();

    return BRANCH_IDS.map((branch) => {
      const branchInteractions = allInteractions.filter((i) => i.branch === branch);
      const completed = branchInteractions.filter((i) => i.status === "completed");
      const active = branchInteractions.filter((i) => i.status === "active");
      const npsScores = completed.map((i) => i.npsScore).filter((n): n is number => n != null);
      const resolutionTimes = completed.map((i) => i.resolutionSeconds).filter((n): n is number => n != null);

      const branchSlips = allSlips.filter((s) => s.branch === branch);
      const resolvedSlips = branchSlips.filter((s) => s.status === "completed");
      const activeSlips = branchSlips.filter((s) => s.status === "active");
      const slipResolutionTimes = resolvedSlips.map((s) => s.resolutionSeconds).filter((n): n is number => n != null);
      const slipsByDesk: Record<string, number> = {};
      for (const s of branchSlips) {
        slipsByDesk[s.deskType] = (slipsByDesk[s.deskType] || 0) + 1;
      }

      const avgNps = npsScores.length ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length : null;
      const avgResolutionSeconds = resolutionTimes.length
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : null;
      const avgSlipResolutionSeconds = slipResolutionTimes.length
        ? slipResolutionTimes.reduce((a, b) => a + b, 0) / slipResolutionTimes.length
        : null;

      // Morale: sender-side effects of slips THIS branch sent, resolver-side
      // effects of slips THIS branch resolved for others, plus this branch's
      // own interaction outcomes. Fully re-derived, never mutable state.
      const sentResolved = branchSlips.filter((s) => s.status === "completed");
      const resolvedForOthers = allSlips.filter((s) => s.targetBranch === branch && s.status === "completed");
      let moraleDelta = 0;
      for (const s of sentResolved) {
        if (s.outcome === "declined") moraleDelta += MORALE_WEIGHTS.slipSenderDeclined;
        else if (s.outcome === "approved") {
          moraleDelta +=
            (s.resolutionSeconds ?? 0) <= MORALE_FAST_SECONDS
              ? MORALE_WEIGHTS.slipSenderApprovedFast
              : MORALE_WEIGHTS.slipSenderApprovedSlow;
        }
      }
      for (const s of resolvedForOthers) {
        if (s.outcome === "declined") moraleDelta += MORALE_WEIGHTS.slipResolverDeclined;
        else if (s.outcome === "approved") {
          moraleDelta +=
            (s.resolutionSeconds ?? 0) <= MORALE_FAST_SECONDS
              ? MORALE_WEIGHTS.slipResolverApprovedFast
              : MORALE_WEIGHTS.slipResolverApprovedSlow;
        }
      }
      for (const i of completed) {
        if (i.outcome === "resolved") moraleDelta += MORALE_WEIGHTS.interactionResolved;
        else if (i.outcome === "escalated") moraleDelta += MORALE_WEIGHTS.interactionEscalated;
        else if (i.outcome === "promise_broken") moraleDelta += MORALE_WEIGHTS.interactionPromiseBroken;
      }

      // External events (pre-scripted, fully automatic — no branch decision
      // involved): morale-flavored ones fold into the same morale delta as
      // slips/interactions; nps-flavored ones adjust the NPS score bucket
      // directly, never the genuine avgNps average, in computeScore below.
      let externalNpsPoints = 0;
      for (const t of firedExternalTriggers) {
        const ev = EXTERNAL_EVENT_BY_ID[t.eventId];
        if (!ev || ev.branch !== branch) continue;
        if (ev.impactType === "morale") moraleDelta += ev.impactAmount;
        else externalNpsPoints += ev.impactAmount;
      }

      const morale = Math.max(0, Math.min(100, MORALE_BASE + moraleDelta));

      const { score, scoreBreakdown } = computeScore({
        avgNps,
        interactionsCompleted: completed.length,
        avgResolutionSeconds,
        slipsResolved: resolvedSlips.length,
        morale,
        externalNpsPoints,
      });

      return {
        branch,
        name: BRANCH_NAMES[branch],
        interactionsCompleted: completed.length,
        interactionsActive: active.length,
        avgNps,
        avgResolutionSeconds,
        slipsSent: branchSlips.length,
        slipsResolved: resolvedSlips.length,
        slipsActive: activeSlips.length,
        avgSlipResolutionSeconds,
        slipsByDesk,
        morale,
        score,
        scoreBreakdown,
      };
    }).sort((a, b) => b.score - a.score);
  }

  async resetAll(): Promise<void> {
    db.delete(interactions).run();
    db.delete(slips).run();
    db.delete(cardTriggers).run();
    db.delete(externalEventTriggers).run();
    db.delete(announcements).run();
    const current = await this.getSettings();
    db.update(settings)
      .set({ leaderboardRevealed: false, roundStartedAt: null, roundEndedAt: null })
      .where(eq(settings.id, current.id))
      .run();
  }
}

export const storage = new DatabaseStorage();
export { ROUTES_TO };
