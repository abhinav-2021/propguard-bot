import { formatInTimeZone } from 'date-fns-tz';

export type MarketSessionStatus =
  | 'OPEN'
  | 'LIQUIDATION_WINDOW'
  | 'DAILY_HALT'
  | 'WEEKEND_HALT';

export interface CmeSessionInfo {
  status: MarketSessionStatus;
  statusLabel: string;
  statusColorHex: string;
  statusColorNum: number;
  currentUtcTime: string;
  currentEasternTime: string;
  currentChicagoTime: string;
  nextHaltTime: Date;
  nextHaltUnix: number;
  nextAutoLiquidationTime: Date;
  nextAutoLiquidationUnix: number;
  nextReopenTime: Date;
  nextReopenUnix: number;
  isInsideLiquidationWindow: boolean;
  isHalted: boolean;
  isWeekend: boolean;
  secondsUntilHalt: number;
  secondsUntilLiquidation: number;
  secondsUntilReopen: number;
  discordTimestamps: {
    haltRelative: string;
    haltFull: string;
    liquidationRelative: string;
    liquidationFull: string;
    reopenRelative: string;
    reopenFull: string;
  };
  warnings: string[];
}

export const TIMEZONES = {
  EASTERN: 'America/New_York',
  CHICAGO: 'America/Chicago',
  UTC: 'UTC',
} as const;

// Pure UTC CME schedule constants:
// 21:59 UTC = 4:59 PM EST / 17:00 ET daily maintenance pause
export const HALT_HOUR_UTC = 21;
export const HALT_MIN_UTC = 59;

// 21:55 UTC = 4:55 PM EST broker auto-liquidation deadline
export const LIQ_HOUR_UTC = 21;
export const LIQ_MIN_UTC = 55;

// 23:00 UTC = 6:00 PM EST / 18:00 ET daily reopen & Sunday weekly open
export const REOPEN_HOUR_UTC = 23;
export const REOPEN_MIN_UTC = 0;

/**
 * Finds the next occurrence of 21:59:00 UTC on a weekday (Monday–Friday).
 * Uses pure UTC timestamps to eliminate local timezone drift.
 */
export function getNextWeekdayHaltUtc(from: Date = new Date()): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();

  const candidate = new Date(Date.UTC(y, m, d, HALT_HOUR_UTC, HALT_MIN_UTC, 0, 0));
  let target = candidate;

  // If candidate is already in the past or now is >= candidate, check the next calendar day
  if (from.getTime() >= candidate.getTime()) {
    target = new Date(Date.UTC(y, m, d + 1, HALT_HOUR_UTC, HALT_MIN_UTC, 0, 0));
  }

  // Ensure target falls on a weekday (1 = Mon, 2 = Tue, ..., 5 = Fri)
  // If Saturday (6), push 2 days to Monday.
  // If Sunday (0), push 1 day to Monday.
  const day = target.getUTCDay();
  if (day === 6) {
    target.setUTCDate(target.getUTCDate() + 2);
  } else if (day === 0) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target;
}

/**
 * Finds the next occurrence of 21:55:00 UTC (4:55 PM EST) on a weekday.
 */
export function getNextWeekdayLiquidationUtc(from: Date = new Date()): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();

  const candidate = new Date(Date.UTC(y, m, d, LIQ_HOUR_UTC, LIQ_MIN_UTC, 0, 0));
  let target = candidate;

  if (from.getTime() >= candidate.getTime()) {
    target = new Date(Date.UTC(y, m, d + 1, LIQ_HOUR_UTC, LIQ_MIN_UTC, 0, 0));
  }

  const day = target.getUTCDay();
  if (day === 6) {
    target.setUTCDate(target.getUTCDate() + 2);
  } else if (day === 0) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  return target;
}

/**
 * Finds the next market reopen time in pure UTC:
 * - Monday through Thursday daily reopen at 23:00 UTC (6:00 PM EST).
 * - Weekend close (Friday 21:59 UTC to Sunday 23:00 UTC).
 */
