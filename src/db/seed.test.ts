import { describe, expect, it } from 'vitest';
import { validateProduct } from '../../shared/lending';
import { INITIAL_LOAN_PRODUCTS } from '../data/initialData';
import { seedProductDto } from './seed';

describe('seeded loan products', () => {
  it('all satisfy the product rules 0025 enforces', () => {
    expect(INITIAL_LOAN_PRODUCTS.length).toBeGreaterThan(0);
    for (const p of INITIAL_LOAN_PRODUCTS) {
      const v = validateProduct(seedProductDto(p));
      expect(v.errors, p.code).toEqual({});
    }
  });
});
