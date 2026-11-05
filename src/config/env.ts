import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface EnvConfig {
  DISCORD_TOKEN: string;
  CLIENT_ID: string;
  GUILD_ID?: string;
  ALERT_CHANNEL_ID?: string;
  DEFAULT_FIRM_PRESET: string;
  NODE_ENV: string;
}

/**
 * Validates and retrieves the required environment variables.
 * Can be called with validate=false to inspect partial configuration during non-runtime tasks.
 */
export function getEnvConfig(validate = true): EnvConfig {
  const token = process.env.DISCORD_TOKEN?.trim() || '';
  const clientId = process.env.CLIENT_ID?.trim() || '';
  const guildId = process.env.GUILD_ID?.trim() || undefined;
  const alertChannelId = process.env.ALERT_CHANNEL_ID?.trim() || undefined;
  const defaultFirmPreset = process.env.DEFAULT_FIRM_PRESET?.trim().toLowerCase() || 'generic';
  const nodeEnv = process.env.NODE_ENV?.trim() || 'development';

  if (validate) {
    const missing: string[] = [];
    if (!token) missing.push('DISCORD_TOKEN');
    if (!clientId) missing.push('CLIENT_ID');

    if (missing.length > 0) {
      throw new Error(
        `[PropGuard Config Error] Missing required environment variable(s): ${missing.join(
          ', '
        )}. Please check your .env file or reference .env.example.`
      );
    }
  }

  return {
    DISCORD_TOKEN: token,
    CLIENT_ID: clientId,
    GUILD_ID: guildId,
    ALERT_CHANNEL_ID: alertChannelId,
    DEFAULT_FIRM_PRESET: defaultFirmPreset,
    NODE_ENV: nodeEnv,
  };
}

