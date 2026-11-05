import { describe, it, expect, vi } from 'vitest';
import { commands, commandMap } from '../src/commands';
import { drawdownCommand } from '../src/commands/drawdown';
import { cutoffCommand } from '../src/commands/cutoff';
import { disputeCheckCommand } from '../src/commands/disputeCheck';
import { ChatInputCommandInteraction } from 'discord.js';

describe('Discord Slash Commands Suite', () => {
  it('registers all three required commands in commandMap', () => {
    expect(commands).toHaveLength(3);
    expect(commandMap.has('drawdown')).toBe(true);
    expect(commandMap.has('cutoff')).toBe(true);
    expect(commandMap.has('dispute-check')).toBe(true);
  });

  describe('/drawdown command definition and execution', () => {
    it('has valid command structure and options', () => {
      const json = drawdownCommand.data.toJSON();
      expect(json.name).toBe('drawdown');
      expect(json.options).toBeDefined();

      const optionNames = json.options!.map((opt) => opt.name);
      expect(optionNames).toContain('account_size');
      expect(optionNames).toContain('max_loss');
      expect(optionNames).toContain('model');
      expect(optionNames).toContain('peak_value');
      expect(optionNames).toContain('current_equity');
      expect(optionNames).toContain('is_funded');
      expect(optionNames).toContain('firm');
    });

    it('executes successfully and replies with embed', async () => {
      const mockReply = vi.fn().mockResolvedValue(undefined);
      const mockInteraction = {
        options: {
          getNumber: vi.fn((name: string) => {
            if (name === 'account_size') return 50000;
            if (name === 'max_loss') return 2500;
            if (name === 'peak_value') return 52000;
            if (name === 'current_equity') return 51000;
            return null;
          }),
          getString: vi.fn((name: string) => {
            if (name === 'model') return 'INTRADAY';
            if (name === 'firm') return 'tradeify';
            return null;
          }),
          getBoolean: vi.fn((name: string) => {
            if (name === 'is_funded') return false;
            return null;
          }),
        },
        reply: mockReply,
        followUp: vi.fn(),
        replied: false,
        deferred: false,
      } as unknown as ChatInputCommandInteraction;

      await drawdownCommand.execute(mockInteraction);

      expect(mockReply).toHaveBeenCalledTimes(1);
      const callArg = mockReply.mock.calls[0]![0];
      expect(callArg.embeds).toBeDefined();
      expect(callArg.embeds[0].data.title).toContain('Drawdown Verification');
    });

    it('handles validation error gracefully', async () => {
      const mockReply = vi.fn().mockResolvedValue(undefined);
      const mockInteraction = {
        options: {
          getNumber: vi.fn((name: string) => {
            if (name === 'account_size') return -100; // invalid!
            if (name === 'max_loss') return 2500;
            if (name === 'peak_value') return 50000;
            if (name === 'current_equity') return 50000;
            return null;
          }),
          getString: vi.fn(() => 'INTRADAY'),
          getBoolean: vi.fn(() => false),
        },
        reply: mockReply,
        followUp: vi.fn(),
        replied: false,
        deferred: false,
      } as unknown as ChatInputCommandInteraction;

      await drawdownCommand.execute(mockInteraction);

      expect(mockReply).toHaveBeenCalledTimes(1);
      const callArg = mockReply.mock.calls[0]![0];
      expect(callArg.ephemeral).toBe(true);
      expect(callArg.embeds[0].data.title).toContain('PropGuard Validation Error');
    });
  });

  describe('/cutoff command definition and execution', () => {
    it('has valid command structure and options', () => {
      const json = cutoffCommand.data.toJSON();
      expect(json.name).toBe('cutoff');
      expect(json.options).toBeDefined();
      expect(json.options!.some((o) => o.name === 'firm')).toBe(true);
    });

    it('executes successfully and replies with CME monitor embed', async () => {
      const mockReply = vi.fn().mockResolvedValue(undefined);
      const mockInteraction = {
        options: {
          getString: vi.fn(() => 'tradeify'),
        },
        reply: mockReply,
        followUp: vi.fn(),
        replied: false,
        deferred: false,
      } as unknown as ChatInputCommandInteraction;

      await cutoffCommand.execute(mockInteraction);

      expect(mockReply).toHaveBeenCalledTimes(1);
      const callArg = mockReply.mock.calls[0]![0];
      expect(callArg.embeds).toBeDefined();
      expect(callArg.embeds[0].data.title).toContain('CME Futures Session & Auto-Liquidation Monitor');
    });
  });

  describe('/dispute-check command definition and execution', () => {
    it('has valid command structure with scenario choices', () => {
      const json = disputeCheckCommand.data.toJSON();
      expect(json.name).toBe('dispute-check');
      const scenarioOption = json.options?.find((o) => o.name === 'scenario');
      expect(scenarioOption).toBeDefined();
      expect(scenarioOption?.required).toBe(true);
    });

    it('executes successfully and replies ephemerally', async () => {
      const mockReply = vi.fn().mockResolvedValue(undefined);
      const mockInteraction = {
        options: {
          getString: vi.fn((name: string) => {
            if (name === 'scenario') return 'green_blowup';
            if (name === 'firm') return 'apex';
            return null;
          }),
        },
        reply: mockReply,
        followUp: vi.fn(),
        replied: false,
        deferred: false,
      } as unknown as ChatInputCommandInteraction;

      await disputeCheckCommand.execute(mockInteraction);

      expect(mockReply).toHaveBeenCalledTimes(1);
      const callArg = mockReply.mock.calls[0]![0];
      expect(callArg.ephemeral).toBe(true);
      expect(callArg.embeds[0].data.title).toContain('Closed Green');
    });
  });
});

