import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { getCmeSessionInfo } from '../services/sessionService';
import { getTenantConfig } from '../config/tenants';
import { buildCutoffEmbed, buildErrorEmbed } from '../utils/embedBuilder';

export const cutoffCommand = {
  data: new SlashCommandBuilder()
    .setName('cutoff')
    .setDescription('Display live CME session status, next daily halt, and auto-liquidation deadlines')
    .addStringOption((option) =>
      option
        .setName('firm')
        .setDescription('Override tenant firm branding (defaults to current server configuration)')
        .setRequired(false)
        .addChoices(
          { name: 'Tradeify (4:55 PM EST Cutoff)', value: 'tradeify' },
          { name: 'Lucid Trading (4:55 PM EST Cutoff)', value: 'lucid' },
          { name: 'Apex Trader Funding (4:59 PM EST Cutoff)', value: 'apex' },
          { name: 'Bulenox (4:55 PM EST Cutoff)', value: 'bulenox' },
          { name: 'Generic Futures Prop Firm', value: 'generic' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const firmKey = interaction.options.getString('firm') ?? undefined;
    const tenant = getTenantConfig(interaction.guildId, firmKey);

    try {
      const sessionInfo = getCmeSessionInfo(new Date(), tenant.cutoffOffsetMinutes);
      const embed = buildCutoffEmbed(sessionInfo, tenant);

      await interaction.reply({ embeds: [embed] });
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
