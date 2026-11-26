import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVerse, looksComplete, VerseParseError } from "../worker/parse.js";

const sample = (over = {}) => ({
  translation: { identifier: "web", name: "World English Bible", language: "English", language_code: "eng", license: "Public Domain" },
  random_verse: { book_id: "PSA", book: "Psalms", chapter: 90, verse: 15, text: "Make us glad for as many days as you have afflicted us,\nfor as many years as we have seen evil.", ...over },
});

test("parses the live response shape", () => {
  const v = parseVerse(sample());
  assert.equal(v.reference, "Psalm 90:15");
  assert.equal(v.bookId, "PSA");
  assert.deepEqual(v.lines, [
    "Make us glad for as many days as you have afflicted us,",
    "for as many years as we have seen evil.",
  ]);
  assert.equal(v.text, "Make us glad for as many days as you have afflicted us, for as many years as we have seen evil.");
  assert.equal(v.translation.name, "World English Bible");
});

test("trims stray newlines and collapses whitespace", () => {
  const v = parseVerse(sample({ book: "John", book_id: "JHN", chapter: 3, verse: 16, text: "\n  For God so   loved\tthe world, \n\n" }));
  assert.deepEqual(v.lines, ["For God so loved the world,"]);
  assert.equal(v.reference, "John 3:16");
});

test("can flatten line breaks", () => {
  const v = parseVerse(sample(), { keepLineBreaks: false });
  assert.equal(v.lines.length, 1);
});

test("rejects bad responses", () => {
  assert.throws(() => parseVerse(null), VerseParseError);
  assert.throws(() => parseVerse({}), VerseParseError);
  assert.throws(() => parseVerse(sample({ text: " \n " })), VerseParseError);
  assert.throws(() => parseVerse(sample({ chapter: "x" })), VerseParseError);
  assert.throws(() => parseVerse(sample({ book: "" })), VerseParseError);
});

test("fragment heuristic", () => {
  assert.equal(looksComplete(parseVerse(sample())), true);
  assert.equal(looksComplete(parseVerse(sample({ text: "and he said to them," }))), false);
  assert.equal(looksComplete(parseVerse(sample({ text: "“Be still, and know that I am God.”" }))), true);
});
