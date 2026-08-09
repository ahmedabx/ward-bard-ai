// Confidence scoring for My Assistant responses.
// Derived from structural signals — retrieval strength, answer-to-source
// alignment, and topic volatility — NOT from the model self-reporting.

export interface ScoredSource {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
  score: number; // 0..1 relevance to query+answer
}

export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  label: string;
  relevantSources: ScoredSource[];
}

const STOPWORDS = new Set([
  'a','an','the','and','or','but','if','then','of','on','in','to','for','with',
  'is','are','was','were','be','been','being','it','its','this','that','these',
  'those','as','at','by','from','into','about','over','under','between','vs',
  'versus','how','what','why','when','where','which','who','whom','can','could',
  'should','would','may','might','will','do','does','did','not','no','so','than',
  'such','also','more','most','less','least','some','any','all','each','every',
  'my','your','our','their','his','her','they','we','you','i','me','us','them',
  'patient','patients','case','cases','question','answer','explain','tell','give',
  'please','clinical','medical','medicine','doctor','study','learn','learning',
  'preclinical','usmle','step','mbbs','fcps','exam','education','educational',
  'consult','healthcare','provider','only',
]);

// High-volatility clinical domains — active guideline flux, so default lower
// unless retrieval is strong.
const VOLATILE_TERMS = [
  'sepsis','septic','anticoagul','doac','noac','warfarin','apixaban','rivaroxaban',
  'covid','sars-cov-2','long covid','vaccine','vaccination','booster',
  'hypertension target','blood pressure target','sprint','bp goal',
  'cholesterol','ldl','statin','pcsk9','ezetimibe',
  'diabetes','sglt2','glp-1','glp1','tirzepatide','semaglutide',
  'atrial fibrillation','stroke prevention','cha2ds2',
  'heart failure','hfref','hfpef','entresto','sacubitril',
  'oncology','immunotherapy','checkpoint','car-t','car t',
  'obesity','wegovy','ozempic','mounjaro',
  'psychiatric','ssri','antidepressant',
];

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function isVolatile(query: string): boolean {
  const q = query.toLowerCase();
  return VOLATILE_TERMS.some((t) => q.includes(t));
}

export interface RawSource {
  pmid: string;
  title: string;
  authorLine: string;
  journal: string;
  year: string;
  url: string;
}

export function assessConfidence(
  query: string,
  answer: string,
  sources: RawSource[],
): ConfidenceAssessment {
  const queryTokens = tokenize(query);
  const answerTokens = tokenize(answer);
  // Cap the denominator — long questions shouldn't dilute topical overlap.
  const queryDenominator = Math.min(Math.max(queryTokens.size, 2), 6);
  const currentYear = new Date().getFullYear();

  const scored: ScoredSource[] = sources.map((s) => {
    const titleTokens = tokenize(`${s.title} ${s.journal}`);
    const queryHits = overlap(titleTokens, queryTokens);
    const answerHits = overlap(titleTokens, answerTokens);
    const year = parseInt(s.year, 10);
    const age = Number.isFinite(year) ? currentYear - year : 99;
    const recency = age <= 3 ? 0.15 : age <= 6 ? 0.08 : 0;
    const isGuideline = /guideline|consensus|recommendation|statement/i.test(s.title)
      ? 0.12
      : 0;
    const score = Math.min(
      1,
      Math.min(queryHits / queryDenominator, 1) * 0.6 +
        Math.min(answerHits / 4, 1) * 0.25 +
        recency +
        isGuideline,
    );
    return { ...s, score };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);

  // Sources considered topically aligned enough to drive the confidence level.
  const aligned = ranked.filter((s) => {
    const hits = overlap(tokenize(s.title), queryTokens);
    return hits >= 1 || s.score >= 0.25;
  });

  const maxAlignment = ranked[0]?.score ?? 0;
  const volatile = isVolatile(query);

  let level: ConfidenceLevel;
  if (aligned.length >= 2 && maxAlignment >= 0.45) {
    level = 'high';
  } else if (aligned.length >= 1 && maxAlignment >= 0.3) {
    level = 'moderate';
  } else if (ranked.length >= 1) {
    level = 'moderate';
  } else {
    level = 'low';
  }

  // Guideline-flux domains need strong retrieval before claiming high.
  if (volatile && level === 'high' && aligned.length < 3) {
    level = 'moderate';
  }

  const label =
    level === 'high' ? 'High confidence'
    : level === 'moderate' ? 'Moderate confidence'
    : 'Low confidence';

  // Always surface retrieved sources as clickable citations, even when the
  // confidence level is only moderate — the user still wants the links.
  const relevantSources = (aligned.length ? aligned : ranked).slice(0, 5);

  return { level, label, relevantSources };
}
