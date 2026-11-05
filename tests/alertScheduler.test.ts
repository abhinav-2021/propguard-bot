import { describe, it, expect, vi } from 'vitest';
import { Client } from 'discord.js';
import { buildCutoffAlertEmbed } from '../src/utils/embedBuilder';
import { getTenantByFirmId } from '../src/config/tenants';
import { scheduleCutoffAlertJob, sendCutoffAlert } from '../src/index';

describe('Scheduled Cutoff Alert Background Job', () => {
  describe('buildCutoffAlertEmbed', () => {
    it('creates red alert embed with 16:55 ET countdown and flattening reminder', () => {
      const tradeify = getTenantByFirmId('tradeify');
      const targetLiq = new Date('2026-11-05T21:55:00.000Z'); // 16:55 ET
      const targetHalt = new Date('2026-11-05T21:59:00.000Z'); // 16:59 ET

      const embed = buildCutoffAlertEmbed(tradeify, targetLiq, targetHalt);
      const json = embed.toJSON();

      // Red alert border check (#ED4245 / 0xED4245)
      expect(json.color).toBe(0xed4245);
      expect(json.title).toContain('MANDATORY POSITION FLATTENING ALERT');
      expect(json.title).toContain('10 MINUTES REMAINING');
      expect(json.description).toContain('16:55 US Eastern');
      expect(json.description).toContain('completely flattened now');

      // Check fields for countdown and checklist
      const fields = json.fields || [];
      const liqField = fields.find((f) => f.name.includes('Auto-Liquidation Cutoff'));
      expect(liqField).toBeDefined();
      expect(liqField?.value).toContain(`<t:${Math.floor(targetLiq.getTime() / 1000)}:R>`);

      const checklist = fields.find((f) => f.name.includes('Mandatory Trader Checklist'));
      expect(checklist).toBeDefined();
      expect(checklist?.value).toContain('Flatten Positions');
      expect(checklist?.value).toContain('Cancel Orders');
    });
  });

  describe('scheduleCutoffAlertJob', () => {
    it('returns null when alertChannelId is not provided', () => {
      const mockClient = {} as Client;
      const task = scheduleCutoffAlertJob(mockClient, undefined);
      expect(task).toBeNull();
    });

    it('initializes scheduled task when alertChannelId is provided and allows clean stopping', () => {
      const mockClient = {} as Client;
      const task = scheduleCutoffAlertJob(mockClient, '123456789012345678');
      expect(task).not.toBeNull();
      expect(typeof task?.stop).toBe('function');

      // Stop the task to clean up timer
      task?.stop();
    });
  });

  describe('sendCutoffAlert', () => {
    it('successfully sends alert embed to valid text channel', async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      const mockChannel = {
        isTextBased: () => true,
        send: mockSend,
        guildId: 'test_guild',
      };

      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      } as unknown as Client;

      const success = await sendCutoffAlert(mockClient, '123456789012345678');
      expect(success).toBe(true);
      expect(mockSend).toHaveBeenCalledTimes(1);

      const callArg = mockSend.mock.calls[0]![0];
      expect(callArg.content).toContain('MANDATORY CUTOFF WARNING');
      expect(callArg.embeds[0].data.color).toBe(0xed4245);
    });

    it('returns false if channel is not found', async () => {
      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(null),
        },
      } as unknown as Client;

      const success = await sendCutoffAlert(mockClient, 'non_existent_channel');
      expect(success).toBe(false);
    });

    it('returns false if channel is not text-based', async () => {
      const mockVoiceChannel = {
        isTextBased: () => false,
      };

      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockVoiceChannel),
        },
      } as unknown as Client;

      const success = await sendCutoffAlert(mockClient, 'voice_channel');
      expect(success).toBe(false);
    });
  });
});

