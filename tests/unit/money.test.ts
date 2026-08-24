import { describe, expect, it } from 'vitest';
import {
  addMoney,
  compareMoney,
  formatMoney,
  fromMillimes,
  multiplyMoney,
  percentOfMoney,
  subtractMoney,
  toMillimes,
} from '@/lib/money';

/**
 * Money is the highest-consequence arithmetic in the application: an error here
 * is a wrong charge, not a wrong pixel. These cases are the ones that break a
 * float-based implementation.
 */
describe('money', () => {
  it('keeps three decimals — the dinar is millime-denominated', () => {
    expect(toMillimes('19.900')).toBe(19900n);
    expect(fromMillimes(19900n)).toBe('19.900');
    expect(fromMillimes(5n)).toBe('0.005');
  });

  it('survives the classic float failure', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in IEEE 754.
    expect(addMoney('0.100', '0.200')).toBe('0.300');
    expect(addMoney('19.900', '34.500', '45.000')).toBe('99.400');
  });

  it('multiplies by an integer quantity without drift', () => {
    expect(multiplyMoney('19.900', 3)).toBe('59.700');
    expect(multiplyMoney('0.001', 1000)).toBe('1.000');
    expect(() => multiplyMoney('1.000', 1.5)).toThrow();
  });

  it('rounds a percentage half-up to the millime', () => {
    expect(percentOfMoney('19.900', 10)).toBe('1.990');
    expect(percentOfMoney('0.005', 50)).toBe('0.003'); // 0.0025 → half-up
    expect(percentOfMoney('100.000', 15)).toBe('15.000');
  });

  it('subtracts and compares exactly', () => {
    expect(subtractMoney('24.900', '5.000')).toBe('19.900');
    expect(compareMoney('19.900', '19.901')).toBe(-1);
    expect(compareMoney('19.900', '19.900')).toBe(0);
    expect(compareMoney('19.901', '19.900')).toBe(1);
  });

  it('rejects values that are not money', () => {
    expect(() => toMillimes('19.9001')).toThrow();
    expect(() => toMillimes('abc')).toThrow();
    expect(() => toMillimes(Number.NaN)).toThrow();
  });

  it('handles negatives, which refunds need', () => {
    expect(subtractMoney('5.000', '7.500')).toBe('-2.500');
    expect(toMillimes('-2.500')).toBe(-2500n);
  });

  it('formats with three decimals in every locale', () => {
    for (const locale of ['fr', 'en', 'ar']) {
      expect(formatMoney('19.900', locale)).toMatch(/19[.,]900/);
    }
  });
});
