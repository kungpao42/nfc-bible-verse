// Parsing and normalizing verses from bible-api.com
//
// Input (GET https://bible-api.com/data/web/random):
// {
//   "translation": { "identifier": "web", "name": "World English Bible",
//                    "language": "English", "language_code": "eng", "license": "Public Domain" },
//   "random_verse": { "book_id": "PSA", "book": "Psalms", "chapter": 90, "verse": 15,
//                     "text": "line one\nline two" }
// }
//
// Output: a clean verse object the page renders. The page never sees bible-api's raw format.

export class VerseParseError extends Error {}

/**
 * @param {unknown} data  parsed JSON from bible-api
 * @param {{ keepLineBreaks?: boolean }} [opts]
 */
export function parseVerse(data, opts = {}) {
  const keepLineBreaks = opts.keepLineBreaks ?? true;

  if (!data || typeof data !== "object") throw new VerseParseError("response is not an object");
  const rv = data.random_verse;
  if (!rv || typeof rv !== "object") throw new VerseParseError("missing random_verse");

  const book = typeof rv.book === "string" ? rv.book.trim() : "";
  const chapter = Number(rv.chapter);
  const verse = Number(rv.verse);
  if (!book) throw new VerseParseError("missing book");
  if (!Number.isInteger(chapter) || chapter < 1) throw new VerseParseError(`bad chapter: ${rv.chapter}`);
  if (!Number.isInteger(verse) || verse < 1) throw new VerseParseError(`bad verse: ${rv.verse}`);
  if (typeof rv.text !== "string") throw new VerseParseError("missing text");

  // Split into lines, tidy each one, drop empties.
  let lines = rv.text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) throw new VerseParseError("empty text");

  const text = lines.join(" ");
  if (!keepLineBreaks) lines = [text];

  const t = data.translation && typeof data.translation === "object" ? data.translation : {};

  return {
    reference: `${displayBook(book)} ${chapter}:${verse}`,
    book: displayBook(book),
    bookId: typeof rv.book_id === "string" ? rv.book_id : "",
    chapter,
    verse,
    lines,             // for the page (keeps poetry line breaks)
    text,              // single line, for <title>, link previews, sharing
    translation: {
      id: t.identifier || "web",
      name: t.name || "World English Bible",
      license: t.license || "Public Domain",
    },
  };
}

// A single "Psalms" verse is spoken as "Psalm".
function displayBook(book) {
  return book === "Psalms" ? "Psalm" : book;
}

/**
 * Heuristic: does this verse read as a complete thought on its own?
 * Used only when REJECT_FRAGMENTS is on. Tune as we iterate.
 */
export function looksComplete(v) {
  const t = v.text;
  const first = t.replace(/^[“"‘'(\[]+/, "").charAt(0);
  const startsOk = first !== "" && first === first.toUpperCase();
  const endsOk = /[.!?][”"’')\]]*$/.test(t);
  return startsOk && endsOk;
}
