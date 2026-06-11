import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { staleness } from "../stalenessUtils";

// BVA boundaries around STALE_HOURS=12
// staleness(lastSyncedAt) → { stale: boolean, label: string }
// Partition classes:
//   P1: null/undefined                   → stale:true, "Never synced"
//   P2: diffH in [0, 12)                 → stale:false, ""
//   P3: diffH in [12, 24)                → stale:true, "Last synced Xh ago"
//   P4: diffH >= 24                      → stale:true, "Last synced Xd ago"
// BVA points: 0h, 11h59m (boundary-1), 12h (boundary), 12h1m (boundary+1), 23h, 25h, 48h

describe("staleness()", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  // ── P1: null / undefined ──────────────────────────────────────────────────

  it("staleness_null_returns_never_synced", () => {
    /**
     * Scenario: lastSyncedAt is null (no sync has ever occurred)
     * EP class: P1 — null input (falsy guard triggers immediately)
     * Expected: { stale: true, label: "Never synced" }
     */
    const result = staleness(null);
    expect(result).toEqual({ stale: true, label: "Never synced" });
  });

  it("staleness_undefined_returns_never_synced", () => {
    /**
     * Scenario: lastSyncedAt is undefined (field absent)
     * EP class: P1 — undefined input (falsy guard triggers immediately)
     * Expected: { stale: true, label: "Never synced" }
     */
    const result = staleness(undefined);
    expect(result).toEqual({ stale: true, label: "Never synced" });
  });

  // ── P2: fresh (diffH < 12) ────────────────────────────────────────────────

  it("staleness_just_synced_returns_fresh", () => {
    /**
     * Scenario: lastSyncedAt is exactly now (0 hours ago)
     * EP class: P2 lower BVA — diffH = 0, well inside [0, 12)
     * Expected: { stale: false, label: "" }
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const result = staleness(new Date(now).toISOString());
    expect(result).toEqual({ stale: false, label: "" });
  });

  it("staleness_bva_11h59m_returns_fresh", () => {
    /**
     * Scenario: lastSyncedAt is 11 hours 59 minutes ago (1 minute before the stale boundary)
     * EP class: P2 upper BVA — diffH ≈ 11.9833, strictly less than 12
     * Expected: { stale: false, label: "" }
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const elevenH59M = new Date(now - (11 * 60 + 59) * 60 * 1000).toISOString();
    const result = staleness(elevenH59M);
    expect(result).toEqual({ stale: false, label: "" });
  });

  // ── P3: stale, hours label (12 <= diffH < 24) ────────────────────────────

  it("staleness_bva_exactly_12h_returns_stale", () => {
    /**
     * Scenario: lastSyncedAt is exactly 12 hours ago (at the stale boundary)
     * EP class: P3 lower BVA — diffH = 12.0; condition `diffH < 12` is false, so stale
     * Expected: { stale: true, label: "Last synced 12h ago" }
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const exactly12H = new Date(now - 12 * 60 * 60 * 1000).toISOString();
    const result = staleness(exactly12H);
    expect(result).toEqual({ stale: true, label: "Last synced 12h ago" });
  });

  it("staleness_bva_12h1m_returns_stale", () => {
    /**
     * Scenario: lastSyncedAt is 12 hours 1 minute ago (just past the stale boundary)
     * EP class: P3 near-boundary — diffH ≈ 12.0167, clearly in stale territory
     * Expected: { stale: true, label: "Last synced 12h ago" } (Math.floor(12.016) = 12)
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const twelveH1M = new Date(now - (12 * 60 + 1) * 60 * 1000).toISOString();
    const result = staleness(twelveH1M);
    expect(result).toEqual({ stale: true, label: "Last synced 12h ago" });
  });

  it("staleness_23h_label_format_hours", () => {
    /**
     * Scenario: lastSyncedAt is 23 hours ago (inside the hours-label range)
     * EP class: P3 upper BVA — diffH = 23, last integer before day boundary
     * Expected: { stale: true, label: "Last synced 23h ago" }
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const twentyThreeH = new Date(now - 23 * 60 * 60 * 1000).toISOString();
    const result = staleness(twentyThreeH);
    expect(result).toEqual({ stale: true, label: "Last synced 23h ago" });
  });

  // ── P4: stale, days label (diffH >= 24) ──────────────────────────────────

  it("staleness_25h_label_format_days", () => {
    /**
     * Scenario: lastSyncedAt is 25 hours ago (just into the days-label range)
     * EP class: P4 lower BVA — diffH = 25, Math.floor(25/24) = 1
     * Expected: { stale: true, label: "Last synced 1d ago" }
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const twentyFiveH = new Date(now - 25 * 60 * 60 * 1000).toISOString();
    const result = staleness(twentyFiveH);
    expect(result).toEqual({ stale: true, label: "Last synced 1d ago" });
  });

  it("staleness_48h_label_format_2_days", () => {
    /**
     * Scenario: lastSyncedAt is 48 hours ago (exactly 2 days)
     * EP class: P4 interior — diffH = 48, Math.floor(48/24) = 2
     * Expected: { stale: true, label: "Last synced 2d ago" }
     */
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    vi.setSystemTime(now);
    const fortyEightH = new Date(now - 48 * 60 * 60 * 1000).toISOString();
    const result = staleness(fortyEightH);
    expect(result).toEqual({ stale: true, label: "Last synced 2d ago" });
  });
});
