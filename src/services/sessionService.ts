import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

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
} as const;

/**
 * Returns formatted date string in Eastern Time for creating zoned Date instances: "YYYY-MM-DD"
 */
function getNyDateString(date: Date): string {
  return formatInTimeZone(date, TIMEZONES.EASTERN, 'yyyy-MM-dd');
}

/**
 * Helper to add days to a YYYY-MM-DD date string in NY time zone.
 */
function addDaysToNyDateString(nyDateStr: string, days: number): string {
  const [y, m, d] = nyDateStr.split('-').map(Number);
  const temp = new Date(Date.UTC(y!, m! - 1, d! + days, 12, 0, 0));
  return temp.toISOString().slice(0, 10);
}

/**
 * Creates a UTC Date representing a specific Eastern Time (HH:mm:ss) on a specific date.
 */
function createEasternDate(nyDateStr: string, timeStr: string): Date {
  return fromZonedTime(`${nyDateStr} ${timeStr}`, TIMEZONES.EASTERN);
}

/**
 * Analyzes the CME market session status and calculates upcoming halt and auto-liquidation countdowns.
 * CME Equity Index Futures (ES, NQ, YM, RTY) trade Sunday 6:00 PM EST to Friday 5:00 PM EST,
 * with daily maintenance halts Monday through Thursday 4:59 PM to 6:00 PM EST (4:00 PM to 5:00 PM CT).
 */
