import { REST, Routes } from 'discord.js';
import { getEnvConfig } from '../config/env';
import { commands } from '../commands';

export interface DeployOptions {
  token?: string;
  clientId?: string;
  guildId?: string;
}

/**
 * Registers slash commands with the Discord REST API.
 * Supports guild-specific (instant) or global application command deployment.
 */
export async function deploySlashCommands(options?: DeployOptions): Promise<void> {
  const env = getEnvConfig(true);
  const token = options?.token || env.DISCORD_TOKEN;
  const clientId = options?.clientId || env.CLIENT_ID;
  const guildId = options?.guildId || env.GUILD_ID;

  const rest = new REST({ version: '10' }).setToken(token);
  const commandPayload = commands.map((cmd) => cmd.data.toJSON());

  console.log(`[PropGuard Deployer] Preparing to register ${commandPayload.length} slash commands...`);

  try {
    if (guildId) {
      console.log(`[PropGuard Deployer] Deploying commands to Guild ID: ${guildId} (instant update)...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commandPayload,
      });
      console.log(`[PropGuard Deployer] Successfully registered commands to Guild: ${guildId}`);
    } else {
      console.log(`[PropGuard Deployer] Deploying commands globally to all guilds...`);
      await rest.put(Routes.applicationCommands(clientId), {
        body: commandPayload,
      });
      console.log(`[PropGuard Deployer] Successfully registered commands globally!`);
    }
  } catch (error) {
    console.error('[PropGuard Deployer] Error deploying slash commands:', error);
    throw error;
  }
}

// Allow direct CLI execution: ts-node src/scripts/deployCommands.ts
if (require.main === module) {
  deploySlashCommands()
    .then(() => {
      console.log('[PropGuard Deployer] Finished command registration process.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[PropGuard Deployer] Registration failed:', err);
      process.exit(1);
    });
}
