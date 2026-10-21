import { describe, expect, it } from 'vitest';
import {
  applyRate,
  centsFromDb,
  centsToDecimal,
  divRoundHalfUp,
  formatPeso,
  formatPercent,
  parsePercent,
  parsePesos,
  ppmFromDb,
  ppmToPercent,
  splitEvenly,
} from './money';

describe('money parsing', () => {
  it('reads pesos into exact centavos', () => {
    expect(parsePesos('1234.5')).toBe(123450);
    expect(parsePesos('1,234.56')).toBe(123456);
    expect(parsePesos(0.3)).toBe(30);
    expect(parsePesos(10000)).toBe(1000000);
  });

  it('refuses sub-centavo, negative, float-noise and non-numeric input', () => {
    expect(parsePesos('1.005')).toBeNull();
    expect(parsePesos('-5')).toBeNull();
    expect(parsePesos(0.1 + 0.2)).toBeNull();
    expect(parsePesos('abc')).toBeNull();
    expect(parsePesos('')).toBeNull();
    expect(parsePesos(1e21)).toBeNull();
  });

  it('reads database numerics without going through floats', () => {
    expect(centsFromDb('1234.56')).toBe(123456);
    expect(centsFromDb('1234.5')).toBe(123450);
    expect(centsFromDb('99999999999.99')).toBe(9999999999999);
    expect(centsFromDb(1234.5)).toBe(123450);
    expect(centsFromDb(null)).toBe(0);
    expect(() => centsFromDb('1.234')).toThrow();
  });

  it('writes centavos as numeric literals and peso text', () => {
    expect(centsToDecimal(123456)).toBe('1234.56');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(formatPeso(123456789)).toBe('₱1,234,567.89');
  });

  it('reads percentages into ppm exactly', () => {
    expect(parsePercent('12.5')).toBe(125000);
    expect(parsePercent('0.0001')).toBe(1);
    expect(parsePercent(1.25)).toBe(12500);
    expect(parsePercent('1.23456')).toBeNull();
    expect(ppmFromDb('12.5000')).toBe(125000);
    expect(ppmToPercent(125000)).toBe('12.5000');
    expect(formatPercent(125000)).toBe('12.5%');
    expect(formatPercent(120000)).toBe('12%');
  });
});

describe('rounding rule', () => {
  it('rounds half up to the centavo', () => {
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(7n, 2n)).toBe(4n);
    expect(divRoundHalfUp(4n, 3n)).toBe(1n);
    expect(divRoundHalfUp(5n, 3n)).toBe(2n);
  });

  it('applies rates exactly: 2% of 12,345.67 is 246.91 (246.9134)', () => {
    expect(applyRate(1234567, 20000)).toBe(24691);
    // 1% of 0.50 is 0.005, which rounds up to 0.01
    expect(applyRate(50, 10000)).toBe(1);
    // 12% a year for 6 of 12 months on 10,000.00
    expect(applyRate(1000000, 120000, 6, 12)).toBe(60000);
  });

  it('splits totals without losing or inventing centavos', () => {
    expect(splitEvenly(1000000, 6)).toEqual([166667, 166667, 166667, 166667, 166666, 166666]);
    expect(splitEvenly(2, 4)).toEqual([1, 1, 0, 0]);
    const parts = splitEvenly(987654321, 52);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(987654321);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });
});
