// Vercel serverless function for clinical score interpretation.
// Required env var on Vercel: ANTHROPIC_API_KEY

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

const SYSTEM_PROMPT = `You are a clinical educator helping a medical student understand what a clinical score means in practice. Given the score and its components, explain:
1. What this score tells you clinically and why it matters
2. What your immediate management priorities are
3. What to watch for / red flags to reassess
4. One or two teaching points a senior would tell a junior on the ward
Be practical and specific. Write as a knowledgeable senior colleague, not a textbook.
End with: "For educational purposes only. Verify with clinical judgment and local guidelines."`;

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
    const userMsg = `Calculator: ${name}. Score: ${score}${interpretation ? ` (${interpretation})` : ""}. Components:\n${componentsText}\n\nProvide clinical interpretation.`;

    const aRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!aRes.ok) {
      const t = await aRes.text();
      console.error("Claude error", aRes.status, t);
      return res.status(502).json({ error: "AI interpretation failed" });
    }
    const aJson = await aRes.json();
    const text = aJson?.content?.[0]?.text || "";
    return res.status(200).json({ interpretation: text });
  } catch (err) {
    console.error("interpret error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