export function getCmeSessionInfo(now: Date = new Date()): CmeSessionInfo {
  const currentNyDateStr = getNyDateString(now);

  // Extract day-of-week and time components in Eastern timezone
  const dayOfWeekStr = formatInTimeZone(now, TIMEZONES.EASTERN, 'i'); // 1 (Mon) to 7 (Sun)
  const dayOfWeek = parseInt(dayOfWeekStr, 10); // 1 = Mon, 2 = Tue, ..., 5 = Fri, 6 = Sat, 7 = Sun
  const currentTimeEstStr = formatInTimeZone(now, TIMEZONES.EASTERN, 'HH:mm:ss');
  const [hour, minute, second] = currentTimeEstStr.split(':').map(Number);
  const currentTotalSeconds = (hour ?? 0) * 3600 + (minute ?? 0) * 60 + (second ?? 0);

  const SECONDS_4_55_PM = 16 * 3600 + 55 * 60; // 60,900 (4:55 PM)
  const SECONDS_4_59_PM = 16 * 3600 + 59 * 60; // 61,140 (4:59 PM)
  const SECONDS_6_00_PM = 18 * 3600; // 64,800 (6:00 PM)

  let status: MarketSessionStatus = 'OPEN';
  let isHalted = false;
  let isWeekend = false;
  let isInsideLiquidationWindow = false;

  let nextHaltTime: Date;
  let nextAutoLiquidationTime: Date;
  let nextReopenTime: Date;

  const warnings: string[] = [];

  // Determine market status and calculate milestone dates
  if (dayOfWeek === 7) {
    // SUNDAY
    if (currentTotalSeconds < SECONDS_6_00_PM) {
      // Weekend Halt active until Sunday 6:00 PM EST
      status = 'WEEKEND_HALT';
      isHalted = true;
      isWeekend = true;

      nextReopenTime = createEasternDate(currentNyDateStr, '18:00:00');
      // Next halt after reopening is Monday 4:59 PM EST
      const monStr = addDaysToNyDateString(currentNyDateStr, 1);
      nextAutoLiquidationTime = createEasternDate(monStr, '16:55:00');
      nextHaltTime = createEasternDate(monStr, '16:59:00');
    } else {
      // Sunday after 6:00 PM EST -> Market is OPEN
      status = 'OPEN';
      const monStr = addDaysToNyDateString(currentNyDateStr, 1);
      nextAutoLiquidationTime = createEasternDate(monStr, '16:55:00');
      nextHaltTime = createEasternDate(monStr, '16:59:00');
      nextReopenTime = createEasternDate(monStr, '18:00:00');
    }
  } else if (dayOfWeek === 6) {
    // SATURDAY (Closed all day)
    status = 'WEEKEND_HALT';
    isHalted = true;
    isWeekend = true;

    // Reopens Sunday 6:00 PM EST (tomorrow)
    const sunStr = addDaysToNyDateString(currentNyDateStr, 1);
    const monStr = addDaysToNyDateString(currentNyDateStr, 2);
    nextReopenTime = createEasternDate(sunStr, '18:00:00');
    nextAutoLiquidationTime = createEasternDate(monStr, '16:55:00');
    nextHaltTime = createEasternDate(monStr, '16:59:00');
  } else if (dayOfWeek === 5) {
    // FRIDAY
    if (currentTotalSeconds < SECONDS_4_55_PM) {
      status = 'OPEN';
      nextAutoLiquidationTime = createEasternDate(currentNyDateStr, '16:55:00');
      nextHaltTime = createEasternDate(currentNyDateStr, '16:59:00');
      const sunStr = addDaysToNyDateString(currentNyDateStr, 2);
      nextReopenTime = createEasternDate(sunStr, '18:00:00');
    } else if (currentTotalSeconds < SECONDS_4_59_PM) {
      // Friday 4:55 PM - 4:59 PM: LIQUIDATION WINDOW
      status = 'LIQUIDATION_WINDOW';
      isInsideLiquidationWindow = true;
      nextAutoLiquidationTime = createEasternDate(currentNyDateStr, '16:55:00');
      nextHaltTime = createEasternDate(currentNyDateStr, '16:59:00');
      const sunStr = addDaysToNyDateString(currentNyDateStr, 2);
      nextReopenTime = createEasternDate(sunStr, '18:00:00');
    } else {
      // Friday after 4:59 PM: WEEKEND HALT
      status = 'WEEKEND_HALT';
      isHalted = true;
      isWeekend = true;
      const sunStr = addDaysToNyDateString(currentNyDateStr, 2);
      const monStr = addDaysToNyDateString(currentNyDateStr, 3);
      nextReopenTime = createEasternDate(sunStr, '18:00:00');
      nextAutoLiquidationTime = createEasternDate(monStr, '16:55:00');
      nextHaltTime = createEasternDate(monStr, '16:59:00');
    }
  } else {
    // MONDAY THROUGH THURSDAY (dayOfWeek 1..4)
    if (currentTotalSeconds < SECONDS_4_55_PM) {
      status = 'OPEN';
      nextAutoLiquidationTime = createEasternDate(currentNyDateStr, '16:55:00');
      nextHaltTime = createEasternDate(currentNyDateStr, '16:59:00');
      nextReopenTime = createEasternDate(currentNyDateStr, '18:00:00');
    } else if (currentTotalSeconds < SECONDS_4_59_PM) {
      status = 'LIQUIDATION_WINDOW';
      isInsideLiquidationWindow = true;
      nextAutoLiquidationTime = createEasternDate(currentNyDateStr, '16:55:00');
      nextHaltTime = createEasternDate(currentNyDateStr, '16:59:00');
      nextReopenTime = createEasternDate(currentNyDateStr, '18:00:00');
    } else if (currentTotalSeconds < SECONDS_6_00_PM) {
      // Daily maintenance halt in progress (4:59 PM - 6:00 PM EST)
      status = 'DAILY_HALT';
      isHalted = true;
      nextReopenTime = createEasternDate(currentNyDateStr, '18:00:00');
      // Next halt is tomorrow's halt
      const nextDayStr = addDaysToNyDateString(currentNyDateStr, 1);
      nextAutoLiquidationTime = createEasternDate(nextDayStr, '16:55:00');
      nextHaltTime = createEasternDate(nextDayStr, '16:59:00');
    } else {
      // Evening session active (6:00 PM - 11:59 PM EST)
      status = 'OPEN';
      const nextDayStr = addDaysToNyDateString(currentNyDateStr, 1);
      nextAutoLiquidationTime = createEasternDate(nextDayStr, '16:55:00');
      nextHaltTime = createEasternDate(nextDayStr, '16:59:00');
      // If today is Thursday evening, tomorrow is Friday evening which closes for the weekend!
      if (dayOfWeek === 4) {
        // Thursday evening: next halt is Friday 4:59 PM, next reopen is Sunday 6:00 PM
        const sunStr = addDaysToNyDateString(currentNyDateStr, 3);
        nextReopenTime = createEasternDate(sunStr, '18:00:00');
      } else {
        nextReopenTime = createEasternDate(nextDayStr, '18:00:00');
      }
    }
  }

  // Calculate Unix timestamps (in whole seconds)
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
        '⚠️ **BROKER AUTO-LIQUIDATION IN EFFECT:** Prop firms require all intraday positions to be flat between 4:55 PM and 4:58 PM EST. Failure to close contracts will trigger forced market liquidation and account violation penalties!'
      );
      break;
    case 'DAILY_HALT':
      statusLabel = '⏸️ CME DAILY MAINTENANCE HALT (5:00 PM – 6:00 PM EST)';
      statusColorHex = '#FEE75C';
      statusColorNum = 0xfee75c;
      warnings.push(
        '⏸️ Trading is currently halted across CME Equity Index Futures (ES, NQ, YM, RTY). No orders or cancellations can be matched until the 6:00 PM EST reopen.'
      );
      break;
    case 'WEEKEND_HALT':
      statusLabel = '🛑 CME WEEKEND CLOSE';
      statusColorHex = '#5865F2';
      statusColorNum = 0x5865f2;
      warnings.push(
        '🛑 The futures market is closed for the weekend. Electronic trading reopens Sunday at 6:00 PM US Eastern (5:00 PM Chicago CT).'
      );
      break;
  }

  // General warning regarding the 4:55 PM - 4:58 PM EST broker-side auto-close rule
  if (status === 'OPEN') {
    if (secondsUntilLiquidation <= 3600 && secondsUntilLiquidation > 0) {
      warnings.push(
        `⚠️ **Approaching Session Cutoff:** Less than 1 hour remaining until mandatory position flattening (4:55 PM EST). Ensure all open trades are closed to avoid auto-liquidation.`
      );
    } else {
      warnings.push(
        '📌 **Mandatory Rule:** All intraday evaluation contracts must be closed before the 4:55 PM – 4:58 PM EST broker auto-liquidation deadline to avoid automatic closure fees.'
      );
    }
  }

  return {
    status,
    statusLabel,
    statusColorHex,
    statusColorNum,
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
