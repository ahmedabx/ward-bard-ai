// PubMed/NCBI Entrez proxy. Keeps NCBI calls off the browser, adds rate
// limiting, CORS allowlist, security headers, and sanitized errors.

import {
  preflight,
  originGuard,
  jsonResponse,
  rateLimit,
  clientKey,
} from "../_shared/security.ts";

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

const GENERIC_ERROR = { error: "Something went wrong. Please try again." };

interface PubMedResult {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
}

function sanitizeTerm(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Allow only chars that make sense for a PubMed term.
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, "")
    .replace(/[^\w\s\-+().,/:'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 300);
}

async function fetchIds(term: string, withDate: boolean): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term,
    retmax: "3",
    sort: "pub+date",
    retmode: "json",
  });
  if (withDate) {
    params.set("datetype", "pdat");
    params.set("mindate", "2022/01/01");
    params.set("maxdate", "2026/12/31");
  }
  const resp = await fetch(`${ESEARCH}?${params}`);
  if (!resp.ok) return [];
  const data = await resp.json().catch(() => null);
  return data?.esearchresult?.idlist ?? [];
}

async function fetchSummary(ids: string[]): Promise<PubMedResult[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
  });
  const resp = await fetch(`${ESUMMARY}?${params}`);
  if (!resp.ok) return [];
  const data = await resp.json().catch(() => null);
  const result = data?.result;
  if (!result) return [];
  return ids
    .map((pmid): PubMedResult | null => {
      const r = result[pmid];
      if (!r) return null;
      const authors = Array.isArray(r.authors) ? r.authors : [];
      const firstAuthor = authors[0]?.name || "Unknown";
      const authorLine =
        authors.length > 1 ? `${firstAuthor} et al.` : firstAuthor;
      const pubdate: string = r.pubdate || "";
      const year = (pubdate.match(/\d{4}/) || [""])[0];
      return {
        pmid,
        title: r.title || "Untitled",
        authorLine,
        journal: r.fulljournalname || r.source || "",
        year,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      };
    })
    .filter((x): x is PubMedResult => x !== null);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const blocked = originGuard(req);
  if (blocked) return blocked;

  try {
    const rl = rateLimit(clientKey(req, "pubmed"), 60, 60_000);
    if (!rl.ok) {
      return jsonResponse(
        req,
        { error: "Too many requests. Please slow down." },
        429,
        { "Retry-After": String(rl.retryAfter) },
      );
    }

    const body = await req.json().catch(() => null);
    const cleaned = sanitizeTerm((body as { query?: unknown })?.query);
    if (!cleaned) return jsonResponse(req, { error: "Invalid request" }, 400);

    const attempts: Array<[string, boolean]> = [
      [`${cleaned} guidelines`, true],
      [`${cleaned} guideline`, false],
      [`${cleaned} review`, true],
      [cleaned, true],
      [cleaned, false],
    ];
    let ids: string[] = [];
    for (const [term, withDate] of attempts) {
      ids = await fetchIds(term, withDate);
      if (ids.length) break;
    }
    if (!ids.length) return jsonResponse(req, { results: [] });

    const results = await fetchSummary(ids);
    return jsonResponse(req, { results });
  } catch (e) {
    console.error("pubmed-search error:", e);
    return jsonResponse(req, GENERIC_ERROR, 500);
  }
});
