// Hardened groq-patient edge function.
// - Server-side prompts only; client picks `action`.
// - One AI call per case: generates the FULL structured case (vitals, decision
//   points, deltas, scores, thresholds). Gameplay then runs client-side on that
//   static JSON — no AI calls mid-game.
// - CORS allowlist, security headers, per-IP rate limit, sanitized errors.
// - Server-enforced daily case-generation quota (per authenticated user).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  preflight,
  originGuard,
  jsonResponse,
  rateLimit,
  clientKey,
} from "../_shared/security.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const DAILY_CASE_LIMIT = 2;

const SPECIALTY_LABELS: Record<string, string> = {
  cardiology: "Cardiology",
  nephrology: "Nephrology",
  gi: "Gastroenterology",
  neuro: "Neurology",
  respiratory: "Respiratory medicine",
  obgyn: "Obstetrics & Gynaecology",
  emergency: "Emergency medicine / Sepsis",
  haematology: "Haematology",
};

const GENERIC_ERROR = { error: "Something went wrong. Please try again." };

const VITAL_KEYS = ["hr", "sbp", "dbp", "rr", "spo2", "temp"] as const;
type VitalKey = typeof VITAL_KEYS[number];
type Vitals = Record<VitalKey, number>;

const VITAL_RANGES: Record<VitalKey, [number, number]> = {
  hr: [20, 220],
  sbp: [40, 260],
  dbp: [20, 160],
  rr: [4, 60],
  spo2: [50, 100],
  temp: [32, 43],
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

async function usedToday(userId: string): Promise<number> {
  const { count, error } = await serviceClient()
    .from("patient_case_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("generated_on", todayUtc());
  if (error) throw new Error("quota");
  return count ?? 0;
}

const CASE_SCHEMA_TEXT = `{
  "chief_complaint": string (one short line, e.g. "58M with crushing central chest pain"),
  "specialty": string,
  "starting_vitals": { "hr": number, "sbp": number, "dbp": number, "rr": number, "spo2": number, "temp": number },
  "decision_points": [
    {
      "question": string (a single focused management/decision question),
      "options": [
        {
          "text": string (short clinical action, max ~90 chars),
          "vitals_delta": { "hr": number, "sbp": number, "dbp": number, "rr": number, "spo2": number, "temp": number },
          "outcome_score": 1 | 0 | -1,
          "feedback": string (ONE sentence of clinical reasoning, max ~140 chars)
        }
      ] (exactly 4 options)
    }
  ] (exactly 6 decision points),
  "stabilize_threshold": 5,
  "critical_threshold": -5
}`;

const SYS_CASE = `You are a clinical simulation designer building a self-contained, data-driven patient case for medical exam preparation.
Return ONLY valid JSON matching this shape, with no markdown and no commentary:
${CASE_SCHEMA_TEXT}

Rules:
- Exactly 6 decision points, each with exactly 4 options.
- Each decision point must have exactly one option with outcome_score 1 (correct/most appropriate), at least one with -1 (harmful), and the rest 0 (neutral/unhelpful).
- vitals_delta values are CHANGES, not absolutes. Use small realistic integers (hr/sbp/dbp within -30..30, rr within -10..10, spo2 within -12..12). temp may be a decimal within -2..2. Include all six keys; use 0 where nothing changes.
- Correct options should move vitals toward normal; harmful options should worsen them.
- starting_vitals must be abnormal in a way consistent with the chief complaint.
- Keep every string short and clinical. No stage labels, no headings, no filler.`;

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
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!resp.ok) {
    console.error("Groq upstream error", resp.status);
    throw new Error("upstream");
  }
  const data = await resp.json();
  return (data?.choices?.[0]?.message?.content as string) ?? "";
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, Math.round(n * 10) / 10));
}

function shortStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

function parseVitals(v: unknown): Vitals {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const defaults: Vitals = { hr: 92, sbp: 118, dbp: 74, rr: 18, spo2: 96, temp: 37 };
  const out = {} as Vitals;
  for (const k of VITAL_KEYS) {
    const [min, max] = VITAL_RANGES[k];
    out[k] = clampNum(o[k], min, max, defaults[k]);
  }
  return out;
}

function parseDelta(v: unknown): Vitals {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const bounds: Record<VitalKey, number> = { hr: 30, sbp: 30, dbp: 25, rr: 10, spo2: 12, temp: 2 };
  const out = {} as Vitals;
  for (const k of VITAL_KEYS) {
    out[k] = clampNum(o[k], -bounds[k], bounds[k], 0);
  }
  return out;
}

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice);
}

interface BuiltCase {
  chief_complaint: string;
  specialty: string;
  starting_vitals: Vitals;
  decision_points: {
    question: string;
    options: { text: string; vitals_delta: Vitals; outcome_score: number; feedback: string }[];
  }[];
  stabilize_threshold: number;
  critical_threshold: number;
}

