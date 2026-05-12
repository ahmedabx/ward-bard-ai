import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, specialty, level, history, answer } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a senior consultant on a ward round, questioning a medical trainee. Ask one focused clinical question at a time. Be direct and exacting. After their answer, give honest feedback — acknowledge what's correct, clearly identify gaps, then provide the model answer with 2-3 references. Then ask one follow-up question that goes deeper. Calibrate difficulty to: ${level}. Specialty: ${specialty}.

OUTPUT RULES:
- When asked for a NEW question (no prior answer): respond with ONLY the question, 1-3 sentences, consultant tone, no preamble, no hints.
- When evaluating an answer, return STRICT markdown with these exact section headers and order:

**✅ What you got right**
- bullet points (or "Nothing substantial." if blank)

**❌ What you missed**
- bullet points

**📚 Model answer**
Concise paragraphs or bullets with 2-3 real references (guideline + year).

**Score:** correct | partial | incorrect

**➡️ Follow-up**
One deeper question, 1-2 sentences.

End every response with: "⚠️ Educational only — always consult a healthcare provider."`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    if (Array.isArray(history)) {
      for (const h of history) messages.push({ role: h.role, content: h.content });
    }

    if (mode === "new_question") {
      messages.push({ role: "user", content: "Ask me your next question." });
    } else if (mode === "evaluate") {
      messages.push({ role: "user", content: String(answer ?? "") });
    } else {
      return new Response(JSON.stringify({ error: "Invalid mode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    let score: "correct" | "partial" | "incorrect" | null = null;
    if (mode === "evaluate") {
      const m = content.match(/\*\*Score:\*\*\s*(correct|partial|incorrect)/i);
      if (m) score = m[1].toLowerCase() as any;
    }

    return new Response(JSON.stringify({ content, score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pimp-me error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
