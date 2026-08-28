import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage, ROUTES_TO } from "./storage";
import {
  BRANCH_IDS,
  DESK_TYPES,
  completeInteractionSchema,
  completeSlipSchema,
  updateSettingsSchema,
  createAnnouncementSchema,
  type BranchId,
} from "@shared/schema";
import { CARD_BY_ID } from "@shared/cards";
import { EXTERNAL_EVENT_BY_ID } from "@shared/external-events";
import { z } from "zod";

function isBranch(x: unknown): x is BranchId {
  return typeof x === "string" && (BRANCH_IDS as readonly string[]).includes(x);
}

const startInteractionBody = z.object({
  branch: z.string(),
});

const startSlipBody = z.object({
  branch: z.string(),
  deskType: z.string(),
});

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // --- Interactions ---
  app.get("/api/interactions", async (req, res) => {
    const branch = typeof req.query.branch === "string" ? req.query.branch : undefined;
    if (branch && !isBranch(branch)) return res.status(400).json({ error: "invalid branch" });
    const rows = await storage.listInteractions(branch as BranchId | undefined);
    res.json(rows);
  });

  app.post("/api/interactions", async (req, res) => {
    const parsed = startInteractionBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid body" });
    const { branch } = parsed.data;
    if (!isBranch(branch)) return res.status(400).json({ error: "invalid branch" });
    const now = Date.now();
    const row = await storage.startInteraction({ branch, startedAt: now, createdAt: now });
    res.status(201).json(row);
  });

  app.patch("/api/interactions/:id/complete", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = completeInteractionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid body" });
    const row = await storage.completeInteraction(id, parsed.data.outcome, parsed.data.npsScore, parsed.data.interactionType);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  // --- Slips ---
  app.get("/api/slips", async (req, res) => {
    const branch = typeof req.query.branch === "string" ? req.query.branch : undefined;
    if (branch && !isBranch(branch)) return res.status(400).json({ error: "invalid branch" });
    const rows = await storage.listSlips(branch as BranchId | undefined);
    res.json(rows);
  });

  app.post("/api/slips", async (req, res) => {
    const parsed = startSlipBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid body" });
    const { branch, deskType } = parsed.data;
    if (!isBranch(branch)) return res.status(400).json({ error: "invalid branch" });
    if (!(DESK_TYPES as readonly string[]).includes(deskType)) {
      return res.status(400).json({ error: "invalid deskType" });
    }
    const targetBranch = ROUTES_TO[branch];
    const now = Date.now();
    const row = await storage.startSlip({ branch, targetBranch, deskType, startedAt: now, createdAt: now });
    res.status(201).json(row);
  });

  app.patch("/api/slips/:id/complete", async (req, res) => {
    const id = Number(req.params.id);
    const parsed = completeSlipSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid body" });
    const row = await storage.completeSlip(id, parsed.data.outcome);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  // --- Settings ---
  app.get("/api/settings", async (_req, res) => {
    res.json(await storage.getSettings());
  });

  app.patch("/api/settings", async (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid body" });
    res.json(await storage.updateSettings(parsed.data));
  });

  // --- Dashboard ---
  app.get("/api/dashboard", async (_req, res) => {
    res.json(await storage.getDashboard());
  });

  // --- Cards (facilitator-only checklist; content stays physical/private) ---
  app.get("/api/cards", async (_req, res) => {
    res.json(await storage.getCardsState());
  });

  app.post("/api/cards/:cardId/deliver", async (req, res) => {
    const { cardId } = req.params;
    if (!CARD_BY_ID[cardId]) return res.status(404).json({ error: "unknown card" });
    const row = await storage.markCardDelivered(cardId);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  // --- External events (auto-fire on the round clock; facilitator can also
  // trigger one early from the Control page when they want it to land now) ---
  app.get("/api/external-events", async (_req, res) => {
    res.json(await storage.getExternalEventsState());
  });

  app.post("/api/external-events/:eventId/trigger", async (req, res) => {
    const { eventId } = req.params;
    if (!EXTERNAL_EVENT_BY_ID[eventId]) return res.status(404).json({ error: "unknown event" });
    try {
      const row = await storage.triggerExternalEvent(eventId);
      res.json(row);
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : "already fired" });
    }
  });

  // --- Announcements ---
  app.get("/api/announcements", async (req, res) => {
    const branch = typeof req.query.branch === "string" ? req.query.branch : undefined;
    res.json(await storage.listAnnouncements(branch));
  });

  app.post("/api/announcements", async (req, res) => {
    const parsed = createAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid body" });
    const { branch, message } = parsed.data;
    if (branch !== "all" && !isBranch(branch)) return res.status(400).json({ error: "invalid branch" });
    const row = await storage.createAnnouncement(branch, message, "facilitator", "neutral");
    res.status(201).json(row);
  });

  // --- Reset (facilitator control, dry-runs) ---
  app.post("/api/reset", async (_req, res) => {
    await storage.resetAll();
    res.json({ ok: true });
  });

  return httpServer;
}
