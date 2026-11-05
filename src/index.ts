import {
  Client,
  GatewayIntentBits,
  Interaction,
  ActivityType,
} from 'discord.js';
import cron, { ScheduledTask } from 'node-cron';
import { getEnvConfig } from './config/env';
import { commandMap } from './commands';
import { getTenantConfig } from './config/tenants';
import { buildErrorEmbed, buildCutoffAlertEmbed } from './utils/embedBuilder';

export function createBotClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}

/**
 * Sends a single automated cutoff alert embed to the specified text channel.
 */
export async function sendCutoffAlert(client: Client, alertChannelId: string): Promise<boolean> {
  try {
    const channel = await client.channels.fetch(alertChannelId);
    if (!channel) {
      console.error(`[PropGuard Scheduler] Could not find channel with ID: ${alertChannelId}`);
      return false;
    }

    if (!channel.isTextBased() || !('send' in channel)) {
      console.error(`[PropGuard Scheduler] Channel ${alertChannelId} is not a text-based channel.`);
      return false;
    }

    // Determine tenant branding based on guild (defaulting to Tradeify preset)
    const guildId = 'guildId' in channel ? (channel.guildId as string) : undefined;
    const tenant = getTenantConfig(guildId, 'tradeify');

    const now = new Date();
    // 16:45 ET to 16:55 ET cutoff is exactly 10 minutes; 16:59 ET halt is 14 minutes
    const targetLiquidationTime = new Date(now.getTime() + 10 * 60 * 1000);
    const targetHaltTime = new Date(now.getTime() + 14 * 60 * 1000);

    const alertEmbed = buildCutoffAlertEmbed(tenant, targetLiquidationTime, targetHaltTime);

    await channel.send({
      content: '📢 **@here MANDATORY CUTOFF WARNING — 10 MINUTES REMAINING**',
      embeds: [alertEmbed],
    });

    console.log(`[PropGuard Scheduler] Successfully posted cutoff alert to channel ${alertChannelId}`);
    return true;
  } catch (err) {
    console.error(`[PropGuard Scheduler] Error sending cutoff alert to channel ${alertChannelId}:`, err);
    return false;
  }
}

/**
 * Initializes the node-cron scheduled background job:
 * Runs Monday through Friday at exactly 16:45 US Eastern Time (10 minutes before 16:55 ET cutoff).
 */
export function scheduleCutoffAlertJob(client: Client, alertChannelId?: string): ScheduledTask | null {
  if (!alertChannelId) {
    console.log('[PropGuard Scheduler] ALERT_CHANNEL_ID not set. Cutoff alert scheduler will remain dormant.');
    return null;
  }

  // Cron schedule: 45 16 * * 1-5 (At 16:45 on every day-of-week from Monday through Friday)
  const cronPattern = '45 16 * * 1-5';
  const timezone = 'America/New_York';

  console.log(
    `[PropGuard Scheduler] Background job scheduled: [${cronPattern}] in ${timezone} -> Target Channel: ${alertChannelId}`
  );

  const task = cron.schedule(
    cronPattern,
    async () => {
      console.log('[PropGuard Scheduler] 16:45 ET cron trigger activated! Posting daily liquidation cutoff alert...');
      await sendCutoffAlert(client, alertChannelId);
    },
    {
      timezone,
    }
  );

  return task;
}

export async function startBot(): Promise<Client> {
  const env = getEnvConfig(true);
  const client = createBotClient();
  let alertTask: ScheduledTask | null = null;

  client.once('ready', (readyClient) => {
    console.log(`[PropGuard] Bot online! Logged in as: ${readyClient.user.tag}`);
    readyClient.user.setActivity({
      name: 'Futures Drawdown & Cutoffs | /drawdown',
      type: ActivityType.Custom,
    });

    // Schedule background 16:45 ET cutoff alerts
    alertTask = scheduleCutoffAlertJob(client, env.ALERT_CHANNEL_ID);
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
    if (alertTask) {
      alertTask.stop();
    }
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
