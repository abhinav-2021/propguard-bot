import { EmbedBuilder } from 'discord.js';
import { DrawdownBreakdown, formatCurrency } from '../services/drawdownCalculator';
import { CmeSessionInfo } from '../services/sessionService';
import { TenantConfig, AccountTier, getTenantConfig } from '../config/tenants';

export type DisputeScenario = 'green_blowup' | 'cme_halt' | 'daily_vs_trailing';

/**
 * Builds the rich Embed for the /drawdown calculation engine with whitelabel branding.
 */
export function buildDrawdownEmbed(
  breakdown: DrawdownBreakdown,
  tenantConfig?: TenantConfig,
  selectedTier?: AccountTier
): EmbedBuilder {
  const tenant = tenantConfig || getTenantConfig();

  // For Healthy state, use tenant brand color if desired, or stateColor for safety clarity
  const color = breakdown.state === 'HEALTHY' ? tenant.brandColor : breakdown.stateColorNumber;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🛡️ ${tenant.firmName} Drawdown Verification | ${breakdown.state}`)
    .setDescription(
      `**Firm:** \`${tenant.firmName}\` • **Model:** \`${breakdown.modelDescription.split(':')[0]}\` ${
        breakdown.isFunded ? '• **[FUNDED / PA ACCOUNT]**' : '• **[EVALUATION PHASE]**'
      }\n${selectedTier ? `**Account Tier:** \`${selectedTier.name}\`\n` : ''}\n${breakdown.explanation}`
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
      }
    );

  if (selectedTier?.dailyLossLimit) {
    embed.addFields({
      name: '⚠️ Daily Loss Limit',
      value: `\`${formatCurrency(selectedTier.dailyLossLimit)}\` (Soft Lock)`,
      inline: true,
    });
  }

  embed.addFields({
    name: '📐 Mathematical Breakdown',
    value: `\`\`\`text\n${breakdown.mathFormula}\nBuffer = Current Equity (${formatCurrency(
      breakdown.currentEquity
    )}) - Floor (${formatCurrency(breakdown.floor)}) = ${formatCurrency(
      breakdown.buffer
    )}\n\`\`\``,
    inline: false,
  });

  if (tenant.supportTicketUrl) {
    embed.addFields({
      name: '🎫 Need Assistance?',
      value: `Still have questions about your account? [Open a ${tenant.firmName} Support Ticket](${tenant.supportTicketUrl})`,
      inline: false,
    });
  }

  if (tenant.logoUrl) {
    embed.setThumbnail(tenant.logoUrl);
  }

  embed.setFooter({ text: `${tenant.firmName} Risk Engine • Powered by PropGuard` }).setTimestamp();

  return embed;
}

/**
 * Builds the rich Embed for the /cutoff CME market halt timer with whitelabel branding.
 */
export function buildCutoffEmbed(info: CmeSessionInfo, tenantConfig?: TenantConfig): EmbedBuilder {
  const tenant = tenantConfig || getTenantConfig();

  const embed = new EmbedBuilder()
    .setColor(tenant.brandColor)
    .setTitle(`⏱️ ${tenant.firmName} CME Futures Session & Cutoff Monitor`)
    .setDescription(
      `**Market Status:** **${info.statusLabel}**\n` +
        `**Current Market Time:** ${info.currentEasternTime} (${info.currentChicagoTime})\n` +
        `**UTC Time:** \`${info.currentUtcTime}\`\n` +
        `**Firm Policy:** \`${tenant.firmName}\` (Mandatory flatten **${tenant.cutoffOffsetMinutes} min** prior to 17:00 ET halt)\n`
    )
    .addFields(
      {
        name: '🛑 Next CME Session Halt / Close',
        value: `**Target Event:** \`16:59 EST / 21:59 UTC\`\n**Your Local Time:** ${info.discordTimestamps.haltFull}\n**Countdown:** ${info.discordTimestamps.haltRelative}`,
        inline: true,
      },
      {
        name: `🚨 ${tenant.firmName} Auto-Liquidation Cutoff`,
        value: `**Mandatory Flatten:** \`${tenant.cutoffOffsetMinutes}m before halt\`\n**Your Local Time:** ${info.discordTimestamps.liquidationFull}\n**Deadline:** ${info.discordTimestamps.liquidationRelative}`,
        inline: true,
      },
      {
        name: '🔄 Next Market Reopen',
        value: `**Target Event:** \`18:00 EST / 23:00 UTC\`\n**Your Local Time:** ${info.discordTimestamps.reopenFull}\n**Reopens:** ${info.discordTimestamps.reopenRelative}`,
        inline: false,
      }
    );

  if (info.warnings.length > 0) {
    embed.addFields({
      name: `⚠️ Crucial ${tenant.firmName} Policy Notice`,
      value: info.warnings.join('\n\n'),
      inline: false,
    });
  }

  if (tenant.supportTicketUrl) {
    embed.addFields({
      name: '🎫 Support Link',
      value: `Questions about daily cutoffs? [Open a ${tenant.firmName} Support Ticket](${tenant.supportTicketUrl})`,
      inline: false,
    });
  }

  if (tenant.logoUrl) {
    embed.setThumbnail(tenant.logoUrl);
  }

  embed.setFooter({ text: `${tenant.firmName} • Chicago Mercantile Exchange (CME) Feed` }).setTimestamp();

  return embed;
}

