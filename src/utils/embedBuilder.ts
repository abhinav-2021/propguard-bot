import { EmbedBuilder } from 'discord.js';
import { DrawdownBreakdown, formatCurrency } from '../services/drawdownCalculator';
import { CmeSessionInfo } from '../services/sessionService';
import { FirmRulePreset } from '../config/firmRules';

export type DisputeScenario = 'green_blowup' | 'cme_halt' | 'daily_vs_trailing';

const BOT_NAME = 'PropGuard';
const BOT_FOOTER = 'PropGuard • Institutional Risk & Support Engine';

/**
 * Builds the rich Embed for the /drawdown calculation engine.
 */
export function buildDrawdownEmbed(
  breakdown: DrawdownBreakdown,
  firmPreset?: FirmRulePreset
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(breakdown.stateColorNumber)
    .setTitle(`🛡️ Drawdown Verification | ${breakdown.state}`)
    .setDescription(
      `**Model:** \`${breakdown.modelDescription.split(':')[0]}\` ${
        breakdown.isFunded ? '• **[FUNDED / PA ACCOUNT]**' : '• **[EVALUATION PHASE]**'
      }\n${firmPreset ? `**Firm Preset:** \`${firmPreset.name}\`\n` : ''}\n${breakdown.explanation}`
    )
    .addFields(
      {
        name: '💼 Initial Capital',
        value: `\`${formatCurrency(breakdown.initialCapital)}\``,
        inline: true,
      },
      {
        name: '📊 Peak High-Water Mark',
        value: `\`${formatCurrency(breakdown.peakValue)}\``,
        inline: true,
      },
      {
        name: '📉 Max Allowed Drawdown',
        value: `\`${formatCurrency(breakdown.maxLoss)}\``,
        inline: true,
      },
      {
        name: '🎯 Current Live Equity',
        value: `\`${formatCurrency(breakdown.currentEquity)}\``,
        inline: true,
      },
      {
        name: breakdown.isLocked ? '🔒 Liquidation Floor (LOCKED)' : '⛔ Liquidation Floor',
        value: `\`${formatCurrency(breakdown.floor)}\``,
        inline: true,
      },
      {
        name: breakdown.buffer <= 0 ? '💥 Breach Deficit' : '🛡️ Usable Buffer Remaining',
        value: `\`${formatCurrency(breakdown.buffer)}\``,
        inline: true,
      },
      {
        name: '📐 Mathematical Breakdown',
        value: `\`\`\`text\n${breakdown.mathFormula}\nBuffer = Current Equity (${formatCurrency(
          breakdown.currentEquity
        )}) - Floor (${formatCurrency(breakdown.floor)}) = ${formatCurrency(
          breakdown.buffer
        )}\n\`\`\``,
        inline: false,
      }
    )
    .setFooter({ text: BOT_FOOTER })
    .setTimestamp();

  return embed;
}

/**
 * Builds the rich Embed for the /cutoff CME market halt timer.
 */
