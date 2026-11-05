export interface FirmRulePreset {
  id: string;
  name: string;
  defaultDrawdownModel: 'INTRADAY' | 'EOD';
  fundedLockBuffer: number; // typically 100 ($100 above starting balance)
  autoLiquidationCutoffTimeEst: string; // e.g. "16:55"
  autoLiquidationWindowSecondsBeforeHalt: number; // seconds before 16:59
  dailyLossLimitType: 'SOFT' | 'HARD' | 'NONE';
  description: string;
  website?: string;
  rulesSummary: {
    drawdownExplanation: string;
    lockExplanation: string;
    cutoffExplanation: string;
  };
}

export const FIRM_PRESETS: Record<string, FirmRulePreset> = {
  tradeify: {
    id: 'tradeify',
    name: 'Tradeify',
    defaultDrawdownModel: 'EOD',
    fundedLockBuffer: 100,
    autoLiquidationCutoffTimeEst: '16:55',
    autoLiquidationWindowSecondsBeforeHalt: 240, // 4 mins before 4:59 PM (4:55 PM)
    dailyLossLimitType: 'SOFT',
    description: 'Specializes in End-Of-Day (EOD) trailing drawdown on Growth accounts and Lightning intraday accounts.',
    website: 'https://tradeify.co',
    rulesSummary: {
      drawdownExplanation: 'Growth accounts calculate trailing threshold solely at the 5:00 PM EST market close. Lightning accounts use intraday high-water mark.',
      lockExplanation: 'On funded accounts, trailing drawdown locks permanently once trailing threshold reaches Starting Balance + $100.',
      cutoffExplanation: 'All open positions must be flat before 4:55 PM EST (3:55 PM CT). Intraday evaluation accounts are auto-liquidated if held past cutoff.',
    },
  },
  lucid: {
    id: 'lucid',
    name: 'Lucid Trading',
    defaultDrawdownModel: 'EOD',
    fundedLockBuffer: 100,
    autoLiquidationCutoffTimeEst: '16:55',
    autoLiquidationWindowSecondsBeforeHalt: 240,
    dailyLossLimitType: 'HARD',
    description: 'Modern futures prop firm offering structured scaling with transparent EOD and intraday drawdown options.',
    website: 'https://lucidtrading.com',
    rulesSummary: {
      drawdownExplanation: 'EOD trailing updates at daily session settlement. Intraday equity dips during the day can still breach the established floor.',
      lockExplanation: 'Drawdown locks when the threshold reaches Initial Balance + $100 on funded status.',
      cutoffExplanation: 'Positions must be flattened by 4:55 PM EST. Over-holding into the CME maintenance window triggers contract auto-close.',
    },
  },
  apex: {
    id: 'apex',
    name: 'Apex Trader Funding',
    defaultDrawdownModel: 'INTRADAY',
    fundedLockBuffer: 100,
    autoLiquidationCutoffTimeEst: '16:59',
    autoLiquidationWindowSecondsBeforeHalt: 240,
    dailyLossLimitType: 'NONE',
    description: 'High-volume prop firm with real-time intraday trailing drawdown tracking peak unrealized equity tick-by-tick.',
    website: 'https://apextraderfunding.com',
    rulesSummary: {
      drawdownExplanation: 'Live tick-by-tick unrealized peak equity pulls the threshold higher in real time, even if the trade later closes with lower profit.',
      lockExplanation: 'On PA (Performance Accounts), the threshold stops trailing once it touches Initial Capital + $100.',
      cutoffExplanation: 'Positions must be closed before 4:59 PM EST. Platform liquidation kicks in if positions remain open into the CME halt.',
    },
  },
  bulenox: {
    id: 'bulenox',
    name: 'Bulenox',
    defaultDrawdownModel: 'EOD',
    fundedLockBuffer: 100,
    autoLiquidationCutoffTimeEst: '16:55',
    autoLiquidationWindowSecondsBeforeHalt: 240,
    dailyLossLimitType: 'NONE',
    description: 'Offers both Option 1 (Trailing Drawdown) and Option 2 (EOD Drawdown) plans.',
    website: 'https://bulenox.com',
    rulesSummary: {
      drawdownExplanation: 'Depends on plan chosen: Option 1 uses intraday trailing, while Option 2 calculates trailing strictly at End-of-Day settlement.',
      lockExplanation: 'Floor ceases to trail once it reaches Initial Balance + $100 on Master accounts.',
      cutoffExplanation: 'All trades must be closed at least 10 minutes prior to CME session close (by 4:50 - 4:55 PM EST).',
    },
  },
  generic: {
    id: 'generic',
    name: 'Generic Futures Prop Firm',
    defaultDrawdownModel: 'INTRADAY',
    fundedLockBuffer: 100,
    autoLiquidationCutoffTimeEst: '16:55',
    autoLiquidationWindowSecondsBeforeHalt: 240,
    dailyLossLimitType: 'SOFT',
    description: 'Standard retail futures prop firm rules conforming to industry standards.',
    rulesSummary: {
      drawdownExplanation: 'The liquidation floor trails peak equity by the specified max loss amount.',
      lockExplanation: 'On funded accounts, the liquidation threshold stops trailing at Starting Balance + $100.',
      cutoffExplanation: 'All intraday positions must be closed before the 4:59 PM - 5:00 PM EST CME daily maintenance halt.',
    },
  },
};

/**
 * Returns the firm preset by id or the default preset if not found.
 */
export function getFirmPreset(firmId?: string): FirmRulePreset {
  if (!firmId) return FIRM_PRESETS.generic!;
  const key = firmId.toLowerCase().trim();
  return FIRM_PRESETS[key] || FIRM_PRESETS.generic!;
}
