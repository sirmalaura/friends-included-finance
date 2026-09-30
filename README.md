# Friends Included finance system

Day 4 homework application for Laura Sirmā. This is a Next.js application with a Telegram webhook, Supabase records, and a Google Sheets mirror. Supabase is the source of truth. The website and Telegram bot call the same validation, submission, approval, synchronization, and notification functions.

Live application: https://friends-included-finance-one.vercel.app

Telegram bot: https://t.me/weeeeding_bot

View-only transaction sheet: https://docs.google.com/spreadsheets/d/1KkeqBKxtNjyH-92KM7ZPDA-0gJLf-x-DzUrhSY4IH_M/edit

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

## Requirements checklist and live verification

- [x] Supabase tables store employees, Telegram links, original proposals, final decisions, submission times, sources, original bot chat IDs, sync and notification statuses, and captured test checkpoints. Anonymous clients have no table policies. The server role has table grants.
- [x] The Vercel website has Laura's name, the five-role demonstration selector, sale and expense forms, manager decisions, a dynamic financial dashboard, completed Test 1 and Test 2 checkpoint results, and links to the bot, sheet, and GitHub. A page refresh preserved the records.
- [x] Telegram `/sale` and `/expense` submissions and website forms use the same server functions. S01 and E01 were submitted through the actual bot and confirmed. The bot link was changed from Richard to Kevin; their stored originating chat IDs remained intact and both decisions reached that chat.
- [x] Sales stay pending until manager approval, with zero approved income and commission. Expenses reduce company result immediately; overhead allocates automatically; A and B expenses await allocation. The manager can preserve or change proposed splits and allocations. Commission pool and individual shares round to cents with specified tie order.
- [x] Test 1 used the exact S01–S02 and E01–E03 records. Before decisions the company result was −€300 and both project results were €0. After decisions: A €700, B €1,800, company €2,400, earned commission Richard €90, Anastasia €110, Jean-Claude €100.
- [x] Test 2 retained Test 1 and used the exact S03–S05 and E04–E07 records. After decisions: A €2,050, B €2,180, company €3,930, cumulative commission €140 / €175 / €215. S05 is €600 pending and E07 is €140 awaiting allocation. These are saved live checkpoints; application calculations remain dynamic for future records.
- [x] The bot delivered the S01, E01, S03, E04, and E05 decision messages. Screenshots from the recipient confirmed the S03 changed split and E05 move from A to B. S02 and S04 show `No Telegram recipient linked`, as expected for website sales without a linked salesperson.
- [x] The Sales sheet has five unique reference rows and the Expenses sheet seven. Manager decisions updated existing rows; original and final values remain in separate columns. An unauthenticated CSV request read the sheet with Viewer link access.
- [x] Server requests denied a 60/30/20 split, Richard's attempted approval, Kevin's attempted sale, and zero or missing expense amounts. A duplicate S01 returned an error. Reapproving S01 reported `alreadyApproved` and left counts and totals unchanged. A webhook request without its secret returned HTTP 401.
- [x] A controlled invalid Sheets destination made S05 show `Sync failed` while saved totals stayed unchanged. After restoring the destination, the website Retry returned `Synced`; S05 remained on Sales row 6 with one reference row.
- [x] An unreachable Telegram chat made E05's notification status `Failed` while its allocation stayed saved. Restoring the chat and using Retry returned `Sent` without changing totals.
- [x] The public website HTML and tracked Git files contain no bot token, Supabase secret, or Google private key. Secrets are in server-side Vercel variables.
