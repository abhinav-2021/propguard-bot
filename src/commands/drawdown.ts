import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { calculateDrawdown, DrawdownModel } from '../services/drawdownCalculator';
import { getFirmPreset } from '../config/firmRules';
import { buildDrawdownEmbed, buildErrorEmbed } from '../utils/embedBuilder';

export const drawdownCommand = {
  data: new SlashCommandBuilder()
    .setName('drawdown')
    .setDescription('Calculate exact prop firm drawdown thresholds, liquidation floors, and buffers')
    .addNumberOption((option) =>
      option
        .setName('account_size')
        .setDescription('Starting account size (e.g. 50000, 100000, 150000)')
        .setRequired(true)
        .setMinValue(1)
    )
    .addNumberOption((option) =>
      option
        .setName('max_loss')
        .setDescription('Maximum allowed trailing drawdown (e.g. 2000, 2500, 3000)')
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('Drawdown calculation model (INTRADAY high-water mark vs EOD closed session)')
        .setRequired(true)
        .addChoices(
          { name: 'INTRADAY (Live Tick-by-Tick High-Water Mark)', value: 'INTRADAY' },
          { name: 'EOD (End of Day Settled Session Balance)', value: 'EOD' }
        )
    )
    .addNumberOption((option) =>
      option
        .setName('peak_value')
        .setDescription('Highest peak equity reached (live open equity for Intraday, settled balance for EOD)')
        .setRequired(true)
    )
    .addNumberOption((option) =>
      option
        .setName('current_equity')
        .setDescription('Live current net liquidation value or account balance')
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('is_funded')
        .setDescription('Is this account in the Funded / PA / Live phase? (Default: false)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('firm')
        .setDescription('Prop firm preset for tailored rules & context (optional)')
        .setRequired(false)
        .addChoices(
          { name: 'Tradeify (EOD Growth / Lightning Intraday)', value: 'tradeify' },
          { name: 'Lucid Trading', value: 'lucid' },
          { name: 'Apex Trader Funding', value: 'apex' },
          { name: 'Bulenox', value: 'bulenox' },
          { name: 'Generic Futures Prop Firm', value: 'generic' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const accountSize = interaction.options.getNumber('account_size', true);
      const maxLoss = interaction.options.getNumber('max_loss', true);
      const model = interaction.options.getString('model', true) as DrawdownModel;
      const peakValue = interaction.options.getNumber('peak_value', true);
      const currentEquity = interaction.options.getNumber('current_equity', true);
      const isFunded = interaction.options.getBoolean('is_funded') ?? false;
      const firmKey = interaction.options.getString('firm') ?? undefined;

      const firmPreset = getFirmPreset(firmKey);

      const breakdown = calculateDrawdown({
        accountSize,
        maxLoss,
        model,
        peakValue,
        currentEquity,
        isFunded,
      });

      const embed = buildDrawdownEmbed(breakdown, firmPreset);
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

