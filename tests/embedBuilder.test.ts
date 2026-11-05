import { describe, it, expect } from 'vitest';
import { calculateDrawdown } from '../src/services/drawdownCalculator';
import { getCmeSessionInfo } from '../src/services/sessionService';
import { getFirmPreset } from '../src/config/firmRules';
import {
  buildDrawdownEmbed,
  buildCutoffEmbed,
  buildDisputeCheckEmbed,
  buildErrorEmbed,
} from '../src/utils/embedBuilder';

describe('Embed Builder Utility', () => {
  describe('buildDrawdownEmbed', () => {
    it('creates rich embed for healthy funded account', () => {
      const breakdown = calculateDrawdown({
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 53000,
        currentEquity: 52500,
        isFunded: true,
      });

      const preset = getFirmPreset('apex');
      const embed = buildDrawdownEmbed(breakdown, preset);
      const json = embed.toJSON();

      expect(json.title).toContain('Drawdown Verification | HEALTHY');
      expect(json.color).toBe(0x57f287);
      expect(json.description).toContain('Funded Lock Barrier Active');
      expect(json.fields).toBeDefined();

      const fieldNames = json.fields!.map((f) => f.name);
      expect(fieldNames).toContain('💼 Initial Capital');
      expect(fieldNames).toContain('📊 Peak High-Water Mark');
      expect(fieldNames).toContain('📉 Max Allowed Drawdown');
      expect(fieldNames).toContain('🎯 Current Live Equity');
      expect(fieldNames).toContain('🔒 Liquidation Floor (LOCKED)');
      expect(fieldNames).toContain('🛡️ Usable Buffer Remaining');
      expect(fieldNames).toContain('📐 Mathematical Breakdown');
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
    it('creates rich embed with Discord timestamps and warnings', () => {
      const info = getCmeSessionInfo(new Date('2026-11-04T15:00:00Z'));
      const preset = getFirmPreset('tradeify');
      const embed = buildCutoffEmbed(info, preset);
      const json = embed.toJSON();

      expect(json.title).toContain('CME Futures Session & Auto-Liquidation Monitor');
      expect(json.fields).toBeDefined();

      const fieldHalt = json.fields!.find((f) => f.name.includes('Next CME Session Halt'));
      expect(fieldHalt?.value).toContain(`<t:${info.nextHaltUnix}:R>`);

      const fieldLiq = json.fields!.find((f) => f.name.includes('Broker Auto-Liquidation Window'));
      expect(fieldLiq?.value).toContain(`<t:${info.nextAutoLiquidationUnix}:R>`);
    });
  });

  describe('buildDisputeCheckEmbed', () => {
    it('creates rich embed for green_blowup scenario', () => {
      const embed = buildDisputeCheckEmbed('green_blowup', getFirmPreset('apex'));
      const json = embed.toJSON();

      expect(json.title).toContain('Why Did My Account Fail When My Trade Closed Green?');
      expect(json.description).toContain('Intraday Peak Unrealized Equity');
      expect(json.fields?.length).toBeGreaterThanOrEqual(3);
    });

    it('creates rich embed for cme_halt scenario', () => {
      const embed = buildDisputeCheckEmbed('cme_halt', getFirmPreset('tradeify'));
      const json = embed.toJSON();

      expect(json.title).toContain('Why Was My Position Auto-Closed Before 5:00 PM EST?');
      expect(json.description).toContain('Broker-Side Pre-Halt Auto-Liquidation Window');
    });

    it('creates rich embed for daily_vs_trailing scenario', () => {
      const embed = buildDisputeCheckEmbed('daily_vs_trailing', getFirmPreset('lucid'));
      const json = embed.toJSON();

      expect(json.title).toContain('Soft Breach vs. Hard Breach');
      expect(json.fields?.some((f) => f.name.includes('Daily Loss Limit'))).toBe(true);
      expect(json.fields?.some((f) => f.name.includes('Trailing Drawdown'))).toBe(true);
    });
  });

  describe('buildErrorEmbed', () => {
    it('creates an error embed with message', () => {
      const embed = buildErrorEmbed('Invalid parameter supplied.');
      const json = embed.toJSON();

      expect(json.title).toBe('⚠️ PropGuard Validation Error');
      expect(json.description).toBe('Invalid parameter supplied.');
      expect(json.color).toBe(0xed4245);
    });
  });
});

