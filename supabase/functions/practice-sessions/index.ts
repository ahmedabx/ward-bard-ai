// Practice — creates a validated practice session row.
// - Server-side validation: format/exam/mode/difficulty/count whitelists,
//   topic IDs must exist and match the exam+mode, custom topic sanitized.
// - Per-user rate limit on session creation.
// - Generation stays in the existing edge functions (qbank-generator,
//   groq-patient); this function only validates and creates the session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  preflight,
  originGuard,
  jsonResponse,
  rateLimit,
  clientKey,
  sanitizeUserInput,
} from "../_shared/security.ts";

const GENERIC_ERROR = { error: "Something went wrong. Please try again." };

const FORMATS = ["questions", "cases"] as const;
const EXAMS = ["step1", "step2ck", "mbbs_fcps"] as const;
const MODES = ["preclinical", "clinical"] as const;
const DIFFICULTIES = ["easy", "mixed", "hard"] as const;
const QUESTION_COUNTS = [5, 10, 20, 40];
const CASE_COUNTS = [1, 2, 3];

const SESSIONS_PER_HOUR = 12;
const MAX_TOPICS = 20;

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const blocked = originGuard(req);
  if (blocked) return blocked;

  try {
    const rl = rateLimit(clientKey(req, "practice"), 20, 60_000);
    if (!rl.ok) {
      return jsonResponse(req, { error: "Too many requests. Please slow down." }, 429, {
        "Retry-After": String(rl.retryAfter),
      });
    }

    const userId = await getUserId(req);
    if (!userId) return jsonResponse(req, { error: "Not authenticated" }, 401);

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return jsonResponse(req, { error: "Invalid request" }, 400);

    const format = FORMATS.includes(body.format as never) ? (body.format as string) : null;
    if (!format) return jsonResponse(req, { error: "Choose a format." }, 400);

    const exam = EXAMS.includes(body.exam as never) ? (body.exam as string) : null;
    if (!exam) return jsonResponse(req, { error: "Choose an exam." }, 400);

    const mode = MODES.includes(body.mode as never) ? (body.mode as string) : null;
    if (!mode) return jsonResponse(req, { error: "Choose a mode." }, 400);

    const difficulty = DIFFICULTIES.includes(body.difficulty as never)
      ? (body.difficulty as string)
      : "mixed";

    const allowedCounts = format === "questions" ? QUESTION_COUNTS : CASE_COUNTS;
    const itemCount = Number(body.item_count);
    if (!allowedCounts.includes(itemCount)) {
      return jsonResponse(req, { error: "Invalid session length." }, 400);
    }

    const rawTopics = Array.isArray(body.topic_ids) ? body.topic_ids : [];
    const topicIds = [...new Set(
      rawTopics.filter((t): t is string => typeof t === "string" && UUID_RE.test(t)),
    )].slice(0, MAX_TOPICS);

    let customTopic: string | null = null;
    if (typeof body.custom_topic === "string") {
      const cleaned = sanitizeUserInput(body.custom_topic).trim();
      if (cleaned) {
        if (cleaned.length < 2 || cleaned.length > 200) {
          return jsonResponse(req, { error: "Custom topic must be 2–200 characters." }, 400);
        }
        customTopic = cleaned;
      }
    }

    if (topicIds.length === 0 && !customTopic) {
      return jsonResponse(req, { error: "Select at least one topic." }, 400);
    }

    const svc = serviceClient();

    // Per-user session creation rate limit.
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recent, error: rlErr } = await svc
      .from("practice_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", hourAgo);
    if (rlErr) {
      console.error("practice-sessions rate query failed", rlErr.message);
      return jsonResponse(req, GENERIC_ERROR, 500);
    }
    if ((recent ?? 0) >= SESSIONS_PER_HOUR) {
      return jsonResponse(req, { error: "Too many sessions started. Please wait a little." }, 429);
    }

    // Topics must exist and match the exam + mode; cases need case-eligible topics.
    if (topicIds.length > 0) {
      const { data: rows, error: tErr } = await svc
        .from("topics")
        .select("id, case_eligible")
        .in("id", topicIds)
        .eq("exam", exam)
        .eq("mode", mode);
      if (tErr) {
        console.error("practice-sessions topics query failed", tErr.message);
        return jsonResponse(req, GENERIC_ERROR, 500);
      }
      if (!rows || rows.length !== topicIds.length) {
        return jsonResponse(req, { error: "One or more topics are not available for this exam and mode." }, 400);
      }
      if (format === "cases" && rows.some((r: { case_eligible: boolean }) => !r.case_eligible)) {
        return jsonResponse(req, { error: "Some selected topics are not available as a case." }, 400);
      }
    }

    const { data: session, error: insErr } = await svc
      .from("practice_sessions")
      .insert({
        user_id: userId,
        format,
        exam,
        mode,
        topic_ids: topicIds,
        custom_topic: customTopic,
        difficulty,
        item_count: itemCount,
        status: "generating",
      })
      .select("*")
      .single();
    if (insErr || !session) {
      console.error("practice-sessions insert failed", insErr?.message);
      return jsonResponse(req, GENERIC_ERROR, 500);
    }

    return jsonResponse(req, { session });
  } catch (e) {
    console.error("practice-sessions error:", e);
    return jsonResponse(req, GENERIC_ERROR, 500);
  }
});
