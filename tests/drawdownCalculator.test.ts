import { describe, it, expect } from 'vitest';
import {
  calculateDrawdown,
  formatCurrency,
  DrawdownCalculationInput,
} from '../src/services/drawdownCalculator';

describe('Drawdown Calculator Service', () => {
  describe('formatCurrency', () => {
    it('formats positive numbers correctly', () => {
      expect(formatCurrency(50000)).toBe('$50,000.00');
      expect(formatCurrency(2500.5)).toBe('$2,500.50');
    });

    it('formats negative numbers correctly', () => {
      expect(formatCurrency(-150.25)).toBe('-$150.25');
    });

    it('formats zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
  });

  describe('Trailing floor updates on unrealized profit (Intraday Model)', () => {
    it('calculates initial floor at starting balance correctly', () => {
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2500,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 50000,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.rawFloor).toBe(47500);
      expect(result.floor).toBe(47500);
      expect(result.buffer).toBe(2500);
      expect(result.isLocked).toBe(false);
      expect(result.state).toBe('HEALTHY');
    });

    it('trails floor upwards when peak equity surges with unrealized profit', () => {
      // Account started at 50,000. During an open trade, equity spiked to 53,000.
      // Current equity retraced to 51,500.
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2500,
        model: 'INTRADAY',
        peakValue: 53000,
        currentEquity: 51500,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      // Floor must trail up to peak (53,000) - maxLoss (2,500) = 50,500
      expect(result.rawFloor).toBe(50500);
      expect(result.floor).toBe(50500);
      // Buffer = 51,500 - 50,500 = 1,000
      expect(result.buffer).toBe(1000);
      expect(result.state).toBe('HEALTHY');
      expect(result.isLocked).toBe(false);
    });

    it('identifies green account blowup scenario where trade closed green but breached new trailed floor', () => {
      // Trader started at 50,000 with 2,500 max loss.
      // Unrealized profit peaked at 53,000 (pulling floor to 50,500).
      // Trade collapsed and closed at 50,400 (+400 profit relative to initial, but below 50,500 floor).
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2500,
        model: 'INTRADAY',
        peakValue: 53000,
        currentEquity: 50400,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.floor).toBe(50500);
      expect(result.buffer).toBe(-100);
      expect(result.state).toBe('BREACHED');
      expect(result.explanation).toContain('BREACH EVENT');
    });
  });

  describe('EOD floor remaining static during intraday swings', () => {
    it('keeps floor anchored to settled session peak despite intraday equity fluctuations', () => {
      // EOD model: Account started at 50,000. Last settled EOD peak was 51,000.
      // Floor is anchored at 51,000 - 2,000 = 49,000.
      // Intraday equity is currently swinging at 52,500.
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'EOD',
        peakValue: 51000, // Settled EOD peak
        currentEquity: 52500,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.floor).toBe(49000);
      expect(result.buffer).toBe(3500); // 52,500 - 49,000
      expect(result.state).toBe('HEALTHY');
      expect(result.explanation).toContain('End-of-Day (EOD) Settled Trailing');
    });

    it('correctly detects intraday liquidation under EOD model if live equity touches settled floor', () => {
      // Settled EOD peak is 50,000, max loss 2,000 -> floor is 48,000.
      // Live intraday equity collapses to 47,900.
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'EOD',
        peakValue: 50000,
        currentEquity: 47900,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.floor).toBe(48000);
      expect(result.buffer).toBe(-100);
      expect(result.state).toBe('BREACHED');
    });
  });

  describe('Drawdown lock at Starting Balance + $100 for funded accounts', () => {
    it('does not lock floor on evaluation accounts even if raw floor exceeds starting balance + $100', () => {
      // Evaluation account (isFunded = false)
      // Account 50,000, max loss 2,000. Peak = 54,000.
      // Raw floor = 52,000. Since it's evaluation, it keeps trailing!
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 54000,
        currentEquity: 53000,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.rawFloor).toBe(52000);
      expect(result.floor).toBe(52000);
      expect(result.isLocked).toBe(false);
      expect(result.lockThreshold).toBe(50100);
    });

    it('locks floor at Starting Balance + $100 when funded and raw floor reaches or exceeds lock threshold', () => {
      // Funded account (isFunded = true)
      // Account 50,000, max loss 2,000. Lock threshold = 50,100.
      // Peak = 53,000. Raw floor = 53,000 - 2,000 = 51,000.
      // Since 51,000 >= 50,100, floor MUST cap at 50,100.
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 53000,
        currentEquity: 52000,
        isFunded: true,
      };

      const result = calculateDrawdown(input);

      expect(result.rawFloor).toBe(51000);
      expect(result.lockThreshold).toBe(50100);
      expect(result.floor).toBe(50100);
      expect(result.isLocked).toBe(true);
      // Buffer = 52,000 - 50,100 = 1,900
      expect(result.buffer).toBe(1900);
      expect(result.state).toBe('HEALTHY');
      expect(result.explanation).toContain('Funded Lock Barrier Active');
    });

    it('locks floor exactly at Starting Balance + $100 when raw floor equals threshold exactly', () => {
      // Account 100,000, max loss 3,000. Lock threshold = 100,100.
      // Peak = 103,100 -> raw floor = 100,100.
      const input: DrawdownCalculationInput = {
        accountSize: 100000,
        maxLoss: 3000,
        model: 'INTRADAY',
        peakValue: 103100,
        currentEquity: 102000,
        isFunded: true,
      };

      const result = calculateDrawdown(input);

      expect(result.rawFloor).toBe(100100);
      expect(result.floor).toBe(100100);
      expect(result.isLocked).toBe(true);
    });

    it('does not lock floor on funded accounts if raw floor has not yet reached Starting Balance + $100', () => {
      // Account 50,000, max loss 2,500. Lock threshold = 50,100.
      // Peak = 51,000 -> raw floor = 48,500 (< 50,100).
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2500,
        model: 'INTRADAY',
        peakValue: 51000,
        currentEquity: 50500,
        isFunded: true,
      };

      const result = calculateDrawdown(input);

      expect(result.rawFloor).toBe(48500);
      expect(result.floor).toBe(48500);
      expect(result.isLocked).toBe(false);
    });
  });

  describe('Exact breach boundaries and health state transitions', () => {
    it('marks state as BREACHED when current_equity === floor (exact boundary)', () => {
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 48000, // Exactly at floor
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.floor).toBe(48000);
      expect(result.buffer).toBe(0);
      expect(result.state).toBe('BREACHED');
      expect(result.stateColorHex).toBe('#ED4245');
    });

    it('marks state as BREACHED when current_equity < floor (below boundary)', () => {
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 47999.5,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.state).toBe('BREACHED');
      expect(result.buffer).toBe(-0.5);
    });

    it('marks state as CRITICAL when 0 < buffer < 500', () => {
      // Floor = 48,000. Equity = 48,250 -> buffer = 250
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 48250,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.state).toBe('CRITICAL');
      expect(result.buffer).toBe(250);
      expect(result.stateColorHex).toBe('#FEE75C');
      expect(result.explanation).toContain('HIGH RISK WARNING');
    });

    it('marks state as HEALTHY when buffer is exactly 500', () => {
      // Floor = 48,000. Equity = 48,500 -> buffer = 500
      const input: DrawdownCalculationInput = {
        accountSize: 50000,
        maxLoss: 2000,
        model: 'INTRADAY',
        peakValue: 50000,
        currentEquity: 48500,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.state).toBe('HEALTHY');
      expect(result.buffer).toBe(500);
      expect(result.stateColorHex).toBe('#57F287');
    });

    it('marks state as HEALTHY when buffer > 500', () => {
      const input: DrawdownCalculationInput = {
        accountSize: 150000,
        maxLoss: 4500,
        model: 'INTRADAY',
        peakValue: 150000,
        currentEquity: 150000,
        isFunded: false,
      };

      const result = calculateDrawdown(input);

      expect(result.state).toBe('HEALTHY');
      expect(result.buffer).toBe(4500);
    });
  });

  describe('Input validation', () => {
    it('throws error for non-positive accountSize', () => {
      expect(() =>
        calculateDrawdown({
          accountSize: 0,
          maxLoss: 2000,
          model: 'INTRADAY',
          peakValue: 50000,
          currentEquity: 50000,
        })
      ).toThrow('Account size must be greater than 0.');
    });

    it('throws error for non-positive maxLoss', () => {
      expect(() =>
        calculateDrawdown({
          accountSize: 50000,
          maxLoss: 0,
          model: 'INTRADAY',
          peakValue: 50000,
          currentEquity: 50000,
        })
      ).toThrow('Max loss must be greater than 0.');
    });
  });
});
