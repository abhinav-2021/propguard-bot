export interface AccountTier {
  name: string;           // e.g., "50K Select (EOD)"
  size: number;           // e.g., 50000
  maxLoss: number;        // e.g., 2000
  drawdownType: 'EOD' | 'INTRADAY';
  dailyLossLimit?: number;
}

export interface TenantConfig {
  firmId: string;
  firmName: string;
  brandColor: number;     // Discord Embed Hex (e.g., 0x00E599)
  logoUrl?: string;
  supportTicketUrl?: string;
  cutoffOffsetMinutes: number; // e.g., 5 min before 17:00 ET (16:55 ET auto-liquidation)
  tiers: AccountTier[];
}

export const TENANT_REGISTRY: Record<string, TenantConfig> = {
  tradeify: {
    firmId: 'tradeify',
    firmName: 'Tradeify',
    brandColor: 0x00e599, // Tradeify Mint Green
    logoUrl: 'https://raw.githubusercontent.com/propguard/assets/main/tradeify.png',
    supportTicketUrl: 'https://tradeify.co/support',
    cutoffOffsetMinutes: 5, // 16:55 EST (5 mins before 17:00)
    tiers: [
      {
        name: '50K Growth (EOD)',
        size: 50000,
        maxLoss: 2000,
        drawdownType: 'EOD',
      },
      {
        name: '100K Growth (EOD)',
        size: 100000,
        maxLoss: 3000,
        drawdownType: 'EOD',
      },
      {
        name: '150K Growth (EOD)',
        size: 150000,
        maxLoss: 4500,
        drawdownType: 'EOD',
      },
      {
        name: '50K Lightning (Intraday)',
        size: 50000,
        maxLoss: 2000,
        drawdownType: 'INTRADAY',
      },
      {
        name: '100K Lightning (Intraday)',
        size: 100000,
        maxLoss: 3000,
        drawdownType: 'INTRADAY',
      },
    ],
  },
  lucid: {
    firmId: 'lucid',
    firmName: 'Lucid Trading',
    brandColor: 0x6c5ce7, // Lucid Purple
    logoUrl: 'https://raw.githubusercontent.com/propguard/assets/main/lucid.png',
    supportTicketUrl: 'https://lucidtrading.com/help',
    cutoffOffsetMinutes: 5, // 16:55 EST
    tiers: [
      {
        name: '50K Evaluation (EOD)',
        size: 50000,
        maxLoss: 2000,
        drawdownType: 'EOD',
        dailyLossLimit: 1000,
      },
      {
        name: '100K Evaluation (EOD)',
        size: 100000,
        maxLoss: 3000,
        drawdownType: 'EOD',
        dailyLossLimit: 2000,
      },
      {
        name: '150K Evaluation (EOD)',
        size: 150000,
        maxLoss: 4500,
        drawdownType: 'EOD',
        dailyLossLimit: 3000,
      },
    ],
  },
  apex: {
    firmId: 'apex',
    firmName: 'Apex Trader Funding',
    brandColor: 0xf39c12, // Apex Orange / Gold
    logoUrl: 'https://raw.githubusercontent.com/propguard/assets/main/apex.png',
    supportTicketUrl: 'https://apextraderfunding.com/support',
    cutoffOffsetMinutes: 1, // 16:59 EST (1 min before 17:00)
    tiers: [
      {
        name: '25K Full (Intraday)',
        size: 25000,
        maxLoss: 1500,
        drawdownType: 'INTRADAY',
      },
      {
        name: '50K Full (Intraday)',
        size: 50000,
        maxLoss: 2500,
        drawdownType: 'INTRADAY',
      },
      {
        name: '100K Full (Intraday)',
        size: 100000,
        maxLoss: 3000,
        drawdownType: 'INTRADAY',
      },
      {
        name: '150K Full (Intraday)',
        size: 150000,
        maxLoss: 5000,
        drawdownType: 'INTRADAY',
      },
      {
        name: '300K Full (Intraday)',
        size: 300000,
        maxLoss: 7500,
        drawdownType: 'INTRADAY',
      },
    ],
  },
  bulenox: {
    firmId: 'bulenox',
    firmName: 'Bulenox',
    brandColor: 0x3498db, // Bulenox Blue
    logoUrl: 'https://raw.githubusercontent.com/propguard/assets/main/bulenox.png',
    supportTicketUrl: 'https://bulenox.com/contact',
    cutoffOffsetMinutes: 5,
    tiers: [
      {
        name: '25K Master (EOD)',
        size: 25000,
        maxLoss: 1500,
        drawdownType: 'EOD',
      },
      {
        name: '50K Master (EOD)',
        size: 50000,
        maxLoss: 2500,
        drawdownType: 'EOD',
      },
      {
        name: '100K Master (EOD)',
        size: 100000,
        maxLoss: 3000,
        drawdownType: 'EOD',
      },
      {
        name: '50K Option 1 (Intraday)',
        size: 50000,
        maxLoss: 2500,
        drawdownType: 'INTRADAY',
      },
    ],
  },
  generic: {
    firmId: 'generic',
    firmName: 'PropGuard Institutional',
    brandColor: 0x5865f2, // Discord Blurple
    logoUrl: 'https://raw.githubusercontent.com/propguard/assets/main/propguard.png',
    supportTicketUrl: 'https://discord.com',
    cutoffOffsetMinutes: 5,
    tiers: [
      {
        name: '50K Standard (EOD)',
        size: 50000,
        maxLoss: 2000,
        drawdownType: 'EOD',
      },
      {
        name: '50K Standard (Intraday)',
        size: 50000,
        maxLoss: 2500,
        drawdownType: 'INTRADAY',
      },
      {
        name: '100K Standard (EOD)',
        size: 100000,
        maxLoss: 3000,
        drawdownType: 'EOD',
      },
      {
        name: '150K Standard (EOD)',
        size: 150000,
        maxLoss: 4500,
        drawdownType: 'EOD',
      },
    ],
  },
};

