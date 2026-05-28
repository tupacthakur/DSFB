# Koravo

Restaurant intelligence and executive reporting — board-ready P&L, health scores, and AI briefings.

## Tech stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **UI** | React 18, Tailwind CSS |
| **State** | Zustand (metrics, settings, chat, ingested context) |
| **Data** | TanStack React Query, TanStack Table |
| **Charts** | Recharts |
| **AI** | Anthropic Claude (SAGE) — chat, executive briefing, insights |
| **Parsing** | PapaParse, xlsx, custom CSV→metrics parser |
| **Export** | jsPDF + jsPDF-AutoTable, Marked + DOMPurify for markdown |
| **Utils** | date-fns, clsx, tailwind-merge |

- **Executive** dashboard: P&L Snapshot, Health Score, Strategic Intelligence, Period Comparison, SAGE Briefing, Strategic Outlook. Stats and charts are driven by the **metrics store**; uploading a CSV in **Analytics → Upload Data** updates that store so Executive numbers reflect your file.
- **File upload (any structure)**: CSV, TSV, Excel (`.xlsx`/`.xls`), JSON/NDJSON, `.txt`/`.log`, and markdown tables. Unstructured text (date + amount per line) is parsed automatically. Preprocessing normalizes format; the interpretation engine infers date/revenue/cost columns and drives Executive stats and SAGE context.
- **Rista POS API**: Set `RISTA_API_KEY` and `RISTA_SECRET_KEY` in `.env.local` (server-only). Use **Analytics → Sync from Rista** to pull the last 30 days from all active outlets. Requires Rista **Sales Enterprise + API licence** for sales endpoints; branch list validates without it.

## Run the project

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure an Anthropic API key in **Settings** for SAGE Chat and Executive Briefing. Add Rista credentials to `.env.local` (see `.env.example`) for live POS sync.

## Production architecture

- `app/*`: frontend pages and UI routing
- `app/api/*`: API handlers only (request parsing + response mapping)
- `lib/server/services/*`: provider integrations and business services
- `lib/server/security/*`: origin checks + rate limiting primitives
- `lib/server/observability/*`: structured logging (secret-safe)
- `lib/server/config/*`: environment loading and validation
- `db/schema.sql`: scalable PostgreSQL analytics schema (fact + dimensions)

## Vercel deployment notes

- Set environment variables from `.env.example` in Vercel Project Settings.
- Do **not** rely on writing `.env.local` from API routes in production.
- `vercel.json` pins API max duration and region for lower latency.
- Security headers are applied globally via `middleware.ts`.
- GitHub remote is expected at `https://github.com/tupacthakur/DSFB.git`.
- Use clean builds to avoid stale Next chunk artifacts:
  - Local: `npm run build:clean`
  - Local dev after heavy branch switches: `npm run dev:clean`
- Recommended deploy flow:
  1. `npm run lint`
  2. `npm run build:clean`
  3. `git push origin <branch>`
  4. Deploy from GitHub in Vercel or run `npx vercel --prod`
