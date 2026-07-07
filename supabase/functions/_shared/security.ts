// Shared security helpers for Ward Bard edge functions.
// In-memory rate limiting (per-instance; resets on cold start — acceptable
// best-effort given no auth/DB-backed counter exists yet).

const ALLOWED_ORIGINS = new Set([
  "https://ward-bard-aimed.vercel.app",
  "https://wardbard.site",
  "https://www.wardbard.site",
  "https://ward-bard-ai.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

// Also allow any *.lovable.app preview/sandbox host (used by Lovable preview URLs).
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".lovable.app")) return true;
    if (u.hostname.endsWith(".lovableproject.com")) return true;
    if (u.hostname.endsWith(".lovable.dev")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin) ? origin! : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co https://ai.gateway.lovable.dev https://api.groq.com https://eutils.ncbi.nlm.nih.gov; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export function preflight(req: Request): Response | null {
  const cors = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    if (!cors["Access-Control-Allow-Origin"]) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response(null, { headers: { ...cors, ...SECURITY_HEADERS } });
  }
  return null;
}

export function originGuard(req: Request): Response | null {
  const cors = buildCorsHeaders(req);
  if (!cors["Access-Control-Allow-Origin"]) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
    });
  }
  return null;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function streamResponse(
  req: Request,
  body: ReadableStream | null,
  contentType = "text/event-stream",
): Response {
  return new Response(body, {
    headers: {
      ...buildCorsHeaders(req),
      ...SECURITY_HEADERS,
      "Content-Type": contentType,
    },
  });
}

// -------- Rate limiting --------
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientKey(req: Request, scope: string): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim() || "unknown";
  return `${scope}:${ip}`;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// -------- Prompt injection sanitization --------
const INJECTION_PATTERNS: RegExp[] = [
  /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,
  /<\s*\/?\s*script[^>]*>/gi,
  /javascript:/gi,
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|messages?)\b/gi,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?)\b/gi,
  /\[\s*INST\s*\]/gi,
  /\[\s*\/\s*INST\s*\]/gi,
  /<<\s*SYS\s*>>/gi,
  /<<\s*\/\s*SYS\s*>>/gi,
  /^\s*system\s*:/gim,
  /^\s*assistant\s*:/gim,
];

export const MAX_USER_INPUT = 2000;

export function sanitizeUserInput(input: string): string {
  if (typeof input !== "string") return "";
  let s = input.normalize("NFKC");
  // Strip zero-width / bidi-control characters used to hide injections.
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "");
  for (const p of INJECTION_PATTERNS) s = s.replace(p, "[filtered]");
  if (s.length > MAX_USER_INPUT) s = s.slice(0, MAX_USER_INPUT);
  return s;
}
