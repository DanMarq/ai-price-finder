import { createHash } from "crypto";

const COMBINING_DIACRITICS_START = 0x0300;
const COMBINING_DIACRITICS_END = 0x036f;

function stripDiacritics(input: string): string {
  return Array.from(input)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < COMBINING_DIACRITICS_START || code > COMBINING_DIACRITICS_END;
    })
    .join("");
}

export function slugify(input: string): string {
  return stripDiacritics(input.normalize("NFD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function slugWithHash(title: string): string {
  const base = slugify(title).slice(0, 60);
  const hash = createHash("sha256").update(title.toLowerCase().trim()).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function queryHash(query: string): string {
  return createHash("sha256").update(normalizeQuery(query)).digest("hex");
}