export function buildCutoffEmbed(info: CmeSessionInfo, firmPreset?: FirmRulePreset): EmbedBuilder {
  const cutoffTimeEst = firmPreset?.autoLiquidationCutoffTimeEst || '16:55';

  const embed = new EmbedBuilder()
    .setColor(info.statusColorNum)
    .setTitle(`⏱️ CME Futures Session & Auto-Liquidation Monitor`)
    .setDescription(
      `**Market Status:** **${info.statusLabel}**\n` +
        `**Current Market Time:** ${info.currentEasternTime} (${info.currentChicagoTime})\n` +
        `**UTC Time:** \`${info.currentUtcTime}\`\n` +
        `${firmPreset ? `**Firm Profile:** \`${firmPreset.name}\` (Cutoff: ${cutoffTimeEst} EST / 21:55 UTC)\n` : ''}`
    )
    .addFields(
      {
        name: '🛑 Next CME Session Halt / Close',
        value: `**Target Event:** \`16:59 EST / 21:59 UTC\`\n**Your Local Time:** ${info.discordTimestamps.haltFull}\n**Countdown:** ${info.discordTimestamps.haltRelative}`,
        inline: true,
      },
      {
        name: '🚨 Broker Auto-Liquidation Window',
        value: `**Cutoff Rule:** \`${cutoffTimeEst} EST / 21:55 UTC\`\n**Your Local Time:** ${info.discordTimestamps.liquidationFull}\n**Deadline:** ${info.discordTimestamps.liquidationRelative}`,
        inline: true,
      },
      {
        name: '🔄 Next Market Reopen',
        value: `**Target Event:** \`18:00 EST / 23:00 UTC\`\n**Your Local Time:** ${info.discordTimestamps.reopenFull}\n**Reopens:** ${info.discordTimestamps.reopenRelative}`,
        inline: false,
      }
    )
    .setFooter({ text: `${BOT_NAME} • Chicago Mercantile Exchange (CME) Feed` })
    .setTimestamp();

  if (info.warnings.length > 0) {
    embed.addFields({
      name: '⚠️ Crucial Prop Firm Policy Notice',
      value: info.warnings.join('\n\n'),
      inline: false,
    });
  }

  return embed;
}

/**
 * Builds the rich Embed for the /dispute-check pre-ticket deflector.
 */
