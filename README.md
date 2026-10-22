<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/94e2e037-7295-4034-9b69-68da7c1c4f82

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Build the database (the server creates no tables itself):
   `npm run db:migrate` then `npm run db:seed`
   - It applies `database/migrations` in the order listed in `database/migrations/APPLY_ORDER.txt`.
   - An existing database that predates `schema_migrations` needs `npm run db:migrate -- --baseline-through <last file it already has>` once.
   - A non-local host needs `--yes`, after a backup.
   - For a throwaway local Postgres, run `npm run db:local`.
   - `npm run db:verify` checks that the migrations match the code's schema.
4. Run the app:
   `npm run dev`

## Online savings payments

Members can deposit online and withdraw instantly from the portal's Savings page; staff handle problems under **Online Payments** in the staff app (Needs review, Daily report).

- `PAYMENT_PROVIDER=mock` (the default outside production) uses a built-in test provider: "Deposit online" opens a test checkout page on this server, where you can pay, pay a different amount, send the confirmation twice or not at all. No account and no real money. Test payouts to an account number ending in `0000` fail after a moment and are refunded; ending in `9999` are refused at once.
- `PAYMENT_PROVIDER=xendit` with `XENDIT_SECRET_KEY` and `XENDIT_WEBHOOK_TOKEN`. Point Xendit's invoice and payout webhooks to `<PUBLIC_BASE_URL>/api/payments/webhooks/xendit`. Check the whole flow with a test-mode key before using a live key.
- A deposit is credited only when the provider confirms it to the server, never because the member's browser came back; each payment is credited once however often the provider confirms it.
- Instant withdrawals go only to a bank or e-wallet account in the member's own name that branch staff have verified once, need a one-time code sent by email, and are limited per day (`ONLINE_WITHDRAWAL_DAILY_LIMIT`, default PHP 5,000). More than that is a withdrawal request to the branch, as before. A failed payout is returned to savings automatically.
- Withdrawal codes are sent with the same email settings as the registration codes (`GMAIL_USER`/`SMTP_*`); without them, the code is printed in the server log.
- Counter deposits and withdrawals are unchanged.
