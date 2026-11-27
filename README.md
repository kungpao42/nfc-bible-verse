# nfc-bible-verse

The Bible-verse page behind **031600.xyz/verse**, opened by tapping an NFC bracelet.

## Have a bracelet that stopped working?

Many NFC Bible-verse bracelets sold on Amazon were programmed to open **gdbracelets.com**. That site has gone offline, so tapping those bracelets now leads nowhere.

The chip inside many of them can be rewritten. If yours can, point it at this site and it works again, with a new verse every day:

1. Install **NFC Tools** (free on iPhone and Android).
2. Tap **Read** and hold your phone to the bracelet. Look for **Writable: Yes**.
   If it says **No**, the chip was locked at the factory and can't be changed by anyone, sorry.
3. Tap **Write** → **Add a record** → **URL/URI**, and enter `https://031600.xyz/verse`.
4. Tap **Write** and hold your phone to the bracelet again. Tap it once more to test.

Don't use NFC Tools' **Lock tag** option. Locking is permanent.

**What you'll see:** one verse a day for everyone, changing at midnight Eastern, drawn from Psalms, Proverbs, Isaiah, the Gospels and the Epistles (World English Bible). It may not match exactly what gdbracelets.com showed.

**Prefer not to depend on someone else's domain?** That's what happened with gdbracelets.com. This repo is everything needed to run your own copy on Cloudflare's free plan (see [Setup](#setup)); then write your own domain to the bracelet instead.

*This project isn't affiliated with gdbracelets.com or any bracelet seller. It's free and has no ads.*

---

- **Page:** designed in Astro (`src/pages/verse.astro`), built as a static template
- **Worker:** `worker/index.js` serves `/verse` (and `/verse.htm`) and fills the template with the day's verse (complete HTML, no client-side fetch)
- **Verse source:** `https://bible-api.com/data/web/random` (World English Bible, public domain), limited to **Psalms, Proverbs, Isaiah, the Gospels and the Epistles (Romans–Jude)**. Verses that start mid-sentence or end on a comma are skipped
- **Schedule:** a new verse at **05:00 UTC** (cron), stored in Workers KV until the next day. If the cron misses, the first visit after 05:00 UTC fetches it
- **Parsing:** `worker/parse.js` validates bible-api's response and normalizes it (tests in `test/`)

## Caching

- One verse per day, stored in Workers KV under that day's key (the day starts at 05:00 UTC)
- Each Cloudflare location holds the KV value for up to 1 hour (never past 05:00 UTC; 60 s for the first 10 minutes after it), so most taps skip the KV read
- Changing `BOOKS` replaces today's verse within about an hour of the deploy

## Routes

| Path | What |
|---|---|
| `/verse`, `/verse.htm` | Today's verse (same page) |
| `/verse?fresh=1` | Preview a brand-new random verse (not saved) for testing parsing and design |
| `/api/verse` | Today's verse as JSON (`?fresh=1` also returns bible-api's raw response) |
| `/` | Redirects to `/verse` |

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

NFC Tools → **Write** → **Add a record** → **URL/URI** → `https://031600.xyz/verse` → **Write**, and hold the top of the phone to the band. Don't use "Lock tag": locking is permanent.
