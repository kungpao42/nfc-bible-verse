# nfc-bible-verse

A Cloudflare Worker behind **031600.xyz** that serves one Bible verse per day. Tapping an NFC bracelet programmed with `https://031600.xyz` opens it.

- Verse source: [bible-api.com](https://bible-api.com) random endpoint, World English Bible (public domain), whole Bible
- Everyone sees the same verse all day; it rolls over at midnight Eastern
- The verse is stored in Workers KV. A daily cron fetches it, and the first visitor fetches it if the cron missed
- Any path returns the verse page. `/api/verse` returns JSON
- If bible-api is down, the last stored verse is shown

## Deploy

```bash
npm install -g wrangler        # or use npx
wrangler login
wrangler kv namespace create VERSES
# paste the printed id into wrangler.toml
wrangler deploy
```

031600.xyz must be added to Cloudflare (nameservers pointed at Cloudflare) before the custom-domain route will attach.

## Settings (top of `src/index.js`)

| Constant | Default | Meaning |
|---|---|---|
| `TIMEZONE` | `America/New_York` | When the day rolls over |
| `TRANSLATION` | `web` | bible-api translation id (`kjv`, `web`, …) |
| `BOOKS` | `""` | Limit books: `NT`, `OT`, or `PSA,PRO,JHN` |

## Programming a band (iPhone, NFC Tools)

1. NFC Tools → **Write** → **Add a record** → **URL/URI**
2. Enter `https://031600.xyz`
3. Tap **Write** and hold the top of the phone to the band
4. Tap the band again to confirm it opens the site

Don't use NFC Tools' "Lock tag" option unless you're sure. Locking is permanent.
