// Vercel serverless function for clinical score interpretation.
// Required env var on Vercel: ANTHROPIC_API_KEY

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a clinical educator helping a medical student understand what a clinical score means in practice.

You have access to real-time web search. For every query, search PubMed, WHO, NICE, or relevant guideline websites before answering. Prioritize sources published in 2024-2026. Always cite the source URL and publication date in the References section.

Given the score and its components, explain:
1. What this score tells you clinically and why it matters
2. What your immediate management priorities are
3. What to watch for / red flags to reassess
4. One or two teaching points a senior would tell a junior on the ward

Be practical and specific. Write as a knowledgeable senior colleague, not a textbook. Include a "References" section with source URLs and publication dates from any web sources used.

End with: "For educational purposes only. Verify with clinical judgment and local guidelines."`;

function parseClaudeResponse(aJson) {
  let text = "";
  let usedWebSearch = false;
  const webSources = [];
  const seen = new Set();

  const blocks = aJson?.content || [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;

    if (block.type === "text" && typeof block.text === "string") {
      text += block.text;
      const cits = block.citations || [];
      for (const c of cits) {
        const url = c?.url;
        if (url && !seen.has(url)) {
          seen.add(url);
          webSources.push({ url, title: c.title || url });
        }
      }
    }

    if (block.type === "server_tool_use" && block.name === "web_search") {
      usedWebSearch = true;
    }

    if (block.type === "web_search_tool_result") {
      usedWebSearch = true;
      const items = Array.isArray(block.content) ? block.content : [];
      for (const item of items) {
        const url = item?.url;
        if (url && !seen.has(url)) {
          seen.add(url);
          webSources.push({
            url,
            title: item.title || url,
            published: item.page_age || null,
          });
        }
      }
    }
  }

  return { text, usedWebSearch, webSources };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { name, score, components, interpretation } = req.body || {};
    if (!name || score === undefined || !components) {
      return res.status(400).json({ error: "Missing name/score/components" });
    }
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

    const componentsText = Object.entries(components)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");
    const userMsg = `Calculator: ${name}. Score: ${score}${interpretation ? ` (${interpretation})` : ""}. Components:\n${componentsText}\n\nProvide clinical interpretation. Use web search to verify against the latest 2024-2026 guidelines and include source URLs in References.`;

    const aRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!aRes.ok) {
      const t = await aRes.text();
      console.error("Claude error", aRes.status, t);
      return res.status(502).json({ error: "AI interpretation failed" });
    }
    const aJson = await aRes.json();
    const { text, usedWebSearch, webSources } = parseClaudeResponse(aJson);
    return res.status(200).json({ interpretation: text, usedWebSearch, webSources });
  } catch (err) {
    console.error("interpret error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
