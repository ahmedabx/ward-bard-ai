// Shared NCBI Entrez retrieval. Used by both the pubmed-search proxy (for the
// Evidence panel) and ward-bard-chat (to ground the model in real evidence).
// All retrieval is scoped to the CURRENT guideline window: 2022 -> next year.

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

export const MIN_DATE = "2022/01/01";
export const MAX_DATE = `${new Date().getFullYear() + 1}/12/31`;

export interface PubMedResult {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
}

export interface RetrievalOutcome {
  results: PubMedResult[];
  /** true when Entrez errored/timed out — distinct from "searched, found nothing". */
  failed: boolean;
  window: { from: string; to: string };
}

export function sanitizeTerm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[^\w\s\-+().,/:'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 300);
}

// Natural-language question words never help a PubMed term and can null out
// a search entirely. Strip them before querying Entrez.
const QUESTION_STOPWORDS = new Set([
  "what", "whats", "which", "why", "how", "when", "where", "who", "whom",
  "is", "are", "was", "were", "be", "been", "the", "a", "an", "of", "for",
  "to", "in", "on", "and", "or", "do", "does", "did", "can", "could",
  "should", "would", "will", "my", "me", "i", "you", "your", "please",
  "tell", "explain", "give", "about", "current", "latest", "best", "with",
  "that", "this", "it", "its", "there", "any", "some",
]);

/** Reduces a chat question to a keyword term Entrez can actually match. */
export function toSearchTerm(raw: string): string {
  const words = raw
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !QUESTION_STOPWORDS.has(w));
  const term = words.slice(0, 12).join(" ").trim();
  return term || raw.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// NCBI allows ~3 requests/sec without an API key; a burst returns 429.
async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: ctrl.signal });
      if (resp.status === 429) {
        await resp.body?.cancel();
        lastErr = new Error("Entrez HTTP 429 (rate limited)");
        await sleep(400 * (attempt + 1));
        continue;
      }
      if (!resp.ok) {
        throw new Error(`Entrez HTTP ${resp.status} for ${url.split("?")[0]}`);
      }
      return await resp.json();
    } catch (e) {
      lastErr = e;
      if (attempt === 2) break;
      await sleep(300);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Entrez request failed");
}


async function fetchIds(
  term: string,
  opts: { sort?: string; retmax?: number } = {},
): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term,
    retmax: String(opts.retmax ?? 3),
    sort: opts.sort ?? "relevance",
    retmode: "json",
    datetype: "pdat",
    mindate: MIN_DATE,
    maxdate: MAX_DATE,
  });
  const data = await fetchJson(`${ESEARCH}?${params}`) as
    | { esearchresult?: { idlist?: string[] } }
    | null;
  return data?.esearchresult?.idlist ?? [];
}

async function fetchSummary(ids: string[]): Promise<PubMedResult[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
  });
  const data = await fetchJson(`${ESUMMARY}?${params}`) as
    | { result?: Record<string, Record<string, unknown>> }
    | null;
  const result = data?.result;
  if (!result) return [];
  return ids
    .map((pmid): PubMedResult | null => {
      const r = result[pmid];
      if (!r) return null;
      const authors = Array.isArray(r.authors) ? r.authors as { name?: string }[] : [];
      const firstAuthor = authors[0]?.name || "Unknown";
      const authorLine = authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor;
      const pubdate = String(r.pubdate || "");
      const year = (pubdate.match(/\d{4}/) || [""])[0];
      return {
        pmid,
        title: String(r.title || "Untitled"),
        authorLine,
        journal: String(r.fulljournalname || r.source || ""),
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    })
    .filter((x): x is PubMedResult => x !== null);
}

const GUIDELINE_FILTER =
  '("guideline"[pt] OR "practice guideline"[pt] OR "consensus development conference"[pt])';
const REVIEW_FILTER =
  '("systematic review"[pt] OR "meta-analysis"[pt] OR "review"[pt])';

/**
 * Layered retrieval, all inside the 2022+ window:
 * guidelines -> high-level reviews -> best relevance match.
 * Throws nothing: failures are reported via `failed` and logged loudly.
 */
export async function retrieveEvidence(
  rawTerm: string,
  max = 6,
): Promise<RetrievalOutcome> {
  const term = toSearchTerm(rawTerm);
  const attempts: Array<{ term: string; retmax: number; sort?: string }> = [
    { term: `${term} AND ${GUIDELINE_FILTER}`, retmax: 3 },
    { term: `${term} AND ${REVIEW_FILTER}`, retmax: 3 },
    { term, retmax: 3 },
    { term, retmax: 3, sort: "pub_date" },
  ];

  const ids: string[] = [];
  let anySuccess = false;
  let anyFailure = false;

  for (const a of attempts) {
    if (ids.length >= max) break;
    try {
      const found = await fetchIds(a.term, a);
      anySuccess = true;
      for (const id of found) if (!ids.includes(id)) ids.push(id);
      await sleep(350); // stay under NCBI's ~3 req/sec keyless limit

    } catch (e) {
      anyFailure = true;
      console.error(
        `[pubmed] esearch FAILED term="${a.term}" window=${MIN_DATE}..${MAX_DATE}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  const window = { from: MIN_DATE, to: MAX_DATE };
  if (!ids.length) {
    if (anyFailure && !anySuccess) {
      console.error(`[pubmed] retrieval unavailable for term="${term}"`);
      return { results: [], failed: true, window };
    }
    console.warn(`[pubmed] no results in window for term="${term}"`);
    return { results: [], failed: false, window };
  }

  try {
    const results = await fetchSummary(ids.slice(0, max));
    console.log(
      `[pubmed] term="${term}" window=${MIN_DATE}..${MAX_DATE} -> ${results.length} sources (PMIDs: ${ids.slice(0, max).join(",")})`,
    );
    return { results, failed: false, window };
  } catch (e) {
    console.error(
      "[pubmed] esummary FAILED:",
      e instanceof Error ? e.message : e,
    );
    return { results: [], failed: true, window };
  }
}

/** Renders retrieved evidence as a structured block for the model prompt. */
export function formatEvidenceForPrompt(outcome: RetrievalOutcome): string {
  if (outcome.failed) {
    return `RETRIEVED EVIDENCE: RETRIEVAL_FAILED — the PubMed evidence service could not be reached.`;
  }
  if (!outcome.results.length) {
    return `RETRIEVED EVIDENCE: NONE — no PubMed records published between ${outcome.window.from} and ${outcome.window.to} matched this query.`;
  }
  const lines = outcome.results.map((r, i) =>
    `[${i + 1}] ${r.title} — ${r.journal || "Journal n/a"}, ${r.year || "year n/a"}. ${r.authorLine}. PMID ${r.pmid}. ${r.url}`
  );
  return `RETRIEVED EVIDENCE (PubMed, published ${outcome.window.from}–${outcome.window.to}):\n${lines.join("\n")}`;
}
