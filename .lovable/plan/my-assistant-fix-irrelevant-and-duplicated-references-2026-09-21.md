# My Assistant: fix irrelevant and duplicated references

## What I found (diagnosis)

**Note on the model:** My Assistant no longer runs on Claude. It runs on Groq (`openai/gpt-oss-120b`) in `supabase/functions/ward-bard-chat/index.ts`. Everything below applies to that prompt.

### Current search query construction (Bug 1)

`supabase/functions/_shared/pubmed.ts`:

- `toSearchTerm()` lowercases the question, strips punctuation, drops a stopword list, and keeps the first 12 remaining words as a bag of keywords.
- `retrieveEvidence()` runs up to 4 esearch calls with that bag:
  1. `term AND (guideline[pt] OR practice guideline[pt] OR consensus[pt])`
  2. `term AND (systematic review[pt] OR meta-analysis[pt] OR review[pt])`
  3. `term` (relevance sort)
  4. `term` (pub_date sort)
- Date params on every call are hard constraints already: `datetype=pdat`, `mindate=2022/01/01`, `maxdate=<next year>/12/31`.
- PMIDs from all four passes are concatenated in order until 6 are collected, then esummary fetches title/journal/year. **Nothing is ever dropped.**

So the relevance problem is: pass 4 (newest-first, no relevance sort) and the loose keyword bag both inject papers that merely share a word with the question, and every retrieved PMID is handed to the model and shown to the user regardless of fit. No abstract is ever fetched, so nothing can judge topical match.

### Where references get rendered (Bug 2)

Two independent sources, which is why they duplicate:

1. **Model prose.** Prompt rules E2/3/6 tell the model to "close with a compact numbered reference list (source + year + PMID)". That list is plain markdown inside the answer text.
2. **UI list.** `src/components/AssistantConfidence.tsx` makes its *own* second call to the `pubmed-search` function with the raw question, scores results with `src/lib/confidence.ts`, and renders the clickable card list.

Worse, those are two separate retrievals: the chat function's numbering `[1]`, `[2]` and the UI card numbering come from different result sets, so `linkifyCitations` in `ChatMessageBubble.tsx` can jump `[2]` to an unrelated card.

## The fix

### 1. Relevance gate on retrieval (`_shared/pubmed.ts`)

- Keep the 2022–2026 window exactly where it is, on the esearch call.
- Drop the unranked `sort=pub_date` pass; keep guideline → review → relevance.
- Fetch abstracts: add an `efetch` call (`rettype=abstract`) alongside `esummary`, so each candidate carries title + abstract.
- Score each candidate against the question over title + abstract, not the stripped keyword bag: weight concept terms from the original question, require a minimum concept match, add small bonuses for guideline/consensus publication types and recency.
- Filter out candidates below the threshold, sort the rest, cap at 5. If nothing clears the bar, return zero sources rather than filler.

### 2. Prompt changes (`ward-bard-chat/index.ts`)

- Evidence block gains a one-line abstract snippet per entry so the model can judge fit.
- Replace E2/E6: the model emits inline markers `[1]`, `[2]` only, placed on the claim they support. It must not write a reference list, journal names, PMIDs, or URLs in prose.
- New rule: if no listed source actually supports a claim, state that the claim is general knowledge or omit the marker. Never attach a loosely related source to a claim.
- Remove "compact numbered reference list" from both the preclinical and clinical mode guidance.

### 3. One rendered source list (`ward-bard-chat` → chat UI)

- The chat function emits the retrieved, ranked sources once as a JSON preamble line on the stream, before the model tokens.
- `src/hooks/use-chat.ts` parses that preamble and stores `sources` on the assistant message (and persists them with the message so resumed history keeps its citations).
- `AssistantConfidence.tsx` renders those sources instead of re-querying `pubmed-search`. Same visual design, same clickable PubMed cards, same confidence chip — but the numbering now matches the model's `[n]` markers exactly, and there is only one network retrieval per answer.
- `pubmed-search` function stays deployed and untouched (no other caller changes).

## Out of scope

My Patient, Qbank Maker, Calculators, auth, and all styling stay as they are.
