import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const specialtyReferences: Record<string, string> = {
  medicine:
    "Prioritize references from: Harrison's Principles of Internal Medicine, Oxford Handbook of Clinical Medicine, UpToDate, NEJM, The Lancet.",
  surgery:
    "Prioritize references from: Bailey & Love's Short Practice of Surgery, Schwartz's Principles of Surgery, Washington Manual of Surgery, BMJ, JACS.",
  psychiatry:
    "Prioritize references from: DSM-5-TR, Kaplan & Sadock's Comprehensive Textbook of Psychiatry, Oxford Textbook of Psychiatry, World Psychiatry.",
  gynae:
    "Prioritize references from: Williams Obstetrics, RCOG Guidelines, ACOG Practice Bulletins, BJOG, WHO Reproductive Health Guidelines.",
  ophthalmology:
    "Prioritize references from: Kanski's Clinical Ophthalmology, AAO Preferred Practice Patterns, Survey of Ophthalmology.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, specialty = "all" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const specialtyContext =
      specialty !== "all" && specialtyReferences[specialty]
        ? `\n${specialtyReferences[specialty]}`
        : "";

    const systemPrompt = `You are Ward Bard, a clinical decision-support assistant for medical students and residents in low- and middle-income countries.

Rules:
1. Answer ONLY clinical or medical education questions. For anything else, respond: "Ward Bard is for clinical queries only. Ask me something medical."
2. Structure EVERY response exactly as:
   🔍 **Assessment**
   [text]

   💊 **Management**
   [text]

   ⚡ **Key Points**
   • [point]
   • [point]

   📚 **References**
   [1] [Source with edition/year/chapter]
   [2] [Source with edition/year/chapter]
   [3] [Source with edition/year/chapter]

3. References: cite 2–3 real, specific sources. Format: Textbook name + edition + chapter, OR Journal + year + volume + pages, OR Guideline name + issuing body + year. NEVER fabricate a reference.
4. Depth: final-year medical student or PGY-1 resident level.
5. Be concise but complete. Bullet points over paragraphs where possible.
6. Active specialty filter: [${specialty.toUpperCase()}].${specialtyContext}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
