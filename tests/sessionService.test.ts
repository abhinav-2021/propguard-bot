import { describe, it, expect } from 'vitest';
import {
  getCmeSessionInfo,
  getNextWeekdayHaltUtc,
  getNextWeekdayLiquidationUtc,
  getNextReopenUtc,
} from '../src/services/sessionService';

describe('CME Session Service (Pure UTC Calculation)', () => {
  it('correctly targets today (Thursday) 21:59 UTC when checking from Thursday morning', () => {
    // Thursday Nov 5, 2026, 10:45 AM UTC (which is morning in US / afternoon in EU/Asia)
    const now = new Date('2026-11-05T10:45:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('OPEN');
    expect(info.isHalted).toBe(false);

    // Pure UTC check: target MUST be today (Thursday) at 21:59:00.000Z
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-05T21:59:00.000Z');
    expect(info.nextHaltUnix).toBe(Math.floor(new Date('2026-11-05T21:59:00.000Z').getTime() / 1000));

    // Discord timestamps must use this exact UNIX timestamp
    expect(info.discordTimestamps.haltRelative).toBe(`<t:${info.nextHaltUnix}:R>`);
    expect(info.discordTimestamps.haltFull).toBe(`<t:${info.nextHaltUnix}:F>`);

    // Auto-liquidation must target today (Thursday) at 21:55:00.000Z
    expect(info.nextAutoLiquidationTime.toISOString()).toBe('2026-11-05T21:55:00.000Z');
    expect(info.discordTimestamps.liquidationRelative).toBe(`<t:${info.nextAutoLiquidationUnix}:R>`);
  });

  it('triggers LIQUIDATION_WINDOW status on Thursday between 21:55 and 21:59 UTC', () => {
    // Thursday Nov 5, 2026, 21:56:00 UTC (4:56 PM EST)
    const now = new Date('2026-11-05T21:56:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('LIQUIDATION_WINDOW');
    expect(info.isInsideLiquidationWindow).toBe(true);
    expect(info.isHalted).toBe(false);
    expect(info.statusColorHex).toBe('#ED4245');
    expect(info.warnings.some((w) => w.includes('AUTO-LIQUIDATION IN EFFECT'))).toBe(true);
  });

  it('detects DAILY_HALT during 21:59 to 23:00 UTC maintenance pause on Thursday', () => {
    // Thursday Nov 5, 2026, 22:15:00 UTC (5:15 PM EST)
    const now = new Date('2026-11-05T22:15:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('DAILY_HALT');
    expect(info.isHalted).toBe(true);
    expect(info.statusColorHex).toBe('#FEE75C');

    // Reopen must be today at 23:00 UTC
    expect(info.nextReopenTime.toISOString()).toBe('2026-11-05T23:00:00.000Z');

    // Next halt must be tomorrow (Friday) at 21:59 UTC
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-06T21:59:00.000Z');
  });

  it('detects reopened evening session on Thursday at 23:30 UTC', () => {
    // Thursday Nov 5, 2026, 23:30:00 UTC (6:30 PM EST)
    const now = new Date('2026-11-05T23:30:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('OPEN');
    expect(info.isHalted).toBe(false);

    // Next halt is Friday 21:59 UTC
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-06T21:59:00.000Z');
  });

  it('handles Friday market close for the weekend', () => {
    // Friday Nov 6, 2026, 22:30:00 UTC (after 21:59 UTC halt)
    const now = new Date('2026-11-06T22:30:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('WEEKEND_HALT');
    expect(info.isHalted).toBe(true);
    expect(info.isWeekend).toBe(true);

    // Reopen must be Sunday Nov 8, 2026, 23:00 UTC (6:00 PM EST)
    expect(info.nextReopenTime.toISOString()).toBe('2026-11-08T23:00:00.000Z');

    // Next halt must be Monday Nov 9, 2026, 21:59 UTC
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-09T21:59:00.000Z');
  });

  it('handles Saturday weekend closure', () => {
    // Saturday Nov 7, 2026, 15:00:00 UTC
    const now = new Date('2026-11-07T15:00:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('WEEKEND_HALT');
    expect(info.isHalted).toBe(true);
    expect(info.isWeekend).toBe(true);

    // Reopen is Sunday Nov 8, 2026, 23:00 UTC
    expect(info.nextReopenTime.toISOString()).toBe('2026-11-08T23:00:00.000Z');
    // Next halt is Monday Nov 9, 2026, 21:59 UTC
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-09T21:59:00.000Z');
  });

  it('handles Sunday afternoon before market opens', () => {
    // Sunday Nov 8, 2026, 14:00:00 UTC
    const now = new Date('2026-11-08T14:00:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('WEEKEND_HALT');
    expect(info.isHalted).toBe(true);

    // Reopens today at 23:00 UTC
    expect(info.nextReopenTime.toISOString()).toBe('2026-11-08T23:00:00.000Z');
    // Next halt is Monday 21:59 UTC
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-09T21:59:00.000Z');
  });

  it('handles Sunday evening after market opens', () => {
    // Sunday Nov 8, 2026, 23:30:00 UTC
    const now = new Date('2026-11-08T23:30:00.000Z');
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('OPEN');
    expect(info.isHalted).toBe(false);

    // Next halt is Monday Nov 9, 2026, 21:59 UTC
    expect(info.nextHaltTime.toISOString()).toBe('2026-11-09T21:59:00.000Z');
  });

  describe('helper functions direct unit tests', () => {
    it('getNextWeekdayHaltUtc finds 21:59 UTC on weekdays', () => {
      const monMorning = new Date('2026-11-02T08:00:00.000Z');
      expect(getNextWeekdayHaltUtc(monMorning).toISOString()).toBe('2026-11-02T21:59:00.000Z');

      const friNight = new Date('2026-11-06T22:00:00.000Z');
      expect(getNextWeekdayHaltUtc(friNight).toISOString()).toBe('2026-11-09T21:59:00.000Z');
    });

    it('getNextWeekdayLiquidationUtc finds 21:55 UTC on weekdays', () => {
      const tueMorning = new Date('2026-11-03T09:00:00.000Z');
      expect(getNextWeekdayLiquidationUtc(tueMorning).toISOString()).toBe('2026-11-03T21:55:00.000Z');
    });

    it('getNextReopenUtc handles weekend transition', () => {
      const sat = new Date('2026-11-07T12:00:00.000Z');
      expect(getNextReopenUtc(sat).toISOString()).toBe('2026-11-08T23:00:00.000Z');
    });
  });
});
