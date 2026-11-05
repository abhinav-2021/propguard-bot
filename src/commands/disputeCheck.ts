import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { getTenantConfig } from '../config/tenants';
import {
  buildDisputeCheckEmbed,
  buildErrorEmbed,
  DisputeScenario,
} from '../utils/embedBuilder';

export const disputeCheckCommand = {
  data: new SlashCommandBuilder()
    .setName('dispute-check')
    .setDescription('Instant explanation guide for common support questions and rule disputes')
    .addStringOption((option) =>
      option
        .setName('scenario')
        .setDescription('Select the scenario or issue you want to inspect')
        .setRequired(true)
        .addChoices(
          {
            name: 'Closed Green Blowup (High-Water Mark Trailing)',
            value: 'green_blowup',
          },
          {
            name: 'CME 5 PM Halt Auto-Liquidation (Over-holding Rule)',
            value: 'cme_halt',
          },
          {
            name: 'Daily Loss Limit vs Trailing Drawdown (Soft vs Hard Breach)',
            value: 'daily_vs_trailing',
          }
        )
    )
    .addStringOption((option) =>
      option
        .setName('firm')
        .setDescription('Override tenant firm branding (defaults to current server configuration)')
        .setRequired(false)
        .addChoices(
          { name: 'Tradeify', value: 'tradeify' },
          { name: 'Lucid Trading', value: 'lucid' },
          { name: 'Apex Trader Funding', value: 'apex' },
          { name: 'Bulenox', value: 'bulenox' },
          { name: 'Generic Futures Prop Firm', value: 'generic' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const firmKey = interaction.options.getString('firm') ?? undefined;
    const tenant = getTenantConfig(interaction.guildId, firmKey);

    try {
      const scenario = interaction.options.getString('scenario', true) as DisputeScenario;
      const embed = buildDisputeCheckEmbed(scenario, tenant);

      // Sent as ephemeral so user gets instant personal clarity without spamming channel
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const errorEmbed = buildErrorEmbed(errorMessage, tenant);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};
