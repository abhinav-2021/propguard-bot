import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { getCmeSessionInfo } from '../services/sessionService';
import { getFirmPreset } from '../config/firmRules';
import { buildCutoffEmbed, buildErrorEmbed } from '../utils/embedBuilder';

export const cutoffCommand = {
  data: new SlashCommandBuilder()
    .setName('cutoff')
    .setDescription('Display live CME session status, next daily halt, and auto-liquidation deadlines')
    .addStringOption((option) =>
      option
        .setName('firm')
        .setDescription('Prop firm preset to highlight firm-specific auto-liquidation deadlines (optional)')
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
    try {
      const firmKey = interaction.options.getString('firm') ?? undefined;
      const firmPreset = getFirmPreset(firmKey);

      const sessionInfo = getCmeSessionInfo();
      const embed = buildCutoffEmbed(sessionInfo, firmPreset);

      await interaction.reply({ embeds: [embed] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const errorEmbed = buildErrorEmbed(errorMessage);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  },
};
