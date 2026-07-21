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
  const combined = new Set<string>([...queryTokens, ...answerTokens]);
  const queryDenominator = Math.max(queryTokens.size, 3);

  const scored: ScoredSource[] = sources.map((s) => {
    const titleTokens = tokenize(`${s.title} ${s.journal}`);
    const queryHits = overlap(titleTokens, queryTokens);
    const answerHits = overlap(titleTokens, answerTokens);
    // Weight query overlap higher — a source has to be on the actual topic,
    // not just echo generic terms from the answer.
    const score =
      (queryHits / queryDenominator) * 0.7 +
      Math.min(answerHits / 4, 1) * 0.3;
    return { ...s, score };
  });

  // Relevance threshold: at least 2 real query-token hits OR score ≥ 0.28.
  const relevant = scored
    .filter((s) => {
      const titleTokens = tokenize(s.title);
      const hits = overlap(titleTokens, queryTokens);
      return hits >= 2 || s.score >= 0.28;
    })
    .sort((a, b) => b.score - a.score);

  const maxAlignment = relevant[0]?.score ?? 0;
  const volatile = isVolatile(query);

  let level: ConfidenceLevel;
  if (relevant.length >= 2 && maxAlignment >= 0.35 && !volatile) {
    level = 'high';
  } else if (relevant.length >= 1 && maxAlignment >= 0.35 && !volatile) {
    level = 'high';
  } else if (relevant.length >= 1 && maxAlignment >= 0.22) {
    level = 'moderate';
  } else if (relevant.length >= 1) {
    level = volatile ? 'low' : 'moderate';
  } else {
    level = 'low';
  }

  // Suppress high in volatile domains without strong retrieval.
  if (volatile && level === 'high' && relevant.length < 2) {
    level = 'moderate';
  }

  const label =
    level === 'high' ? 'High confidence'
    : level === 'moderate' ? 'Moderate confidence'
    : 'Low confidence';

  return { level, label, relevantSources: relevant };
}
