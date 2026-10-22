# Prompt: Self-service savings deposits and withdrawals in the client portal

## Goal

Let members move money in and out of their own savings account from the client portal:

1. **Deposits:** fully automatic, through a payment provider. The member pays, the provider confirms, and the account is credited with no staff step.
2. **Withdrawals:** automatic up to a daily limit, paid out through the provider. Anything above the limit becomes a withdrawal request that branch staff approve, as it does today.
3. **Manual deposit at the counter:** stays exactly as it is, for walk-in members.

The ledger must stay correct. A member's balance changes only when real money has arrived or has actually been sent.

## Context: what exists today

Read these before changing anything, and follow their patterns (naming, money handling, idempotency, tests):

- `src/savings/service.ts`, `src/savings/tables.ts`, `shared/lending/savings.ts`: the savings domain, including posting deposits and withdrawals and the withdrawal-request flow.
- `src/branch/services/index.ts`, `src/branch/components/SavingsDialogs.tsx`, `src/routes/branchRoutes.ts`: the staff counter deposit and withdrawal, which already use idempotency keys.
- `src/portal/services/savings.ts`: the member API client (accounts, statement, withdrawal requests, cancel).
- `src/components/ClientPortalView.tsx`: the **Savings & Passbook** tab, the virtual savings card and the withdrawal form.
- `server.ts`: the `/api/client/savings/*` and `/api/branch/savings/*` routes.
- `src/auth/permissions.ts`: `process_savings_deposits`, `process_savings_withdrawals`.
- Migrations go in **both** `supabase/migrations/` and `database/migrations/`, following each folder's numbering.
- Existing tests: `src/savings/service.db.test.ts`, `shared/lending/savings.test.ts`, `src/client/isolation.db.test.ts`.

Money is handled as exact centavos (pesos-and-centavos strings parsed to integer cents). Never use floating point for amounts.

## Design requirements

### 1. Payment provider adapter (provider-agnostic)

- Create a `PaymentProvider` interface in a new module (for example `src/payments/`) with:
  - `createCheckout({ intentId, amountCents, description, successUrl, cancelUrl })` → `{ checkoutUrl, providerRef }`
  - `verifyWebhook(rawBody, headers)` → a verified, normalized event, or a thrown error
  - `createPayout({ payoutId, amountCents, channel, accountNumber, accountName })` → `{ providerRef, status }`
  - `getPayout(providerRef)` → current status
- Ship two implementations:
  - **`mock`**: the default in development and tests. It simulates checkout success and failure and payout success and failure, so the whole flow can be exercised locally with no account.
  - **One real provider** (PayMongo, Xendit or Maya Business), chosen by env var. Keep all provider-specific code inside its adapter.
- Configure the provider through env vars (`PAYMENT_PROVIDER`, keys, webhook secret). Never commit keys, and add placeholders to the example env file.

### 2. Automatic deposits

- New table `savings_deposit_intents` with: id, member id, savings account id, amount (cents), channel, status (`pending` → `paid` | `failed` | `expired` | `cancelled`), provider ref, the ledger transaction id once posted, and timestamps.
- `POST /api/client/savings/deposits`: the member picks an account they own and an amount (enforce minimum and maximum). The endpoint creates the intent, calls `createCheckout` and returns the checkout URL.
- `POST /api/payments/webhook` (public, no session):
  - Verify the signature with `verifyWebhook` and reject anything unverified.
  - On a "paid" event, post the deposit through the **same savings service function the counter deposit uses**, with the intent id as the idempotency key, so a repeated webhook can never credit twice.
  - The amount credited is the amount the provider reports as paid. If it doesn't match the intent, flag the intent for staff review instead of posting.
  - Record channel `ONLINE` and the provider ref on the ledger entry and receipt.
- Never credit the account from the browser's success redirect. The success page only shows "Processing…" and polls `GET /api/client/savings/deposits/:id` until the webhook has posted it.
- A scheduled job (or a check on read) expires intents left pending for more than 24 hours.

### 3. Automatic withdrawals with a daily limit