/**
 * Builds the rich Embed for the /dispute-check pre-ticket deflector with whitelabel branding.
 */
export function buildDisputeCheckEmbed(
  scenario: DisputeScenario,
  tenantConfig?: TenantConfig
): EmbedBuilder {
  const tenant = tenantConfig || getTenantConfig();

  const embed = new EmbedBuilder()
    .setFooter({ text: `${tenant.firmName} Support Deflector • Powered by PropGuard` })
    .setTimestamp();

  if (tenant.logoUrl) {
    embed.setThumbnail(tenant.logoUrl);
  }

  switch (scenario) {
    case 'green_blowup':
      embed
        .setColor(tenant.brandColor || 0xed4245)
        .setTitle(`🔍 ${tenant.firmName}: Why Did My Account Fail When My Trade Closed Green?`)
        .setDescription(
          `**Root Cause:** **Intraday Peak Unrealized Equity (High-Water Mark) Trailing**\n\n` +
            `A common dispute in futures prop trading occurs when a trader closes a trade in positive profit, yet receives an account failure notice.`
        )
        .addFields(
          {
            name: '1️⃣ The Dynamic High-Water Mark Mechanism',
            value:
              `Under **${tenant.firmName}** intraday trailing rules, the platform monitors your account **tick-by-tick in real-time**.\n` +
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
            name: '3️⃣ Rule Citation & Prevention',
            value:
              '> *"The trailing maximum drawdown calculates from the highest unrealized profit point achieved during any open trade. The floor does not move down when unrealized profit is given back."*\n\n' +
              '💡 **Best Practice:** Always trail stop-loss orders to protect accrued equity before a retracement touches your trailed threshold.',
            inline: false,
          }
        );
      break;

    case 'cme_halt':
      embed
        .setColor(tenant.brandColor || 0xfee75c)
        .setTitle(`🔍 ${tenant.firmName}: Why Was My Position Auto-Closed Before 5:00 PM EST?`)
        .setDescription(
          `**Root Cause:** **Broker-Side Pre-Halt Auto-Liquidation Window (${tenant.cutoffOffsetMinutes} min before 17:00 ET)**\n\n` +
            `Traders often open tickets asking why their open trades were suddenly closed at market price just minutes before the daily CME maintenance halt.`
        )
        .addFields(
          {
            name: '1️⃣ CME Daily Maintenance Schedule',
            value:
              'The Chicago Mercantile Exchange (CME) halts electronic equity index futures (ES, NQ, YM, RTY) every Monday through Thursday between **4:59 PM and 6:00 PM US Eastern** (21:59 – 23:00 UTC), and closes on Friday at 4:59 PM EST for the weekend.',
            inline: false,
          },
          {
            name: `2️⃣ ${tenant.firmName} Position Flattening Policy`,
            value:
              `**${tenant.firmName}** strictly prohibits holding intraday evaluation or funded accounts through the daily halt to prevent overnight margin shortfalls and gap risk.\n` +
              `All open positions must be closed **at least ${tenant.cutoffOffsetMinutes} minutes before** the 17:00 ET halt.`,
            inline: false,
          },
          {
            name: '3️⃣ Automated Platform Liquidation Routine',
            value:
              `If positions remain open at the cutoff deadline, the clearing platform risk servers automatically flatten contracts via market orders and cancel all pending orders.`,
            inline: false,
          }
        );
      break;

    case 'daily_vs_trailing':
      embed
        .setColor(tenant.brandColor || 0x5865f2)
        .setTitle(`🔍 ${tenant.firmName}: Soft Breach vs. Hard Breach (Daily Loss vs. Trailing DD)`)
        .setDescription(
          `**Root Cause:** **Confusion Between Daily Loss Limit (Soft Lock) and Total Trailing Drawdown (Hard Account Failure)**`
        )
        .addFields(
          {
            name: '🛡️ Daily Loss Limit (Soft Breach / Lockout)',
            value:
              '• **Scope:** Calculated strictly within a single CME trading session.\n' +
              '• **Action on Breach:** The platform automatically locks your account from opening new positions for the rest of the day.\n' +
              '• **Account Fate:** **Active!** Your account is NOT blown. You can trade again as soon as the next session opens at 6:00 PM EST.',
            inline: false,
          },
          {
            name: '💥 Trailing Drawdown (Hard Breach)',
            value:
              '• **Scope:** Calculated cumulatively from the all-time peak equity / high-water mark.\n' +
              '• **Action on Breach:** Immediate liquidation and contract termination.\n' +
              '• **Account Fate:** **Terminated.** The account has breached the maximum loss rule and must be reset.',
            inline: false,
          }
        );
      break;
  }

  if (tenant.supportTicketUrl) {
    embed.addFields({
      name: `🎫 Still have doubts?`,
      value: `Reach out directly to the **${tenant.firmName}** team: [Submit a Support Ticket](${tenant.supportTicketUrl})`,
      inline: false,
    });
  }

  return embed;
}

