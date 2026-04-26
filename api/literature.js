// Vercel serverless function — runs only on Vercel deployment, not in Lovable preview.
// Required env vars on Vercel: ANTHROPIC_API_KEY, NCBI_API_KEY

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a clinical evidence synthesizer for medical students and clinicians. Synthesize the provided PubMed abstracts into a structured summary. Always:
- Cite papers inline as [Author et al., Year] with PMID
- Distinguish RCTs and meta-analyses from observational studies explicitly
- Flag weak, conflicting, or limited evidence
- Keep language clear for a senior medical student
- End with: "For educational purposes only. Verify with clinical judgment and local guidelines."`;

function pickTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1].replace(/<[^>]+>/g, "").trim());
  return out;
}

function parsePubmedXml(xml) {
  const articles = [];
  const blocks = xml.split(/<PubmedArticle[^>]*>/).slice(1);
  for (const raw of blocks) {
    const block = raw.split("</PubmedArticle>")[0];
    const pmid = (pickTag(block, "PMID")[0] || "").trim();
    const title = (pickTag(block, "ArticleTitle")[0] || "Untitled").trim();
    const journal = (pickTag(block, "Title")[0] || "").trim();
    const year = (pickTag(block, "Year")[0] || "").trim();
    const lastNames = pickTag(block, "LastName");
    const firstAuthor = lastNames[0] || "Unknown";
    const abstractParts = pickTag(block, "AbstractText");
    const abstractText = abstractParts.join(" ").trim() || "No abstract available.";
    if (pmid) articles.push({ pmid, title, journal, year, firstAuthor, abstractText });
  }
  return articles;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({ error: "Missing query" });
    }
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const NCBI_API_KEY = process.env.NCBI_API_KEY;
    if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

    // 1) ESearch
    const esearchUrl = `${ESEARCH}?db=pubmed&retmax=15&sort=relevance&retmode=json&term=${encodeURIComponent(query)}${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ""}`;
    const esRes = await fetch(esearchUrl);
    if (!esRes.ok) return res.status(502).json({ error: "PubMed search failed" });
    const esJson = await esRes.json();
    const pmids = esJson?.esearchresult?.idlist || [];
    if (!pmids.length) {
      return res.status(200).json({ sources: [], synthesis: null, message: "No papers found. Try broader search terms." });
    }

    // 2) EFetch
    const efetchUrl = `${EFETCH}?db=pubmed&retmode=xml&id=${pmids.join(",")}${NCBI_API_KEY ? `&api_key=${NCBI_API_KEY}` : ""}`;
    const efRes = await fetch(efetchUrl);
    if (!efRes.ok) return res.status(502).json({ error: "PubMed fetch failed" });
    const xml = await efRes.text();
    const sources = parsePubmedXml(xml);

    // 3) Claude synthesis
    const userMsg = `Clinical topic: ${query}\n\nAbstracts:\n\n${sources
      .map((s, i) => `[${i + 1}] ${s.firstAuthor} et al., ${s.year} | PMID: ${s.pmid}\nTitle: ${s.title}\nJournal: ${s.journal}\nAbstract: ${s.abstractText}`)
      .join("\n\n")}\n\nProduce a structured evidence synthesis.`;

    let synthesis = null;
    try {
      const aRes = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
      if (aRes.ok) {
        const aJson = await aRes.json();
        synthesis = aJson?.content?.[0]?.text || null;
      }
    } catch (_) {
      synthesis = null;
    }

    return res.status(200).json({ sources, synthesis });
  } catch (err) {
    console.error("literature error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
