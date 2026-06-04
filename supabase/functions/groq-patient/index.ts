// Hardened groq-patient edge function.
// - System prompts are SERVER-SIDE ONLY. Clients pick an `action`; they never
//   supply system prompts or arbitrary user text outside of bounded fields.
// - Bounded input lengths and types.
// - Generic client-facing error messages; full error detail stays in logs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ---------- Hard limits ----------
const MAX_STR = 600;          // single short field
const MAX_HISTORY = 2000;     // patient history blob
const MAX_QUESTION = 300;
const MAX_CHOICE = 400;

// ---------- Server-side prompts ----------
const SYS_NEW_CASE =
  'You are a clinical case generator. Generate a realistic but randomized patient case for medical student practice. Return ONLY valid JSON, no markdown, no explanation. Format: { "name": string, "age": number, "sex": string, "chief_complaint": string, "history": string, "specialty": string }';

const SYS_OPTIONS =
  'You are a clinical educator. Given this patient case and the current step, generate exactly 4 multiple choice options. One must be correct or most appropriate, three must be plausible but suboptimal or incorrect. Return ONLY valid JSON: { "options": [{"text": string, "correct": boolean}] }. Shuffle the order so the correct answer is not always first.';

const SYS_FEEDBACK =
  'You are a clinical educator giving brief, direct feedback to a medical student. In 2 sentences maximum: state whether their choice was correct or not, and explain why. Be clinical, not encouraging. No filler phrases.';

// ---------- Helpers ----------
function bad(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

interface PatientCase {
  name: string;
  age: number;
  sex: string;
  chief_complaint: string;
  history: string;
  specialty: string;
}

function validatePatient(p: unknown): PatientCase | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const name = str(o.name, MAX_STR);
  const sex = str(o.sex, 32);
  const chief = str(o.chief_complaint, MAX_STR);
  const history = str(o.history, MAX_HISTORY);
  const specialty = str(o.specialty, 64);
  const age = typeof o.age === "number" && o.age >= 0 && o.age <= 130 ? o.age : null;
  if (!name || !sex || !chief || !history || !specialty || age === null) return null;
  return { name, age, sex, chief_complaint: chief, history, specialty };
}

async function callGroq(
  apiKey: string,
  system: string,
  user: string,
  temperature: number,
): Promise<string> {
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.error("Groq upstream error", resp.status, errText);
    throw new Response(
      JSON.stringify({ error: "AI service temporarily unavailable" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const data = await resp.json();
  return (data?.choices?.[0]?.message?.content as string) ?? "";
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      console.error("GROQ_API_KEY missing");
      return bad("AI service not configured", 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Invalid request");

    const action = (body as Record<string, unknown>).action;

    if (action === "new_case") {
      const seed = Math.random().toString(36).slice(2, 8);
      const content = await callGroq(
        apiKey,
        SYS_NEW_CASE,
        `Generate a new patient case. Seed: ${seed}`,
        1,
      );
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "options") {
      const o = body as Record<string, unknown>;
      const patient = validatePatient(o.patient);
      const stepKey = str(o.stepKey, 64);
      const stepQuestion = str(o.stepQuestion, MAX_QUESTION);
      if (!patient || !stepKey || !stepQuestion) return bad("Invalid options request");

      const userMsg =
        `CASE: ${JSON.stringify(patient)}\nSTEP: ${stepKey}\nQUESTION: ${stepQuestion}`;
      const content = await callGroq(apiKey, SYS_OPTIONS, userMsg, 0.7);
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "feedback") {
      const o = body as Record<string, unknown>;
      const patient = validatePatient(o.patient);
      const stepKey = str(o.stepKey, 64);
      const stepQuestion = str(o.stepQuestion, MAX_QUESTION);
      const choiceText = str(o.choiceText, MAX_CHOICE);
      const correct = typeof o.correct === "boolean" ? o.correct : null;
      if (!patient || !stepKey || !stepQuestion || !choiceText || correct === null) {
        return bad("Invalid feedback request");
      }

      const userMsg =
        `CASE: ${JSON.stringify(patient)}\nSTEP: ${stepKey}\nQUESTION: ${stepQuestion}\nSTUDENT_CHOICE: ${choiceText}\nCORRECT: ${correct}`;
      const content = await callGroq(apiKey, SYS_FEEDBACK, userMsg, 0.4);
      return new Response(JSON.stringify({ content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return bad("Unknown action");
  } catch (e) {
    // Re-throw Response objects from callGroq (already-shaped errors).
    if (e instanceof Response) return e;
    console.error("groq-patient error:", e);
    return bad("Server error", 500);
  }
});
