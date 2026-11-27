// Worker for 031600.xyz
//
//   /verse, /verse.htm   today's verse (Astro-built template, filled in here)
//   /verse?fresh=1       preview: a brand-new random verse, NOT saved (for testing parsing/design)
//   /api/verse         today's verse as JSON   (?fresh=1 also includes bible-api's raw response)
//   /                    redirects to /verse
//
// A cron at 05:00 UTC fetches the next verse into KV. If the cron ever misses,
// the first request of the day does the fetch instead.

import { parseVerse, looksComplete, VerseParseError } from "./parse.js";

const API_URL = "https://bible-api.com/data/web/random";
const ROLLOVER_HOUR_UTC = 5; // keep in sync with the cron in wrangler.toml

export { kvCacheTtl, verseDay };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const fresh = url.searchParams.has("fresh");

    if (url.pathname === "/") {
      return Response.redirect(new URL("/verse", url), 302);
    }

    if (url.pathname === "/verse" || url.pathname === "/verse.htm") {
      const verse = fresh ? (await fetchVerse(env)).verse : await getTodaysVerse(env);
      const template = await env.ASSETS.fetch(new URL("/verse.html", url));
      const html = fillTemplate(template, verse);
      html.headers.set("content-type", "text/html; charset=utf-8");
      html.headers.set("cache-control", fresh ? "no-store" : "public, max-age=300");
      return html;
    }

    if (url.pathname === "/api/verse") {
      const body = fresh ? await fetchVerse(env) : await getTodaysVerse(env);
      return Response.json(body, {
        headers: { "cache-control": fresh ? "no-store" : "public, max-age=300", "access-control-allow-origin": "*" },
      });
    }

    // Don't expose the raw template; everything else is a static asset.
    if (url.pathname === "/verse.html" || url.pathname === "/verse/") {
      return Response.redirect(new URL("/verse", url), 301);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(getTodaysVerse(env, { fromCron: true }));
  },
};

function booksSetting(env) {
  return (env.BOOKS || "").replace(/\s+/g, "") || "";
}

// The "verse day" starts at 05:00 UTC. Key it by that day's date.
function verseDay(now = new Date()) {
  return new Date(now.getTime() - ROLLOVER_HOUR_UTC * 3600_000).toISOString().slice(0, 10);
}

// How long each Cloudflare location may hold today's KV value before re-reading it.
// Up to 1 hour, never past the 05:00 UTC changeover. For the first 10 minutes after
// the changeover it stays at the 60s minimum, because KV can also hold a "not found"
// result and we don't want a location stuck re-fetching from bible-api.
function kvCacheTtl(now = Date.now()) {
  const DAY = 86400;
  const sinceRollover = Math.floor((now / 1000 - ROLLOVER_HOUR_UTC * 3600) % DAY);
  const untilRollover = DAY - sinceRollover;
  if (sinceRollover < 600) return 60;
  return Math.max(60, Math.min(3600, untilRollover));
}

async function getTodaysVerse(env, { fromCron = false } = {}) {
  const day = verseDay();
  const key = `verse:${day}`;

  const books = booksSetting(env);
  const existing = fromCron
    ? await env.VERSES.get(key, "json")
    : await env.VERSES.get(key, { type: "json", cacheTtl: kvCacheTtl() });
  // Keep today's verse (including on a cron re-run) unless the book list was changed since it was fetched.
  if (existing && (existing.books ?? null) === books) return existing;

  try {
    const { verse } = await fetchVerse(env);
    const stored = { ...verse, books, day, fetchedAt: new Date().toISOString() };
    await env.VERSES.put(key, JSON.stringify(stored), { expirationTtl: 60 * 60 * 72 });
    await env.VERSES.put("verse:last", JSON.stringify(stored));
    return stored;
  } catch (err) {
    console.error("verse fetch failed:", err);
    const last = await env.VERSES.get("verse:last", "json");
    if (last) return last;
    return {
      reference: "Psalm 46:1",
      lines: ["God is our refuge and strength,", "a very present help in trouble."],
      text: "God is our refuge and strength, a very present help in trouble.",
      translation: { id: "web", name: "World English Bible", license: "Public Domain" },
      day,
      fallback: true,
    };
  }
}

// Fetch + parse, retrying when the verse is rejected as a fragment (if enabled).
async function fetchVerse(env) {
  const keepLineBreaks = env.KEEP_LINE_BREAKS !== "false";
  const rejectFragments = env.REJECT_FRAGMENTS === "true";
  const maxTries = rejectFragments ? Math.max(1, Number(env.MAX_TRIES) || 5) : 1;

  let lastVerse, lastRaw, lastErr;
  const rejected = [];
  const books = booksSetting(env);
  const apiUrl = books ? `${API_URL}/${books}` : API_URL;

  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch(apiUrl, { headers: { "user-agent": "031600.xyz verse worker" } });
      if (!res.ok) throw new Error(`bible-api HTTP ${res.status}`);
      lastRaw = await res.json();
      lastVerse = parseVerse(lastRaw, { keepLineBreaks });
      if (!rejectFragments || looksComplete(lastVerse)) {
        return { verse: lastVerse, raw: lastRaw, rejected };
      }
      rejected.push(lastVerse.reference);
    } catch (err) {
      lastErr = err;
      if (!(err instanceof VerseParseError)) break; // network/API problem: don't hammer it
    }
  }
  // Every try was a fragment: use the last one rather than nothing.
  if (lastVerse) return { verse: lastVerse, raw: lastRaw, rejected };
  throw lastErr ?? new Error("no verse");
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function prettyDay(day) {
  if (!day) return "";
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

// Fill the Astro template's [data-*] slots with the verse.
function fillTemplate(response, v) {
  const linesHtml = v.lines.map((l) => `<span class="line">${esc(l)}</span>`).join("");
  const share = `“${v.text}” — ${v.reference} (${v.translation.id.toUpperCase()})`;
  return new HTMLRewriter()
    .on("title", { element: (e) => e.setInnerContent(`${v.reference} · Verse of the Day`) })
    .on('meta[name="description"], meta[property="og:description"]', { element: (e) => e.setAttribute("content", v.text) })
    .on('meta[property="og:title"]', { element: (e) => e.setAttribute("content", v.reference) })
    .on("[data-verse-text]", { element: (e) => e.setInnerContent(linesHtml, { html: true }) })
    .on("[data-verse-ref]", { element: (e) => e.setInnerContent(v.reference) })
    .on("[data-verse-date]", { element: (e) => e.setInnerContent(prettyDay(v.day)) })
    .on("[data-verse-translation]", { element: (e) => e.setInnerContent(v.translation.name) })
    .on("[data-verse-share]", { element: (e) => e.setAttribute("data-share-text", share) })
    .transform(response);
}
