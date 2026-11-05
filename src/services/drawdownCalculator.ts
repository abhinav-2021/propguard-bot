export type DrawdownModel = 'INTRADAY' | 'EOD';

export type AccountHealthState = 'BREACHED' | 'CRITICAL' | 'HEALTHY';

export interface DrawdownCalculationInput {
  accountSize: number;
  maxLoss: number;
  model: DrawdownModel;
  peakValue: number;
  currentEquity: number;
  isFunded?: boolean;
}

export interface DrawdownBreakdown {
  initialCapital: number;
  currentEquity: number;
  peakValue: number;
  maxLoss: number;
  model: DrawdownModel;
  isFunded: boolean;
  rawFloor: number;
  floor: number;
  isLocked: boolean;
  lockThreshold: number;
  buffer: number;
  state: AccountHealthState;
  stateColorHex: string;
  stateColorNumber: number;
  explanation: string;
  mathFormula: string;
  modelDescription: string;
}

export const HEALTH_COLORS = {
  BREACHED: {
    hex: '#ED4245',
    num: 0xed4245,
    label: '🚨 BREACHED / LIQUIDATED',
  },
  CRITICAL: {
    hex: '#FEE75C',
    num: 0xfee75c,
    label: '⚠️ CRITICAL RISK (< $500 Buffer)',
  },
  HEALTHY: {
    hex: '#57F287',
    num: 0x57f287,
    label: '✅ HEALTHY',
  },
} as const;

/**
 * Formats a number into standard USD currency string ($xx,xxx.xx).
 */
export function formatCurrency(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '-' : ''}$${formatted}`;
}

/**
 * Pure calculation engine for prop firm drawdown calculations.
 * Calculates dynamic floor, lock barriers, buffer remaining, and account health state.
 */
export function calculateDrawdown(input: DrawdownCalculationInput): DrawdownBreakdown {
  const { accountSize, maxLoss, model, peakValue, currentEquity, isFunded = false } = input;

  if (accountSize <= 0) {
    throw new Error('Account size must be greater than 0.');
  }
  if (maxLoss <= 0) {
    throw new Error('Max loss must be greater than 0.');
  }

  // 1. Dynamic Floor: floor = peak_value - max_loss
  const rawFloor = peakValue - maxLoss;

  // 2. Lock Level Rule:
  // On funded accounts, the drawdown floor stops trailing once it reaches Starting Balance + $100.
  // If is_funded === true and floor >= account_size + 100, cap floor = account_size + 100 and mark is_locked = true.
  const lockThreshold = accountSize + 100;
  let floor = rawFloor;
  let isLocked = false;

  if (isFunded && rawFloor >= lockThreshold) {
    floor = lockThreshold;
    isLocked = true;
  }

  // 3. Buffer: buffer = current_equity - floor
  const buffer = currentEquity - floor;

  // 4. Breach Check:
  // If current_equity <= floor: state is BREACHED (color: #ED4245)
  // If buffer < 500: state is CRITICAL (color: #FEE75C)
  // Otherwise: state is HEALTHY (color: #57F287)
  let state: AccountHealthState;
  if (currentEquity <= floor) {
    state = 'BREACHED';
  } else if (buffer < 500) {
    state = 'CRITICAL';
  } else {
    state = 'HEALTHY';
  }

  // Build the detailed narrative explaining why the floor sits where it does
  const explanation = generateExplanation({
    model,
    peakValue,
    maxLoss,
    rawFloor,
    floor,
    isFunded,
    isLocked,
    lockThreshold,
    currentEquity,
    buffer,
    state,
  });

  const mathFormula = isLocked
    ? `Floor is locked at Starting Balance + $100: ${formatCurrency(accountSize)} + $100.00 = ${formatCurrency(floor)} (Raw trailing floor was ${formatCurrency(rawFloor)})`
    : `Floor = Peak High-Water Mark (${formatCurrency(peakValue)}) - Max Loss (${formatCurrency(maxLoss)}) = ${formatCurrency(floor)}`;

  const modelDescription =
    model === 'INTRADAY'
      ? 'Intraday (High-Water Mark): Tracks open unrealized equity tick-by-tick. Any live profit peak permanently ratchets the floor upwards until account breach or funded lock.'
      : 'End of Day (EOD): Trailing floor moves up ONLY based on closed session balance at 5:00 PM EST settlement. However, real-time live equity is evaluated against this floor during market hours.';

  const colorConfig = HEALTH_COLORS[state];

  return {
    initialCapital: accountSize,
    currentEquity,
    peakValue,
    maxLoss,
    model,
    isFunded,
    rawFloor,
    floor,
    isLocked,
    lockThreshold,
    buffer,
    state,
    stateColorHex: colorConfig.hex,
    stateColorNumber: colorConfig.num,
    explanation,
    mathFormula,
    modelDescription,
  };
}

interface ExplanationContext {
  model: DrawdownModel;
  peakValue: number;
  maxLoss: number;
  rawFloor: number;
  floor: number;
  isFunded: boolean;
  isLocked: boolean;
  lockThreshold: number;
  currentEquity: number;
  buffer: number;
  state: AccountHealthState;
}

function generateExplanation(ctx: ExplanationContext): string {
  const parts: string[] = [];

  if (ctx.isLocked) {
    parts.push(
      `🔒 **Funded Lock Barrier Active:** Because this is a Funded/PA account and the calculated floor (${formatCurrency(
        ctx.rawFloor
      )}) reached or passed the safety cap (${formatCurrency(
        ctx.lockThreshold
      )} = Initial + $100), the liquidation floor is **permanently locked at ${formatCurrency(
        ctx.floor
      )}**. Further account profits will widen your buffer rather than pulling the floor higher.`
    );
  } else if (ctx.model === 'INTRADAY') {
    parts.push(
      `📈 **Intraday High-Water Mark Trailing:** Your liquidation floor (${formatCurrency(
        ctx.floor
      )}) is tethered strictly to your highest open equity of ${formatCurrency(
        ctx.peakValue
      )} minus your maximum drawdown of ${formatCurrency(ctx.maxLoss)}.`
    );
    if (!ctx.isFunded) {
      parts.push(
        `💡 *Note: During evaluation phases, the floor trails without locking. Any new unrealized high today drags the floor up immediately.*`
      );
    }
  } else {
    parts.push(
      `📅 **End-of-Day (EOD) Settled Trailing:** Your floor (${formatCurrency(
        ctx.floor
      )}) is calculated from your highest settled EOD balance (${formatCurrency(
        ctx.peakValue
      )}) minus ${formatCurrency(
        ctx.maxLoss
      )}. It remains static throughout the current trading session and will only adjust upward at 5:00 PM EST if today's closed balance sets a new high.`
    );
  }

  // Health diagnosis
  if (ctx.state === 'BREACHED') {
    parts.push(
      `🚨 **BREACH EVENT:** Current equity (${formatCurrency(
        ctx.currentEquity
      )}) has fallen to or below the liquidation floor (${formatCurrency(
        ctx.floor
      )}). By rule, the account is subject to immediate contract liquidation and rule failure.`
    );
  } else if (ctx.state === 'CRITICAL') {
    parts.push(
      `⚠️ **HIGH RISK WARNING:** You are operating with only **${formatCurrency(
        ctx.buffer
      )}** of usable cushion before triggering liquidation. Consider reducing position sizing or flattening exposure.`
    );
  } else {
    parts.push(
      `✅ **SAFE OPERATING BUFFER:** You have **${formatCurrency(
        ctx.buffer
      )}** of usable drawdown cushion above your liquidation threshold.`
    );
  }

  return parts.join('\n\n');
}
