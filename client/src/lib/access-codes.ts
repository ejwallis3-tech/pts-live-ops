import type { BranchId } from "@shared/schema";

// ---------------------------------------------------------------------------
// Live-run access codes. Change these before a session if you want fresh
// ones — no other code needs to change. Each branch table only learns its
// own 4-digit code (write it on the table card / laptop); the facilitator
// code is for /control only. These are a lightweight "don't wander into
// someone else's tab" gate for an in-room exercise, not a security system —
// anyone opening dev tools could read them from the bundle.
// ---------------------------------------------------------------------------

export const BRANCH_PINS: Record<BranchId, string> = {
  a: "4127",
  b: "8350",
  c: "2694",
};

export const FACILITATOR_PIN = "7799";
