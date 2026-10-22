import { useMemo } from 'react';
import { QuoteError, quoteProduct, validateLoanTerms, type LoanProduct, type LoanQuote } from '../../../shared/lending';

/** Calendar date in the cooperative's time zone (the server uses the same). */
export function manilaToday(at = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/**
 * The same quote the server computes, for the amount and term as typed.
 * `errors` carries the product-limit messages for the form fields.
 */
export function useLoanQuote(product: LoanProduct | null | undefined, amount: string, termMonths: string, startDate = manilaToday()) {
  return useMemo(() => {
    if (!product) return { quote: null as LoanQuote | null, errors: {} as Record<string, string>, error: null as string | null };
    const terms = validateLoanTerms(product, amount, termMonths);
    if (!terms.ok || !terms.value) return { quote: null, errors: terms.errors as Record<string, string>, error: null };
    try {
      return { quote: quoteProduct(product, terms.value.principal, terms.value.termMonths, startDate), errors: {}, error: null };
    } catch (err) {
      return { quote: null, errors: {}, error: err instanceof QuoteError ? err.message : 'These terms cannot be calculated.' };
    }
  }, [product, amount, termMonths, startDate]);
}
