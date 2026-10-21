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