function buildCase(raw: unknown, specialtyLabel: string): BuiltCase | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const chief = shortStr(o.chief_complaint, 200);
  if (!chief) return null;

  const rawPoints = Array.isArray(o.decision_points) ? o.decision_points : [];
  const points: BuiltCase["decision_points"] = [];
  for (const p of rawPoints.slice(0, 8)) {
    if (!p || typeof p !== "object") continue;
    const po = p as Record<string, unknown>;
    const question = shortStr(po.question, 240);
    const rawOpts = Array.isArray(po.options) ? po.options : [];
    const options = rawOpts
      .slice(0, 4)
      .map((op) => {
        const oo = (op && typeof op === "object" ? op : {}) as Record<string, unknown>;
        const text = shortStr(oo.text, 160);
        if (!text) return null;
        const score = typeof oo.outcome_score === "number"
          ? Math.max(-1, Math.min(1, Math.round(oo.outcome_score)))
          : 0;
        return {
          text,
          vitals_delta: parseDelta(oo.vitals_delta),
          outcome_score: score,
          feedback: shortStr(oo.feedback, 220) || "No additional reasoning provided.",
        };
      })
      .filter(Boolean) as BuiltCase["decision_points"][number]["options"];
    if (!question || options.length !== 4) continue;
    points.push({ question, options });
  }
  if (points.length < 4) return null;

  return {
    chief_complaint: chief,
    specialty: specialtyLabel,
    starting_vitals: parseVitals(o.starting_vitals),
    decision_points: points,
    stabilize_threshold: Math.max(2, Math.min(10, typeof o.stabilize_threshold === "number" ? Math.round(o.stabilize_threshold) : 5)),
    critical_threshold: Math.min(-2, Math.max(-10, typeof o.critical_threshold === "number" ? Math.round(o.critical_threshold) : -5)),
  };
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const blocked = originGuard(req);
  if (blocked) return blocked;

  try {
    const rl = rateLimit(clientKey(req, "groq"), 20, 60_000);
    if (!rl.ok) {
      return jsonResponse(
        req,
        { error: "Too many requests. Please slow down." },
        429,
        { "Retry-After": String(rl.retryAfter) },
      );
    }

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      console.error("GROQ_API_KEY missing");
      return jsonResponse(req, GENERIC_ERROR, 500);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse(req, { error: "Invalid request" }, 400);
    }
    const o = body as Record<string, unknown>;
    const action = o.action;

    if (action === "quota") {
      const userId = await getUserId(req);
      if (!userId) return jsonResponse(req, { error: "Not authenticated" }, 401);
      const used = await usedToday(userId);
      return jsonResponse(req, { used, limit: DAILY_CASE_LIMIT });
    }

    if (action === "new_case") {
      const userId = await getUserId(req);
      if (!userId) return jsonResponse(req, { error: "Not authenticated" }, 401);

      const specialtyKey = typeof o.specialty === "string" ? o.specialty : "";
      const specialtyLabel = SPECIALTY_LABELS[specialtyKey];
      if (!specialtyLabel) {
        return jsonResponse(req, { error: "Please choose a specialty." }, 400);
      }

      const used = await usedToday(userId);
      if (used >= DAILY_CASE_LIMIT) {
        return jsonResponse(
          req,
          {
            error: "You've used both cases for today — come back tomorrow.",
            limitReached: true,
            used,
            limit: DAILY_CASE_LIMIT,
          },
          429,
        );
      }

      const mode = o.mode === "preclinical" ? "preclinical" : "clinical";
      const seed = Math.random().toString(36).slice(2, 8);
      const levelHint = mode === "preclinical"
        ? "Pitch decisions at USMLE Step 1 / preclinical level — mechanism, pathophysiology and basic pharmacology driven."
        : "Pitch decisions at USMLE Step 2 CK / clinical level — acute assessment and management driven.";

      const content = await callGroq(
        apiKey,
        SYS_CASE,
        `Design one randomized ${specialtyLabel} case. The presenting problem and all decisions MUST belong to ${specialtyLabel}. ${levelHint} Seed: ${seed}`,
        1,
      );

      let built: BuiltCase | null = null;
      try {
        built = buildCase(extractJson(content), specialtyLabel);
      } catch (_e) {
        built = null;
      }
      if (!built) {
        return jsonResponse(req, { error: "Could not build a case. Please try again." }, 502);
      }

      const svc = serviceClient();
      const { data: inserted, error: caseError } = await svc
        .from("patient_cases")
        .insert({
          user_id: userId,
          specialty: specialtyKey,
          mode,
          chief_complaint: built.chief_complaint,
          starting_vitals: built.starting_vitals,
          decision_points: built.decision_points,
          stabilize_threshold: built.stabilize_threshold,
          critical_threshold: built.critical_threshold,
        })
        .select("id")
        .single();
      if (caseError) {
        console.error("case insert failed", caseError.message);
        return jsonResponse(req, GENERIC_ERROR, 500);
      }

      // Only a successfully generated case consumes a slot.
      const { error: insertError } = await svc
        .from("patient_case_generations")
        .insert({ user_id: userId, specialty: specialtyKey, generated_on: todayUtc() });
      if (insertError) console.error("quota insert failed", insertError.message);

      return jsonResponse(req, {
        case: { id: inserted.id, ...built },
        used: used + 1,
        limit: DAILY_CASE_LIMIT,
      });
    }

    return jsonResponse(req, { error: "Invalid request" }, 400);
  } catch (e) {
    console.error("groq-patient error:", e);
    return jsonResponse(req, GENERIC_ERROR, 500);
  }
});
