// PubMed/NCBI Entrez proxy. Keeps NCBI calls off the browser, adds rate
// limiting, CORS allowlist, security headers, and sanitized errors.
// Retrieval window and layering live in ../_shared/pubmed.ts so the chat
// function grounds on exactly the same evidence the Evidence panel shows.

import {
  preflight,
  originGuard,
  jsonResponse,
  rateLimit,
  clientKey,
} from "../_shared/security.ts";
import { retrieveEvidence, sanitizeTerm } from "../_shared/pubmed.ts";

const GENERIC_ERROR = { error: "Something went wrong. Please try again." };

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

    const outcome = await retrieveEvidence(cleaned);
    return jsonResponse(req, {
      results: outcome.results,
      retrievalFailed: outcome.failed,
      window: outcome.window,
    });
  } catch (e) {
    console.error("pubmed-search error:", e);
    return jsonResponse(req, GENERIC_ERROR, 500);
  }
});
