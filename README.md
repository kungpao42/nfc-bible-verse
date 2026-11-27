# nfc-bible-verse

The Bible-verse page behind **031600.xyz/verse.htm**, opened by tapping an NFC bracelet.

- **Page:** designed in Astro (`src/pages/verse.astro`), built as a static template
- **Worker:** `worker/index.js` serves `/verse.htm` and fills the template with the day's verse (complete HTML, no client-side fetch)
- **Verse source:** `https://bible-api.com/data/web/random` (World English Bible, public domain)
- **Schedule:** a new verse at **05:00 UTC** (cron), stored in Workers KV until the next day. If the cron misses, the first visit after 05:00 UTC fetches it
- **Parsing:** `worker/parse.js` validates bible-api's response and normalizes it (tests in `test/`)

## Routes

| Path | What |
|---|---|
| `/verse.htm` | Today's verse |
| `/verse.htm?fresh=1` | Preview a brand-new random verse (not saved) for testing parsing and design |
| `/api/verse` | Today's verse as JSON (`?fresh=1` also returns bible-api's raw response) |
| `/` | Redirects to `/verse.htm` |

## Settings to iterate on (`[vars]` in `wrangler.toml`)

| Var | Default | Effect |
|---|---|---|
| `KEEP_LINE_BREAKS` | `"true"` | Keep poetry line breaks; `"false"` = one paragraph |
| `REJECT_FRAGMENTS` | `"true"` | `"true"` = refetch verses that start mid-sentence or end on a comma |
| `MAX_TRIES` | `"5"` | Refetch attempts when rejecting fragments |
| `BOOKS` | Psalms, Proverbs, Isaiah, Gospels, Epistles | bible-api book IDs to draw from; empty = whole Bible |

## Setup

```bash
npm install
npx wrangler kv namespace create VERSES   # paste the id into wrangler.toml
npm test          # parser tests
npm run dev       # design the page with a placeholder verse
npm run preview   # build + run the full Worker locally
npm run deploy    # build + deploy
```

For Cloudflare Workers Builds (Git-connected): build command `npm run build`, deploy command `npx wrangler deploy`.

When 031600.xyz is active in Cloudflare, uncomment `routes` in `wrangler.toml`.

## Parsed verse format

```json
{
  "reference": "Psalm 90:15",
  "book": "Psalm", "bookId": "PSA", "chapter": 90, "verse": 15,
  "lines": ["first line,", "second line."],
  "text": "first line, second line.",
  "translation": { "id": "web", "name": "World English Bible", "license": "Public Domain" },
  "day": "2026-11-26",
  "fetchedAt": "2026-11-26T05:00:01.234Z"
}
```

## Programming a band (iPhone, NFC Tools)

NFC Tools → **Write** → **Add a record** → **URL/URI** → `https://031600.xyz/verse.htm` → **Write**, and hold the top of the phone to the band. Don't use "Lock tag": locking is permanent.
