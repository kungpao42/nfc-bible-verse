// Daily Bible verse Worker
// - Fetches one random verse per day from bible-api.com
// - Stores it in KV so every visitor worldwide sees the same verse all day
// - A cron trigger pre-fetches the verse at midnight; if the cron ever misses,
//   the first visitor of the day triggers the fetch instead.
// - Every path returns the verse page, so whatever URL path the NFC bands were
//   programmed with will still work. /api/verse returns JSON.

const TIMEZONE = "America/New_York";   // when "today" rolls over
const TRANSLATION = "web";             // World English Bible (public domain)
const BOOKS = "";                      // e.g. "NT", "OT", "PSA,PRO,JHN" — empty = whole Bible
const SITE_NAME = "031600 · Daily Verse";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const verse = await getTodaysVerse(env);

    if (url.pathname === "/api/verse") {
      return new Response(JSON.stringify(verse, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });

    return new Response(renderPage(verse), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        // short edge/browser cache; KV is the real 24h store
        "cache-control": "public, max-age=300",
      },
    });
  },

  // Runs on the cron schedule in wrangler.toml
  async scheduled(event, env, ctx) {
    ctx.waitUntil(getTodaysVerse(env, { force: true }));
  },
};

function todayKey() {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

async function getTodaysVerse(env, { force = false } = {}) {
  const key = `verse:${todayKey()}`;

  if (!force) {
    const cached = await env.VERSES.get(key, "json");
    if (cached) return cached;
  } else {
    // cron: don't overwrite if today's verse already exists
    const existing = await env.VERSES.get(key, "json");
    if (existing) return existing;
  }

  try {
    const verse = await fetchRandomVerse();
    verse.date = todayKey();
    // keep 2 days so a slightly-late cron never leaves a gap
    await env.VERSES.put(key, JSON.stringify(verse), { expirationTtl: 60 * 60 * 48 });
    await env.VERSES.put("verse:last", JSON.stringify(verse)); // fallback if the API is down
    return verse;
  } catch (err) {
    console.error("bible-api fetch failed:", err);
    const last = await env.VERSES.get("verse:last", "json");
    if (last) return last;
    return {
      reference: "Psalm 46:1",
      text: "God is our refuge and strength, a very present help in trouble.",
      translation: "World English Bible",
      date: todayKey(),
    };
  }
}

async function fetchRandomVerse() {
  const path = `https://bible-api.com/data/${TRANSLATION}/random${BOOKS ? "/" + BOOKS : ""}`;
  const res = await fetch(path, {
    headers: { "user-agent": "daily-verse-worker (cloudflare worker)" },
  });
  if (!res.ok) throw new Error(`bible-api returned ${res.status}`);
  const data = await res.json();

  // Response looks like { translation: {...}, random_verse: { book, chapter, verse, text } }
  const v = data.random_verse || data.verse || data;
  if (!v || !v.text) throw new Error("unexpected response shape: " + JSON.stringify(data).slice(0, 200));

  return {
    reference: `${v.book} ${v.chapter}:${v.verse}`,
    text: String(v.text).replace(/\s+/g, " ").trim(),
    translation: data.translation?.name || "World English Bible",
  };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderPage(v) {
  const prettyDate = new Date(v.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(v.reference)} · ${SITE_NAME}</title>
<meta name="description" content="${esc(v.text)}">
<meta property="og:title" content="${esc(v.reference)}">
<meta property="og:description" content="${esc(v.text)}">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 28px; font-family: Georgia, "Times New Roman", serif;
    background: linear-gradient(160deg, #f7f1e6 0%, #e9dcc4 100%); color: #2b2418;
  }
  @media (prefers-color-scheme: dark) {
    body { background: linear-gradient(160deg, #1d1a16 0%, #2c261d 100%); color: #f1e8d8; }
    .card { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.08); }
    .meta, .foot { color: #b9ab93; }
  }
  .card {
    max-width: 640px; width: 100%; padding: 44px 36px; border-radius: 18px;
    background: rgba(255,255,255,.55); border: 1px solid rgba(0,0,0,.06);
    box-shadow: 0 10px 40px rgba(0,0,0,.08); text-align: center;
  }
  .meta { font: 600 13px/1 system-ui, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #8a7553; }
  blockquote { margin: 28px 0 22px; font-size: clamp(22px, 5.2vw, 30px); line-height: 1.45; }
  .ref { font: 600 18px/1.3 system-ui, sans-serif; }
  .foot { margin-top: 30px; font: 13px/1.4 system-ui, sans-serif; color: #8a7553; }
  button {
    margin-top: 22px; padding: 10px 18px; border-radius: 999px; border: 1px solid currentColor;
    background: transparent; color: inherit; font: 500 14px system-ui, sans-serif; cursor: pointer;
  }
</style>
</head>
<body>
  <main class="card">
    <div class="meta">${esc(prettyDate)}</div>
    <blockquote>&ldquo;${esc(v.text)}&rdquo;</blockquote>
    <div class="ref">${esc(v.reference)}</div>
    <button id="share">Share this verse</button>
    <div class="foot">${esc(v.translation)} · A new verse every day</div>
  </main>
<script>
  document.getElementById("share").onclick = async () => {
    const text = ${JSON.stringify(`"${v.text}" — ${v.reference}`)};
    try {
      if (navigator.share) await navigator.share({ text, url: location.origin });
      else { await navigator.clipboard.writeText(text + " " + location.origin); alert("Copied!"); }
    } catch (e) {}
  };
</script>
</body>
</html>`;
}