export function getNextReopenUtc(from: Date = new Date()): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const day = from.getUTCDay();
  const totalMinutes = from.getUTCHours() * 60 + from.getUTCMinutes();
  const haltMinutes = HALT_HOUR_UTC * 60 + HALT_MIN_UTC;

  // Friday after halt (>= 21:59 UTC), Saturday (all day), or Sunday before 23:00 UTC
  // -> Market reopens Sunday at 23:00 UTC
  if (day === 5 && totalMinutes >= haltMinutes) {
    return new Date(Date.UTC(y, m, d + 2, REOPEN_HOUR_UTC, REOPEN_MIN_UTC, 0, 0));
  }
  if (day === 6) {
    return new Date(Date.UTC(y, m, d + 1, REOPEN_HOUR_UTC, REOPEN_MIN_UTC, 0, 0));
  }
  if (day === 0 && totalMinutes < REOPEN_HOUR_UTC * 60) {
    return new Date(Date.UTC(y, m, d, REOPEN_HOUR_UTC, REOPEN_MIN_UTC, 0, 0));
  }

  // Monday through Thursday during halt (21:59 to 23:00 UTC)
  if (day >= 1 && day <= 4 && totalMinutes >= haltMinutes && totalMinutes < REOPEN_HOUR_UTC * 60) {
    return new Date(Date.UTC(y, m, d, REOPEN_HOUR_UTC, REOPEN_MIN_UTC, 0, 0));
  }

  // If market is currently OPEN, next reopen is after the upcoming halt
  const nextHalt = getNextWeekdayHaltUtc(from);
  const nhY = nextHalt.getUTCFullYear();
  const nhM = nextHalt.getUTCMonth();
  const nhD = nextHalt.getUTCDate();
  const nhDay = nextHalt.getUTCDay();

  // If next halt is Friday, reopen is Sunday (+2 days)
  if (nhDay === 5) {
    return new Date(Date.UTC(nhY, nhM, nhD + 2, REOPEN_HOUR_UTC, REOPEN_MIN_UTC, 0, 0));
  }
  return new Date(Date.UTC(nhY, nhM, nhD, REOPEN_HOUR_UTC, REOPEN_MIN_UTC, 0, 0));
}

/**
 * Analyzes the CME market session status and calculates upcoming halt and auto-liquidation countdowns
 * based on pure UTC timestamps (21:59 UTC weekday pause).
 */
