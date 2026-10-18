// Search text so "onyame" finds "Ɔnyame" and "ewe" finds "ɛwɛ": lower case, accents and special letters folded.
const FOLD: Record<string, string> = { ɛ: 'e', ɔ: 'o', ŋ: 'n', ɖ: 'd', ƒ: 'f', ɣ: 'g', ʋ: 'v', ɓ: 'b', ɗ: 'd', ƙ: 'k', ƴ: 'y', œ: 'oe' };

export function foldText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[ɛɔŋɖƒɣʋɓɗƙƴœ]/g, (c) => FOLD[c] ?? c);
}

export function matchesQuery(text: string, query: string): boolean {
  const q = foldText(query.trim());
  return !q || foldText(text).includes(q);
}