// Guild to Tenant ID runtime mapping
const guildTenantMap = new Map<string, string>();

/**
 * Initializes mappings from environment variables or custom configs.
 */
export function initGuildTenantMappings(): void {
  // If GUILD_ID is specified in .env, map it to DEFAULT_FIRM_PRESET
  const defaultGuild = process.env.GUILD_ID?.trim();
  const defaultPreset = process.env.DEFAULT_FIRM_PRESET?.trim().toLowerCase();
  if (defaultGuild && defaultPreset && TENANT_REGISTRY[defaultPreset]) {
    guildTenantMap.set(defaultGuild, defaultPreset);
  }

  // Support GUILD_TENANT_MAPPINGS="guildId1:tradeify,guildId2:lucid" or JSON
  const mappingStr = process.env.GUILD_TENANT_MAPPINGS?.trim();
  if (mappingStr) {
    if (mappingStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(mappingStr);
        for (const [gid, fid] of Object.entries(parsed)) {
          if (typeof fid === 'string' && TENANT_REGISTRY[fid.toLowerCase()]) {
            guildTenantMap.set(gid, fid.toLowerCase());
          }
        }
      } catch (e) {
        console.warn('[PropGuard Whitelabel] Failed to parse GUILD_TENANT_MAPPINGS JSON:', e);
      }
    } else {
      const pairs = mappingStr.split(',');
      for (const pair of pairs) {
        const [gid, fid] = pair.split(':').map((s) => s.trim());
        if (gid && fid && TENANT_REGISTRY[fid.toLowerCase()]) {
          guildTenantMap.set(gid, fid.toLowerCase());
        }
      }
    }
  }
}

// Auto-run once on module load
initGuildTenantMappings();

/**
 * Dynamically associates a Discord Guild ID with a specific firm Tenant ID.
 */
export function registerGuildTenant(guildId: string, firmId: string): void {
  const normalizedFirmId = firmId.toLowerCase().trim();
  if (!TENANT_REGISTRY[normalizedFirmId]) {
    throw new Error(`Unknown firmId: "${firmId}". Available: ${Object.keys(TENANT_REGISTRY).join(', ')}`);
  }
  guildTenantMap.set(guildId, normalizedFirmId);
}

/**
 * Retrieves the tenant for a given firm ID.
 */
export function getTenantByFirmId(firmId?: string): TenantConfig {
  if (!firmId) return TENANT_REGISTRY.generic!;
  const key = firmId.toLowerCase().trim();
  return TENANT_REGISTRY[key] || TENANT_REGISTRY.generic!;
}

/**
 * Resolves the TenantConfig for a given interaction.
 * Priority:
 * 1. Explicit override firmId (if passed as an option)
 * 2. Guild ID mapped tenant
 * 3. Environment default firm preset
 * 4. Generic tenant fallback
 */
export function getTenantConfig(guildId?: string | null, overrideFirmId?: string | null): TenantConfig {
  if (overrideFirmId) {
    return getTenantByFirmId(overrideFirmId);
  }

  if (guildId && guildTenantMap.has(guildId)) {
    const firmId = guildTenantMap.get(guildId)!;
    return getTenantByFirmId(firmId);
  }

  const defaultPreset = process.env.DEFAULT_FIRM_PRESET?.trim().toLowerCase();
  if (defaultPreset && TENANT_REGISTRY[defaultPreset]) {
    return TENANT_REGISTRY[defaultPreset]!;
  }

  return TENANT_REGISTRY.generic!;
}

/**
 * Finds a matching account tier by name or size within a tenant configuration.
 */
export function findTenantTier(tenant: TenantConfig, query: string | number): AccountTier | undefined {
  if (typeof query === 'number') {
    return tenant.tiers.find((t) => t.size === query);
  }
  const clean = query.toLowerCase().trim();
  return tenant.tiers.find(
    (t) => t.name.toLowerCase() === clean || t.name.toLowerCase().includes(clean)
  );
}
