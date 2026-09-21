// Shared NCBI Entrez retrieval. Used by both the pubmed-search proxy (for the
// Evidence panel) and ward-bard-chat (to ground the model in real evidence).
// All retrieval is scoped to the CURRENT guideline window: 2022 -> next year.

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

export const MIN_DATE = "2022/01/01";
export const MAX_DATE = `${new Date().getFullYear() + 1}/12/31`;

export interface PubMedResult {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
  /** Abstract text (may be empty when PubMed has none). */
  abstract?: string;
  /** 0..1 semantic relevance to the user's question. */
  relevance?: number;
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

/** Fetches abstracts for the given PMIDs. Never throws. */
async function fetchAbstracts(ids: string[]): Promise<Record<string, string>> {
  const params = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "xml",
    rettype: "abstract",
  });
  const out: Record<string, string> = {};
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    let xml: string;
    try {
      const resp = await fetch(`${EFETCH}?${params}`, { signal: ctrl.signal });
      if (!resp.ok) throw new Error(`Entrez efetch HTTP ${resp.status}`);
      xml = await resp.text();
    } finally {
      clearTimeout(timer);
    }
    for (const chunk of xml.split(/<PubmedArticle[\s>]/).slice(1)) {
      const pmid = (chunk.match(/<PMID[^>]*>(\d+)<\/PMID>/) || [])[1];
      if (!pmid) continue;
      const parts = [...chunk.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
        .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (parts.length) out[pmid] = parts.join(" ").slice(0, 1600);
    }
  } catch (e) {
    console.warn("[pubmed] efetch abstracts failed:", e instanceof Error ? e.message : e);
  }
  return out;
}

// ---- Semantic relevance re-ranking -------------------------------------
// Scores each candidate against the ORIGINAL question (not the stripped
// keyword bag) over title + abstract, so papers that merely share one
// incidental word are dropped instead of being cited.

function conceptTerms(question: string): string[] {
  const seen = new Set<string>();
  for (const w of question.toLowerCase().replace(/[^\w\s-]/g, " ").split(/\s+/)) {
    const t = w.trim();
    if (t.length < 4 || QUESTION_STOPWORDS.has(t)) continue;
    seen.add(t);
  }
  return [...seen];
}

/** Loose stem match so "anticoagulation" matches "anticoagulant". */
function mentions(haystack: string, term: string): boolean {
  const stem = term.length > 6 ? term.slice(0, Math.max(5, term.length - 3)) : term;
  return haystack.includes(stem);
}

/** Minimum share of the question's concepts a source must cover to be cited. */
const RELEVANCE_FLOOR = 0.3;

function scoreRelevance(
  r: PubMedResult,
  concepts: string[],
  currentYear: number,
): number {
  if (!concepts.length) return 0.5;
  const title = r.title.toLowerCase();
  const haystack = `${title} ${(r.abstract || "").toLowerCase()}`;

  let titleHits = 0;
  let bodyHits = 0;
  for (const c of concepts) {
    if (mentions(title, c)) titleHits++;
    else if (mentions(haystack, c)) bodyHits++;
  }

  const coverage = (titleHits + bodyHits * 0.6) / concepts.length;
  const titleWeight = titleHits / concepts.length;

  const year = parseInt(r.year, 10);
  const age = Number.isFinite(year) ? currentYear - year : 99;
  const recency = age <= 2 ? 0.08 : age <= 4 ? 0.04 : 0;
  const guideline =
    /guideline|consensus|recommendation|society|statement|meta-analysis|systematic review/i
      .test(`${r.title} ${r.journal}`)
      ? 0.08
      : 0;

  return Math.min(1, coverage * 0.6 + titleWeight * 0.3 + recency + guideline);
}

const GUIDELINE_FILTER =
  '("guideline"[pt] OR "practice guideline"[pt] OR "consensus development conference"[pt])';
const REVIEW_FILTER =
  '("systematic review"[pt] OR "meta-analysis"[pt] OR "review"[pt])';

/**
 * Layered retrieval, all inside the 2022+ window (a hard esearch constraint):
 * guidelines -> high-level reviews -> best relevance match. Candidates are then
 * re-ranked against the original question using title + abstract, and anything
 * below the relevance floor is dropped rather than cited loosely.
 * Throws nothing: failures are reported via `failed` and logged loudly.
 */
export async function retrieveEvidence(
  rawTerm: string,
  max = 5,
): Promise<RetrievalOutcome> {
  const term = toSearchTerm(rawTerm);
  const attempts: Array<{ term: string; retmax: number; sort?: string }> = [
    { term: `${term} AND ${GUIDELINE_FILTER}`, retmax: 4 },
    { term: `${term} AND ${REVIEW_FILTER}`, retmax: 4 },
    { term, retmax: 4 },
  ];

  const ids: string[] = [];
  let anySuccess = false;
  let anyFailure = false;

  const CANDIDATE_CAP = 12;
  for (const a of attempts) {
    if (ids.length >= CANDIDATE_CAP) break;
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

  const candidateIds = ids.slice(0, CANDIDATE_CAP);
  let summaries: PubMedResult[];
  try {
    summaries = await fetchSummary(candidateIds);
  } catch (e) {
    console.error("[pubmed] esummary FAILED:", e instanceof Error ? e.message : e);
    return { results: [], failed: true, window };
  }

  const abstracts = await fetchAbstracts(candidateIds);
  const currentYear = new Date().getFullYear();
  const concepts = conceptTerms(rawTerm);

  const ranked = summaries
    .map((r) => {
      const withAbstract = { ...r, abstract: abstracts[r.pmid] || "" };
      return { ...withAbstract, relevance: scoreRelevance(withAbstract, concepts, currentYear) };
    })
    .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));

  const results = ranked.filter((r) => (r.relevance ?? 0) >= RELEVANCE_FLOOR).slice(0, max);

  console.log(
    `[pubmed] term="${term}" window=${MIN_DATE}..${MAX_DATE} candidates=${ranked.length} kept=${results.length} ` +
      `(PMIDs: ${results.map((r) => `${r.pmid}@${(r.relevance ?? 0).toFixed(2)}`).join(",") || "none"})`,
  );

  return { results, failed: false, window };
}

/** Renders retrieved evidence as a structured block for the model prompt. */
export function formatEvidenceForPrompt(outcome: RetrievalOutcome): string {
  if (outcome.failed) {
    return `RETRIEVED EVIDENCE: RETRIEVAL_FAILED — the PubMed evidence service could not be reached.`;
  }
  if (!outcome.results.length) {
    return `RETRIEVED EVIDENCE: NONE — no PubMed records published between ${outcome.window.from} and ${outcome.window.to} were relevant to this question.`;
  }
  const lines = outcome.results.map((r, i) => {
    const snippet = (r.abstract || "").slice(0, 320);
    return `[${i + 1}] ${r.title} — ${r.journal || "Journal n/a"}, ${r.year || "year n/a"}.` +
      (snippet ? `\n    Abstract: ${snippet}${(r.abstract || "").length > 320 ? "…" : ""}` : "\n    Abstract: not available.");
  });
  return `RETRIEVED EVIDENCE (PubMed, published ${outcome.window.from}–${outcome.window.to}):\n${lines.join("\n")}`;
}
