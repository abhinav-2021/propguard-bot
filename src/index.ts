import {
  Client,
  GatewayIntentBits,
  Interaction,
  ActivityType,
} from 'discord.js';
import { getEnvConfig } from './config/env';
import { commandMap } from './commands';
import { buildErrorEmbed } from './utils/embedBuilder';

export function createBotClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}

export async function startBot(): Promise<Client> {
  const env = getEnvConfig(true);
  const client = createBotClient();

  client.once('ready', (readyClient) => {
    console.log(`[PropGuard] Bot online! Logged in as: ${readyClient.user.tag}`);
    readyClient.user.setActivity({
      name: 'Futures Drawdown & Cutoffs | /drawdown',
      type: ActivityType.Custom,
    });
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      console.warn(`[PropGuard] Unknown command received: ${interaction.commandName}`);
      const notFoundEmbed = buildErrorEmbed(
        `Command \`/${interaction.commandName}\` was not recognized by the PropGuard dispatcher.`
      );
      await interaction.reply({ embeds: [notFoundEmbed], ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[PropGuard] Error executing command ${interaction.commandName}:`, error);
      const errorEmbed = buildErrorEmbed(
        'An unexpected error occurred while executing this command. Please contact server administration.'
      );
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  });

  // Handle termination signals
  const cleanup = () => {
    console.log('[PropGuard] Shutting down bot gracefully...');
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  await client.login(env.DISCORD_TOKEN);
  return client;
}

// Direct execution entrypoint
if (require.main === module) {
  startBot().catch((err) => {
    console.error('[PropGuard Fatal Startup Error]:', err);
    process.exit(1);
  });
}