export function buildDisputeCheckEmbed(
  scenario: DisputeScenario,
  firmPreset?: FirmRulePreset
): EmbedBuilder {
  const embed = new EmbedBuilder().setFooter({ text: BOT_FOOTER }).setTimestamp();

  switch (scenario) {
    case 'green_blowup':
      embed
        .setColor(0xed4245)
        .setTitle('🔍 Dispute Deflector: Why Did My Account Fail When My Trade Closed Green?')
        .setDescription(
          `**Root Cause:** **Intraday Peak Unrealized Equity (High-Water Mark) Trailing**\n\n` +
            `A common dispute in futures prop trading occurs when a trader closes a trade in positive profit, yet receives an account failure notice.`
        )
        .addFields(
          {
            name: '1️⃣ The Dynamic High-Water Mark Mechanism',
            value:
              'In Intraday Trailing models (used by Apex, Bulenox Option 1, Tradeify Lightning, etc.), the risk engine monitors your account **tick-by-tick in real-time**.\n' +
              'The moment your trade hits an open profit peak, your liquidation floor immediately ratchets upwards.',
            inline: false,
          },
          {
            name: '2️⃣ Step-by-Step Scenario Example',
            value:
              '• **Starting Balance:** `$50,000.00` with `$2,000.00` Max Loss. Starting Floor: `$48,000.00`.\n' +
              '• **Trade Entry & Spike:** You buy NQ contracts. Trade surges to **+$3,000.00** open profit.\n' +
              '• **Floor Ratchet:** Peak Equity hits `$53,000.00`. The floor automatically moves up to: `$53,000.00 - $2,000.00 = $51,000.00`.\n' +
              '• **The Reversal:** Price pulls back aggressively. You close your trade with **+$400.00** realized profit.\n' +
              '• **Account Balance:** `$50,400.00`.\n' +
              '• **Breach Event:** Your balance (`$50,400.00`) is now **BELOW** your trailed liquidation floor (`$51,000.00`). Result: **Account Terminated**.',
            inline: false,
          },
          {
            name: '3️⃣ Prop Firm Rule Citation',
            value:
              '> *"The trailing maximum drawdown calculates from the highest unrealized profit point achieved during any open trade. The floor does not move down when unrealized profit is given back."*\n\n' +
              '💡 **Best Practice:** Trail your stop-loss order behind your trade to lock in peak gains before price retraces into your trailed floor.',
            inline: false,
          }
        );
      break;

    case 'cme_halt':
      embed
        .setColor(0xfee75c)
        .setTitle('🔍 Dispute Deflector: Why Was My Position Auto-Closed Before 5:00 PM EST?')
        .setDescription(
          `**Root Cause:** **Broker-Side Pre-Halt Auto-Liquidation Window (4:55 PM – 4:58 PM EST)**\n\n` +
            `Traders often open tickets asking why their open trades were suddenly closed at market price just minutes before the daily CME maintenance halt.`
        )
        .addFields(
          {
            name: '1️⃣ CME Daily Maintenance Schedule',
            value:
              'The Chicago Mercantile Exchange (CME) halts electronic equity index futures (ES, NQ, YM, RTY) every Monday through Thursday between **4:59 PM and 6:00 PM US Eastern** (4:00 PM - 5:00 PM CT), and closes on Friday at 4:59 PM EST for the weekend.',
            inline: false,
          },
          {
            name: '2️⃣ Prop Firm Over-Holding Prohibition',
            value:
              'Prop firms strictly prohibit holding intraday evaluation or funded accounts through the daily halt to prevent overnight margin shortfalls, massive market gaps, and settlement illiquidity.',
            inline: false,
          },
          {
            name: '3️⃣ Automated Platform Liquidation (4:55 PM – 4:58 PM EST)',
            value:
              'To guarantee no contracts enter the halt, the clearing platform risk servers (Rithmic, Tradovate, ProjectX, CQG) initiate **forced liquidation routines at 4:55 PM EST**.\n' +
              '• All open contracts are immediately closed with market orders.\n' +
              '• All resting limit/stop orders are cancelled.\n' +
              '• An auto-liquidation violation or fee ($50–$100) may be assessed.',
            inline: false,
          },
          {
            name: '💡 Solution',
            value:
              'Always flatten all open positions and cancel all working pending orders manually by **4:50 PM EST (3:50 PM CT)** at the latest.',
            inline: false,
          }
        );
      break;

    case 'daily_vs_trailing':
      embed
        .setColor(0x5865f2)
        .setTitle('🔍 Dispute Deflector: Soft Breach vs. Hard Breach (Daily Loss vs. Trailing DD)')
        .setDescription(
          `**Root Cause:** **Confusion Between Daily Loss Limit (Soft Lock) and Total Trailing Drawdown (Hard Account Failure)**`
        )
        .addFields(
          {
            name: '🛡️ Daily Loss Limit (Typically Soft Breach)',
            value:
              '• **Scope:** Calculated strictly within a single CME trading day (6:00 PM EST to 4:59 PM EST the next day).\n' +
              '• **Action on Breach:** The platform automatically locks your account from opening new positions for the rest of the day.\n' +
              '• **Account Fate:** **Active!** Your account is NOT blown. You can trade again as soon as the next session opens at 6:00 PM EST.',
            inline: false,
          },
          {
            name: '💥 Trailing Drawdown (Hard Breach)',
            value:
              '• **Scope:** Calculated cumulatively from the all-time peak equity / high-water mark.\n' +
              '• **Action on Breach:** Immediate liquidation and contract termination.\n' +
              '• **Account Fate:** **Terminated.** The evaluation or funded account has failed and must be reset or repurchased.',
            inline: false,
          },
          {
            name: '⚠️ Key Warning on Firm Differences',
            value:
              firmPreset
                ? `Under **${firmPreset.name}**, Daily Loss Limit is classified as: **${firmPreset.dailyLossLimitType}**.\n${firmPreset.rulesSummary.drawdownExplanation}`
                : 'Always check your firm specific rules: Some prop firms (e.g. Apex) do not enforce a daily loss limit, while others (e.g. Lucid, Topstep, MyFundedFutures) treat certain daily loss rules strictly.',
            inline: false,
          }
        );
      break;
  }

  return embed;
}

/**
 * Builds a standardized error embed for command error responses.
 */
export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('⚠️ PropGuard Validation Error')
    .setDescription(message)
    .setFooter({ text: BOT_FOOTER })
    .setTimestamp();
}

