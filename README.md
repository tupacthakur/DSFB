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
- **CSV upload**: Use a CSV with a **date** column and a **revenue/sales** column (optionally **cost**, **covers**). Column names are auto-detected (e.g. `date`, `revenue`, `sales`, `amount`, `cost`, `covers`, `guests`). After upload, Executive stats and SAGE context update from your data.

## Run the project

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure an Anthropic API key in **Settings** for SAGE Chat and Executive Briefing.

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