/**
 * Builds the automated 16:45 ET daily alert embed for scheduled announcement broadcasts.
 */
export function buildCutoffAlertEmbed(
  tenantConfig?: TenantConfig,
  targetLiquidationTime?: Date,
  targetHaltTime?: Date
): EmbedBuilder {
  const tenant = tenantConfig || getTenantConfig();

  // If target times are not provided, compute them for today (10 mins and 14 mins from alert)
  const now = new Date();
  const liqTime = targetLiquidationTime || new Date(now.getTime() + 10 * 60 * 1000);
  const haltTime = targetHaltTime || new Date(now.getTime() + 14 * 60 * 1000);

  const liqUnix = Math.floor(liqTime.getTime() / 1000);
  const haltUnix = Math.floor(haltTime.getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor(0xed4245) // Red alert border
    .setTitle(`🚨 MANDATORY POSITION FLATTENING ALERT | 10 MINUTES REMAINING`)
    .setDescription(
      `⚠️ **ATTENTION ALL ${tenant.firmName.toUpperCase()} TRADERS:**\n` +
        `The broker-side auto-liquidation cutoff window begins in exactly **10 minutes** at **16:55 US Eastern** (21:55 UTC).\n\n` +
        `To protect your accounts against forced market liquidations, slippage, and rule breach fees, **all intraday contracts and working orders must be completely flattened now**.`
    )
    .addFields(
      {
        name: `🚨 ${tenant.firmName} Auto-Liquidation Cutoff (16:55 ET)`,
        value: `**Cutoff Deadline:** <t:${liqUnix}:F>\n**Time Remaining:** <t:${liqUnix}:R>`,
        inline: true,
      },
      {
        name: '🛑 CME Maintenance Halt (16:59 ET)',
        value: `**Halt Begins:** <t:${haltUnix}:F>\n**Countdown:** <t:${haltUnix}:R>`,
        inline: true,
      },
      {
        name: '📋 Mandatory Trader Checklist',
        value:
          '1️⃣ **Flatten Positions:** Close all open contracts manually before broker auto-close.\n' +
          '2️⃣ **Cancel Orders:** Verify all resting Limit and Stop orders are cancelled.\n' +
          '3️⃣ **Verify Zero Position:** Check your trader dashboard / Rithmic / Tradovate to confirm 0 net contracts.',
        inline: false,
      },
      {
        name: '⚠️ Over-Holding Penalty Warning',
        value:
          `Positions remaining open at 16:55 ET are subject to immediate broker-side market liquidation. ` +
          `Clearing platform auto-liquidation fees ($50–$100) and rule failure penalties may apply.`,
        inline: false,
      }
    );

  if (tenant.supportTicketUrl) {
    embed.addFields({
      name: '🎫 Support Desk',
      value: `Facing trade execution issues? [Contact ${tenant.firmName} Support Immediately](${tenant.supportTicketUrl})`,
      inline: false,
    });
  }

  if (tenant.logoUrl) {
    embed.setThumbnail(tenant.logoUrl);
  }

  embed
    .setFooter({
      text: `${tenant.firmName} Risk & Trade Desk • Automated Broadcast`,
    })
    .setTimestamp();

  return embed;
}

/**
 * Builds a standardized error embed for command error responses.
 */
export function buildErrorEmbed(message: string, tenantConfig?: TenantConfig): EmbedBuilder {
  const tenant = tenantConfig || getTenantConfig();
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle(`⚠️ ${tenant.firmName} Risk Verification Error`)
    .setDescription(message)
    .setFooter({ text: `${tenant.firmName} • Whitelabeled by PropGuard` })
    .setTimestamp();
}
