/** Fuzzy catalog matching (fuse.js) on names + aliases. Threshold comes from settings.ingest.matchMaxScore. */
import Fuse from "fuse.js";
import type { Product } from "../domain";

export interface ItemMatch {
  product: Product;
  /** 0 = perfect, higher = worse (Fuse score) */
  score: number;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export function buildMatcher(products: Product[], maxScore = 0.35) {
  const docs = products.map((p) => ({ p, name: norm(p.name), aliases: p.aliases.map(norm) }));
  const fuse = new Fuse(docs, {
    includeScore: true,
    ignoreLocation: true,
    threshold: maxScore,
    keys: [
      { name: "name", weight: 0.6 },
      { name: "aliases", weight: 0.4 },
    ],
  });
  return {
    /** Best match or null. Exact alias/name equality always wins. */
    match(query: string): ItemMatch | null {
      const q = norm(query);
      if (!q) return null;
      const exact = docs.find((d) => d.name === q || d.aliases.includes(q));
      if (exact) return { product: exact.p, score: 0 };
      const [best] = fuse.search(q, { limit: 1 });
      return best ? { product: best.item.p, score: best.score ?? 1 } : null;
    },
    /** Top-n candidates for "did you mean…" prompts. */
    suggest(query: string, n = 3): ItemMatch[] {
      return fuse.search(norm(query), { limit: n }).map((r) => ({ product: r.item.p, score: r.score ?? 1 }));
    },
  };
}

export type Matcher = ReturnType<typeof buildMatcher>;
