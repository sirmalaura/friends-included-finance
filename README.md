# Friends Included finance system

Day 4 homework application for Laura Sirmā. This is a Next.js application with a Telegram webhook, Supabase records, and a Google Sheets mirror. Supabase is the source of truth. The website and Telegram bot call the same validation, submission, approval, synchronization, and notification functions.

## Setup

1. Create a Supabase project. Run `supabase/schema.sql` in its SQL Editor. Keep the service role key on the server only.
2. Create a Google spreadsheet with tabs named `Sales` and `Expenses`. Enable the Google Sheets API in a Google Cloud project, create a service account and JSON key, and share the spreadsheet with that service account as Editor.
3. Create a Telegram bot through BotFather and start it in a private chat.
4. Set the variables in `.env.example` as Vercel environment variables. The Google private key must include its newlines. Deploy this repository to Vercel.
5. Select Svetlana on the website and click **Connect Telegram bot**. Send `/start` to the bot to get your Telegram user ID and chat ID, then link them to the required fictional employee under Manager setup.

## Bot commands

`/sale S01|Olivia Rose|A|One proud uncle and an emotional grandmother|1000|50|30|20`

`/expense E01|Rented suit and fake pearl necklace for the relatives|Materials|120|A`

The amount is in euros. The three sale percentages are Richard, Anastasia, then Jean-Claude. An unlinked Telegram user cannot submit. The manager changes the current link on the website; previously recorded bot transactions retain their original chat ID.

## Rules

Pending sales are excluded from income and commission. Approved sales create a 10% commission pool. The pool and shares are rounded to cents, with any difference assigned to the largest share, breaking ties Richard, Anastasia, then Jean-Claude. Every saved expense reduces the company result immediately. Project expenses await manager allocation; company overhead is allocated automatically. Decisions update existing records. Repeat approval does not recalculate or duplicate a transaction.

The sheet is a view. A failed update leaves the Supabase transaction saved with a **Sync failed** status, and Svetlana can retry the same reference. Failed Telegram decisions remain saved with a **Failed** status and can be retried.

## Local checks

`npm install` then `npm test` checks the assignment's first and second test totals and financial validation. Live integrations must be tested after deploying with real credentials. No test fixture is automatically loaded into the production database.
