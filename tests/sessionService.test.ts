import { describe, it, expect } from 'vitest';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { getCmeSessionInfo, TIMEZONES } from '../src/services/sessionService';

describe('CME Session Service', () => {
  it('identifies normal daytime trading session on Wednesday 10:00 AM EST', () => {
    // Wednesday Nov 4, 2026, 10:00 AM EST
    const now = fromZonedTime('2026-11-04 10:00:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('OPEN');
    expect(info.isHalted).toBe(false);
    expect(info.isInsideLiquidationWindow).toBe(false);

    // Halt should be today at 16:59 EST
    const haltEst = formatInTimeZone(info.nextHaltTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(haltEst).toBe('2026-11-04 16:59');

    // Auto-liquidation should be today at 16:55 EST
    const liqEst = formatInTimeZone(info.nextAutoLiquidationTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(liqEst).toBe('2026-11-04 16:55');

    // Reopen should be today at 18:00 EST
    const reopenEst = formatInTimeZone(info.nextReopenTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(reopenEst).toBe('2026-11-04 18:00');

    // Verify discord relative timestamp format
    expect(info.discordTimestamps.haltRelative).toBe(`<t:${info.nextHaltUnix}:R>`);
    expect(info.discordTimestamps.haltFull).toBe(`<t:${info.nextHaltUnix}:F>`);
  });

  it('triggers LIQUIDATION_WINDOW status between 4:55 PM and 4:59 PM EST', () => {
    // Tuesday Nov 3, 2026, 4:56 PM EST
    const now = fromZonedTime('2026-11-03 16:56:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('LIQUIDATION_WINDOW');
    expect(info.isInsideLiquidationWindow).toBe(true);
    expect(info.isHalted).toBe(false);
    expect(info.statusColorHex).toBe('#ED4245');
    expect(info.warnings.some((w) => w.includes('AUTO-LIQUIDATION IN EFFECT'))).toBe(true);
  });

  it('detects DAILY_HALT during 5:00 PM to 6:00 PM EST maintenance window', () => {
    // Wednesday Nov 4, 2026, 5:15 PM EST
    const now = fromZonedTime('2026-11-04 17:15:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('DAILY_HALT');
    expect(info.isHalted).toBe(true);
    expect(info.statusColorHex).toBe('#FEE75C');

    // Reopen time must be today at 18:00 EST
    const reopenEst = formatInTimeZone(info.nextReopenTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(reopenEst).toBe('2026-11-04 18:00');

    // Next halt must be tomorrow Thursday at 16:59 EST
    const nextHaltEst = formatInTimeZone(info.nextHaltTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(nextHaltEst).toBe('2026-11-05 16:59');
  });

  it('detects evening session after 6:00 PM EST', () => {
    // Monday Nov 2, 2026, 7:30 PM EST
    const now = fromZonedTime('2026-11-02 19:30:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('OPEN');
    expect(info.isHalted).toBe(false);

    // Next halt is Tuesday 16:59 EST
    const nextHaltEst = formatInTimeZone(info.nextHaltTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(nextHaltEst).toBe('2026-11-03 16:59');
  });

  it('handles Friday market close for the weekend', () => {
    // Friday Nov 6, 2026, 5:30 PM EST
    const now = fromZonedTime('2026-11-06 17:30:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('WEEKEND_HALT');
    expect(info.isHalted).toBe(true);
    expect(info.isWeekend).toBe(true);

    // Reopen must be Sunday Nov 8, 2026, 18:00 EST
    const reopenEst = formatInTimeZone(info.nextReopenTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(reopenEst).toBe('2026-11-08 18:00');
  });

  it('handles Saturday weekend closure', () => {
    // Saturday Nov 7, 2026, 12:00 PM EST
    const now = fromZonedTime('2026-11-07 12:00:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('WEEKEND_HALT');
    expect(info.isHalted).toBe(true);
    expect(info.isWeekend).toBe(true);

    // Reopen is Sunday Nov 8, 2026, 18:00 EST
    const reopenEst = formatInTimeZone(info.nextReopenTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(reopenEst).toBe('2026-11-08 18:00');
  });

  it('handles Sunday afternoon before market opens', () => {
    // Sunday Nov 8, 2026, 2:00 PM EST
    const now = fromZonedTime('2026-11-08 14:00:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('WEEKEND_HALT');
    expect(info.isHalted).toBe(true);

    // Reopen is Sunday Nov 8, 2026, 18:00 EST (today in 4 hours)
    const reopenEst = formatInTimeZone(info.nextReopenTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(reopenEst).toBe('2026-11-08 18:00');
  });

  it('handles Sunday evening after market open', () => {
    // Sunday Nov 8, 2026, 7:00 PM EST
    const now = fromZonedTime('2026-11-08 19:00:00', TIMEZONES.EASTERN);
    const info = getCmeSessionInfo(now);

    expect(info.status).toBe('OPEN');
    expect(info.isHalted).toBe(false);

    // Next halt is Monday Nov 9, 2026, 16:59 EST
    const nextHaltEst = formatInTimeZone(info.nextHaltTime, TIMEZONES.EASTERN, 'yyyy-MM-dd HH:mm');
    expect(nextHaltEst).toBe('2026-11-09 16:59');
  });
});
