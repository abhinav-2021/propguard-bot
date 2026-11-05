import { describe, it, expect } from 'vitest';
import {
  TENANT_REGISTRY,
  getTenantConfig,
  getTenantByFirmId,
  registerGuildTenant,
  findTenantTier,
  TenantConfig,
  AccountTier,
} from '../src/config/tenants';

describe('Multi-Tenant Whitelabel Architecture', () => {
  it('conforms to AccountTier and TenantConfig interfaces', () => {
    const tradeify: TenantConfig = TENANT_REGISTRY.tradeify!;
    expect(tradeify.firmId).toBe('tradeify');
    expect(tradeify.firmName).toBe('Tradeify');
    expect(typeof tradeify.brandColor).toBe('number');
    expect(tradeify.brandColor).toBe(0x00e599);
    expect(tradeify.cutoffOffsetMinutes).toBe(5);
    expect(Array.isArray(tradeify.tiers)).toBe(true);

    const firstTier: AccountTier = tradeify.tiers[0]!;
    expect(firstTier.name).toBe('50K Growth (EOD)');
    expect(firstTier.size).toBe(50000);
    expect(firstTier.maxLoss).toBe(2000);
    expect(firstTier.drawdownType).toBe('EOD');
  });

  it('contains configurations for Tradeify, Lucid, Apex, Bulenox, and Generic', () => {
    expect(TENANT_REGISTRY.tradeify).toBeDefined();
    expect(TENANT_REGISTRY.lucid).toBeDefined();
    expect(TENANT_REGISTRY.apex).toBeDefined();
    expect(TENANT_REGISTRY.bulenox).toBeDefined();
    expect(TENANT_REGISTRY.generic).toBeDefined();
  });

  it('falls back to generic tenant when guildId is not mapped or null', () => {
    const tenant = getTenantConfig(null);
    expect(tenant.firmId).toBe('generic');
    expect(tenant.firmName).toBe('PropGuard Institutional');
  });

  it('resolves tenant by registered Discord Guild ID', () => {
    const testGuildId = '987654321098765432';
    registerGuildTenant(testGuildId, 'lucid');

    const resolved = getTenantConfig(testGuildId);
    expect(resolved.firmId).toBe('lucid');
    expect(resolved.firmName).toBe('Lucid Trading');
    expect(resolved.brandColor).toBe(0x6c5ce7);
  });

  it('allows explicit firm override to supersede guild mapping', () => {
    const testGuildId = '111222333444555666';
    registerGuildTenant(testGuildId, 'tradeify');

    // Overriding with 'apex'
    const resolved = getTenantConfig(testGuildId, 'apex');
    expect(resolved.firmId).toBe('apex');
    expect(resolved.firmName).toBe('Apex Trader Funding');
  });

  it('finds account tier by size and by name', () => {
    const apex = getTenantByFirmId('apex');

    const tierBySize = findTenantTier(apex, 50000);
    expect(tierBySize).toBeDefined();
    expect(tierBySize?.name).toBe('50K Full (Intraday)');
    expect(tierBySize?.maxLoss).toBe(2500);

    const tierByName = findTenantTier(apex, '300K Full');
    expect(tierByName).toBeDefined();
    expect(tierByName?.size).toBe(300000);
    expect(tierByName?.maxLoss).toBe(7500);

    const notFound = findTenantTier(apex, 'NonExistent');
    expect(notFound).toBeUndefined();
  });

  it('throws error when registering an unknown firmId', () => {
    expect(() => registerGuildTenant('12345', 'unknown_firm')).toThrow(
      'Unknown firmId: "unknown_firm"'
    );
  });
});

