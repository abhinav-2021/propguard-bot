import { describe, it, expect } from 'vitest';
import { calculateDrawdown } from '../src/services/drawdownCalculator';
import { getCmeSessionInfo } from '../src/services/sessionService';
import { getTenantByFirmId } from '../src/config/tenants';
import {
  buildDrawdownEmbed,
  buildCutoffEmbed,
  buildDisputeCheckEmbed,
  buildErrorEmbed,
} from '../src/utils/embedBuilder';

describe('Embed Builder Utility with Whitelabeling', () => {
  describe('buildDrawdownEmbed', () => {
    it('creates whitelabeled rich embed with brand color and logo', () => {
      const breakdown = calculateDrawdown({
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 53000,
        currentEquity: 52500,
        isFunded: true,
      });

      const tenant = getTenantByFirmId('tradeify');
      const tier = tenant.tiers[0];
      const embed = buildDrawdownEmbed(breakdown, tenant, tier);
      const json = embed.toJSON();

      expect(json.title).toContain('Tradeify Drawdown Verification | HEALTHY');
      expect(json.color).toBe(tenant.brandColor);
      expect(json.thumbnail?.url).toBe(tenant.logoUrl);
      expect(json.description).toContain('Funded Lock Barrier Active');
      expect(json.description).toContain('50K Growth (EOD)');
      expect(json.footer?.text).toContain('Tradeify Risk Engine • Powered by PropGuard');

      const fieldNames = json.fields!.map((f) => f.name);
      expect(fieldNames).toContain('💼 Initial Capital');
      expect(fieldNames).toContain('📊 Peak High-Water Mark');
      expect(fieldNames).toContain('📉 Max Allowed Drawdown');
      expect(fieldNames).toContain('🎯 Current Live Equity');
      expect(fieldNames).toContain('🔒 Liquidation Floor (LOCKED)');
      expect(fieldNames).toContain('🛡️ Usable Buffer Remaining');
      expect(fieldNames).toContain('🎫 Need Assistance?');
    });

    it('creates rich embed for breached account with red color', () => {
      const breakdown = calculateDrawdown({
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 47900,
        isFunded: false,
      });

      const embed = buildDrawdownEmbed(breakdown);
      const json = embed.toJSON();

      expect(json.title).toContain('BREACHED');
      expect(json.color).toBe(0xed4245);
      expect(json.description).toContain('BREACH EVENT');
    });

    it('creates rich embed for critical account with yellow color', () => {
      const breakdown = calculateDrawdown({
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 48200,
        isFunded: false,
      });

      const embed = buildDrawdownEmbed(breakdown);
      const json = embed.toJSON();

      expect(json.title).toContain('CRITICAL');
      expect(json.color).toBe(0xfee75c);
      expect(json.description).toContain('HIGH RISK WARNING');
    });
  });

  describe('buildCutoffEmbed', () => {
    it('creates rich embed with Discord timestamps, whitelabel branding, and firm cutoff', () => {
      const tenant = getTenantByFirmId('tradeify');
      const info = getCmeSessionInfo(new Date('2026-11-04T15:00:00Z'), tenant.cutoffOffsetMinutes);
      const embed = buildCutoffEmbed(info, tenant);
      const json = embed.toJSON();

      expect(json.title).toContain('Tradeify CME Futures Session & Cutoff Monitor');
      expect(json.color).toBe(tenant.brandColor);
      expect(json.thumbnail?.url).toBe(tenant.logoUrl);
      expect(json.fields).toBeDefined();

      const fieldHalt = json.fields!.find((f) => f.name.includes('Next CME Session Halt'));
      expect(fieldHalt?.value).toContain(`<t:${info.nextHaltUnix}:R>`);

      const fieldLiq = json.fields!.find((f) => f.name.includes('Auto-Liquidation Cutoff'));
      expect(fieldLiq?.value).toContain(`<t:${info.nextAutoLiquidationUnix}:R>`);

      const supportField = json.fields!.find((f) => f.name.includes('Support Link'));
      expect(supportField?.value).toContain(tenant.supportTicketUrl!);
    });
  });

  describe('buildDisputeCheckEmbed', () => {
    it('creates rich embed for green_blowup scenario with tenant branding', () => {
      const tenant = getTenantByFirmId('apex');
      const embed = buildDisputeCheckEmbed('green_blowup', tenant);
      const json = embed.toJSON();

      expect(json.title).toContain('Apex Trader Funding');
      expect(json.title).toContain('Why Did My Account Fail When My Trade Closed Green?');
      expect(json.color).toBe(tenant.brandColor);
      expect(json.description).toContain('Intraday Peak Unrealized Equity');
      expect(json.fields?.length).toBeGreaterThanOrEqual(3);
    });

    it('creates rich embed for cme_halt scenario with tenant cutoff details', () => {
      const tenant = getTenantByFirmId('tradeify');
      const embed = buildDisputeCheckEmbed('cme_halt', tenant);
      const json = embed.toJSON();

      expect(json.title).toContain('Tradeify');
      expect(json.description).toContain('5 min before 17:00 ET');
    });

    it('creates rich embed for daily_vs_trailing scenario', () => {
      const tenant = getTenantByFirmId('lucid');
      const embed = buildDisputeCheckEmbed('daily_vs_trailing', tenant);
      const json = embed.toJSON();

      expect(json.title).toContain('Lucid Trading');
      expect(json.title).toContain('Soft Breach vs. Hard Breach');
      expect(json.fields?.some((f) => f.name.includes('Daily Loss Limit'))).toBe(true);
      expect(json.fields?.some((f) => f.name.includes('Trailing Drawdown'))).toBe(true);
    });
  });

  describe('buildErrorEmbed', () => {
    it('creates an error embed with message and tenant branding', () => {
      const tenant = getTenantByFirmId('tradeify');
      const embed = buildErrorEmbed('Invalid parameter supplied.', tenant);
      const json = embed.toJSON();

      expect(json.title).toBe('⚠️ Tradeify Risk Verification Error');
      expect(json.description).toBe('Invalid parameter supplied.');
      expect(json.color).toBe(0xed4245);
    });
  });
});