export function getCmeSessionInfo(now: Date = new Date()): CmeSessionInfo {
  const dayOfWeek = now.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
  const totalMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const liqMinutes = LIQ_HOUR_UTC * 60 + LIQ_MIN_UTC; // 21:55 UTC (1315 min)
  const haltMinutes = HALT_HOUR_UTC * 60 + HALT_MIN_UTC; // 21:59 UTC (1319 min)
  const reopenMinutes = REOPEN_HOUR_UTC * 60 + REOPEN_MIN_UTC; // 23:00 UTC (1380 min)

  let status: MarketSessionStatus = 'OPEN';
  let isHalted = false;
  let isWeekend = false;
  let isInsideLiquidationWindow = false;

  const warnings: string[] = [];

  // Determine current market status using pure UTC calendar
  if (dayOfWeek === 6) {
    // Saturday: Weekend Halt
    status = 'WEEKEND_HALT';
    isHalted = true;
    isWeekend = true;
  } else if (dayOfWeek === 0) {
    // Sunday
    if (totalMinutes < reopenMinutes) {
      status = 'WEEKEND_HALT';
      isHalted = true;
      isWeekend = true;
    } else {
      status = 'OPEN';
    }
  } else if (dayOfWeek === 5) {
    // Friday
    if (totalMinutes < liqMinutes) {
      status = 'OPEN';
    } else if (totalMinutes < haltMinutes) {
      status = 'LIQUIDATION_WINDOW';
      isInsideLiquidationWindow = true;
    } else {
      status = 'WEEKEND_HALT';
      isHalted = true;
      isWeekend = true;
    }
  } else {
    // Monday through Thursday
    if (totalMinutes < liqMinutes) {
      status = 'OPEN';
    } else if (totalMinutes < haltMinutes) {
      status = 'LIQUIDATION_WINDOW';
      isInsideLiquidationWindow = true;
    } else if (totalMinutes < reopenMinutes) {
      status = 'DAILY_HALT';
      isHalted = true;
    } else {
      status = 'OPEN';
    }
  }

  // Calculate target milestones using pure UTC functions
  const nextHaltTime = getNextWeekdayHaltUtc(now);
  const nextAutoLiquidationTime = getNextWeekdayLiquidationUtc(now);
  const nextReopenTime = getNextReopenUtc(now);

  const nowMs = now.getTime();
  const nextHaltUnix = Math.floor(nextHaltTime.getTime() / 1000);
  const nextAutoLiquidationUnix = Math.floor(nextAutoLiquidationTime.getTime() / 1000);
  const nextReopenUnix = Math.floor(nextReopenTime.getTime() / 1000);

  const secondsUntilHalt = Math.max(0, Math.floor((nextHaltTime.getTime() - nowMs) / 1000));
  const secondsUntilLiquidation = Math.floor((nextAutoLiquidationTime.getTime() - nowMs) / 1000);
  const secondsUntilReopen = Math.max(0, Math.floor((nextReopenTime.getTime() - nowMs) / 1000));

  // Visual status & color configuration
  let statusLabel: string;
  let statusColorHex: string;
  let statusColorNum: number;

  switch (status) {
    case 'OPEN':
      statusLabel = '🟢 MARKET OPEN';
      statusColorHex = '#57F287';
      statusColorNum = 0x57f287;
      break;
    case 'LIQUIDATION_WINDOW':
      statusLabel = '🚨 AUTO-LIQUIDATION WINDOW ACTIVE';
      statusColorHex = '#ED4245';
      statusColorNum = 0xed4245;
      warnings.push(
        '⚠️ **BROKER AUTO-LIQUIDATION IN EFFECT:** Prop firms require all intraday positions to be flat between 4:55 PM and 4:58 PM EST (21:55 – 21:58 UTC). Failure to close contracts will trigger forced market liquidation and account violation penalties!'
      );
      break;
    case 'DAILY_HALT':
      statusLabel = '⏸️ CME DAILY MAINTENANCE HALT (21:59 – 23:00 UTC / 5:00 – 6:00 PM EST)';
      statusColorHex = '#FEE75C';
      statusColorNum = 0xfee75c;
      warnings.push(
        '⏸️ Trading is currently halted across CME Equity Index Futures (ES, NQ, YM, RTY). No orders or cancellations can be matched until the 23:00 UTC (6:00 PM EST) reopen.'
      );
      break;
    case 'WEEKEND_HALT':
      statusLabel = '🛑 CME WEEKEND CLOSE';
      statusColorHex = '#5865F2';
      statusColorNum = 0x5865f2;
      warnings.push(
        '🛑 The futures market is closed for the weekend. Electronic trading reopens Sunday at 23:00 UTC (6:00 PM US Eastern / 5:00 PM Chicago CT).'
      );
      break;
  }

  // Pre-halt warning
  if (status === 'OPEN') {
    if (secondsUntilLiquidation <= 3600 && secondsUntilLiquidation > 0) {
      warnings.push(
        `⚠️ **Approaching Session Cutoff:** Less than 1 hour remaining until mandatory position flattening (21:55 UTC / 4:55 PM EST). Ensure all open trades are closed to avoid auto-liquidation.`
      );
    } else {
      warnings.push(
        '📌 **Mandatory Rule:** All intraday evaluation contracts must be closed before the 21:55 UTC (4:55 PM EST) broker auto-liquidation deadline to avoid automatic closure fees.'
      );
    }
  }

  return {
    status,
    statusLabel,
    statusColorHex,
    statusColorNum,
    currentUtcTime: formatInTimeZone(now, TIMEZONES.UTC, 'yyyy-MM-dd HH:mm:ss') + ' UTC',
    currentEasternTime: formatInTimeZone(now, TIMEZONES.EASTERN, 'EEEE, MMM d, yyyy h:mm:ss a zzz'),
    currentChicagoTime: formatInTimeZone(now, TIMEZONES.CHICAGO, 'h:mm:ss a zzz'),
    nextHaltTime,
    nextHaltUnix,
    nextAutoLiquidationTime,
    nextAutoLiquidationUnix,
    nextReopenTime,
    nextReopenUnix,
    isInsideLiquidationWindow,
    isHalted,
    isWeekend,
    secondsUntilHalt,
    secondsUntilLiquidation,
    secondsUntilReopen,
    discordTimestamps: {
      haltRelative: `<t:${nextHaltUnix}:R>`,
      haltFull: `<t:${nextHaltUnix}:F>`,
      liquidationRelative: `<t:${nextAutoLiquidationUnix}:R>`,
      liquidationFull: `<t:${nextAutoLiquidationUnix}:F>`,
      reopenRelative: `<t:${nextReopenUnix}:R>`,
      reopenFull: `<t:${nextReopenUnix}:F>`,
    },
    warnings,
  };
}