- Config values in the existing configuration or settings table, not hard-coded:
  - `SELF_SERVICE_WITHDRAWAL_DAILY_LIMIT` (default ₱5,000 per member per day)
  - per-transaction minimum and maximum
  - the account's minimum maintaining balance, taken from the savings product rather than the hard-coded `1000` in `ClientPortalView.tsx`
- `POST /api/client/savings/withdrawals`: the member gives an account, amount, payout channel (GCash, Maya, bank) and destination account, and confirms with an OTP.
  - **Within the limit** (today's self-service total + this amount ≤ the daily limit, the account is active and not frozen, and enough is available above the minimum balance):
    1. In one database transaction, lock the account row, re-check the available balance, create a `savings_payouts` row and post the withdrawal with the payout id as the idempotency key. This debits first, so the same money can't be withdrawn twice.
    2. Call `createPayout`.
    3. If the payout fails, post a reversing credit (idempotent, linked to the payout) and mark the payout `failed`. Webhook and polling updates move it to `paid` or `failed`.
  - **Above the limit:** create a normal withdrawal request through the existing request flow, for staff approval, and tell the member that.
- Only pay out to destinations in the member's own name. Store each member's verified payout destination, and require staff approval (or an OTP plus a 24-hour cooling-off period) the first time a new destination is added.
- Rate-limit the endpoint and log every attempt, including failures, in the audit log.

### 4. Member portal UI (Savings & Passbook tab)

- Add **Add Money** and **Withdraw** buttons next to the balance.
- **Add Money:** account, amount, channel, then a redirect to checkout, then a return page with live status and a receipt once posted.
- **Withdraw:** show the available amount, today's remaining instant limit, a destination picker and an OTP step. Say plainly whether this withdrawal will be instant or sent to staff for approval *before* the member confirms.
- History shows online deposits, instant withdrawals, pending and failed ones, and reversals, each with a receipt where one exists.
- Error messages must be human (insufficient balance, over the limit, account frozen, payment failed, payout failed with the money returned).

### 5. Staff and admin side

- In Savings Management, show online deposits and instant payouts in the ledger with their channel and provider ref.
- Add a **Needs review** list for mismatched amounts, failed payouts and stuck intents, with actions to resolve them that are audit-logged and need the existing savings permissions.
- Add a daily reconciliation report: provider-confirmed totals against ledger totals per day, with any differences listed.
- Counter deposits and withdrawals stay unchanged.

## Security and correctness rules (must hold)

- A member can only act on their own savings accounts. Extend `src/client/isolation.db.test.ts` to cover this.
- Every ledger post is idempotent: a webhook delivered twice, a double-clicked button or a retried request posts once.
- Balance checks and debits happen inside one transaction with a row lock, so two parallel withdrawals can't overdraw.
- Webhooks are signature-verified, and the handler is safe to replay.
- Provider secrets never reach the browser or the logs.
- Server uploads and webhooks use the service role correctly. Don't regress the fix in commit `831f76e`.

## Tests

Use the mock provider:

- A deposit is credited once on the paid webhook, even when the webhook is delivered twice.
- A redirect alone never credits. A failed or expired payment never credits. A mismatched amount is flagged and not posted.
- A withdrawal within the limit debits and pays out. A failed payout is reversed so the balance is restored.
- A withdrawal over the daily limit (including several smaller ones that add up past it) becomes a staff request.
- Withdrawals can't take the account below the minimum balance or touch a frozen account.
- Two parallel withdrawals can't overdraw.
- Member A can't deposit to, withdraw from or see intents for member B's account.
- Existing counter deposit and withdrawal tests still pass.

## Out of scope

- Loan repayments through the gateway (a later task, which can reuse the same adapter).
- Changing the counter deposit and withdrawal flows.

## Definition of done

- Migrations added in both migration folders. The app runs locally end to end with `PAYMENT_PROVIDER=mock`.
- All new and existing tests pass, and typecheck and lint are clean.
- A short `docs/PAYMENTS.md` explains the env vars, how to switch providers, how to test webhooks locally and how reconciliation works.
- No real provider keys in the repo.
