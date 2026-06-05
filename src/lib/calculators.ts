// Clinical calculator library for Ward Bard.
// Each calculator has typed fields and a compute() that returns a score,
// risk category (low/moderate/high) and one-line interpretation.

export type Specialty =
  | 'Cardiology'
  | 'Nephrology'
  | 'Gastroenterology'
  | 'Neurology'
  | 'Respiratory'
  | 'Obs/Gynae'
  | 'Emergency'
  | 'Haematology';

export const SPECIALTIES: Specialty[] = [
  'Cardiology',
  'Nephrology',
  'Gastroenterology',
  'Neurology',
  'Respiratory',
  'Obs/Gynae',
  'Emergency',
  'Haematology',
];

export type FieldType = 'select' | 'binary' | 'number';

export interface CalcField {
  id: string;
  label: string;
  type: FieldType;
  /** Optional grouping header shown above the field. */
  section?: string;
  /** For 'select' / 'binary'. */
  options?: { label: string; value: number }[];
  /** For 'number'. */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
}

export type RiskLevel = 'low' | 'moderate' | 'high';

export interface CalcResult {
  score: number | string;
  category: string;
  risk: RiskLevel;
  interpretation: string;
}

export interface Calculator {
  id: string;
  name: string;
  specialty: Specialty;
  description: string;
  fields: CalcField[];
  compute: (values: Record<string, number>) => CalcResult;
}

// ── helpers ───────────────────────────────────────────────────────────
const yesNo = (pts = 1) => [
  { label: 'No', value: 0 },
  { label: 'Yes', value: pts },
];

const sumAll = (values: Record<string, number>) =>
  Object.values(values).reduce((a, b) => a + (Number(b) || 0), 0);

const num = (
  id: string,
  label: string,
  opts: Partial<CalcField> = {}
): CalcField => ({ id, label, type: 'number', ...opts });

const bin = (id: string, label: string, pts = 1, section?: string): CalcField => ({
  id,
  label,
  type: 'binary',
  options: yesNo(pts),
  section,
});

const sel = (
  id: string,
  label: string,
  options: { label: string; value: number }[],
  section?: string
): CalcField => ({ id, label, type: 'select', options, section });

// ── CARDIOLOGY ────────────────────────────────────────────────────────
const heart: Calculator = {
  id: 'heart',
  name: 'HEART Score',
  specialty: 'Cardiology',
  description: 'Chest pain risk stratification for major adverse cardiac events.',
  fields: [
    sel('history', 'History', [
      { label: 'Slightly suspicious', value: 0 },
      { label: 'Moderately suspicious', value: 1 },
      { label: 'Highly suspicious', value: 2 },
    ]),
    sel('ecg', 'ECG', [
      { label: 'Normal', value: 0 },
      { label: 'Non-specific repolarisation', value: 1 },
      { label: 'Significant ST deviation', value: 2 },
    ]),
    sel('age', 'Age', [
      { label: '< 45', value: 0 },
      { label: '45–64', value: 1 },
      { label: '≥ 65', value: 2 },
    ]),
    sel('risk', 'Risk factors', [
      { label: 'None', value: 0 },
      { label: '1–2', value: 1 },
      { label: '≥ 3 or known atherosclerosis', value: 2 },
    ]),
    sel('trop', 'Troponin', [
      { label: '≤ normal limit', value: 0 },
      { label: '1–3× normal', value: 1 },
      { label: '> 3× normal', value: 2 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 3) return { score: s, category: 'Low risk', risk: 'low', interpretation: '~1.7% 6-week MACE — consider discharge with follow-up.' };
    if (s <= 6) return { score: s, category: 'Moderate risk', risk: 'moderate', interpretation: '~16.6% MACE — admit for observation and serial troponins.' };
    return { score: s, category: 'High risk', risk: 'high', interpretation: '~50% MACE — early invasive strategy warranted.' };
  },
};

const chadsvasc: Calculator = {
  id: 'chadsvasc',
  name: 'CHA₂DS₂-VASc',
  specialty: 'Cardiology',
  description: 'Stroke risk in non-valvular atrial fibrillation.',
  fields: [
    bin('chf', 'Congestive heart failure', 1),
    bin('htn', 'Hypertension', 1),
    bin('age75', 'Age ≥ 75', 2),
    bin('dm', 'Diabetes mellitus', 1),
    bin('stroke', 'Prior stroke / TIA / thromboembolism', 2),
    bin('vasc', 'Vascular disease (MI, PAD, aortic plaque)', 1),
    bin('age65', 'Age 65–74', 1),
    bin('sex', 'Sex category — female', 1),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s === 0) return { score: s, category: 'Low risk', risk: 'low', interpretation: 'No anticoagulation recommended.' };
    if (s === 1) return { score: s, category: 'Moderate risk', risk: 'moderate', interpretation: 'Consider anticoagulation (especially if non-female sex point).' };
    return { score: s, category: 'High risk', risk: 'high', interpretation: 'Oral anticoagulation recommended.' };
  },
};

const timi: Calculator = {
  id: 'timi',
  name: 'TIMI (UA/NSTEMI)',
  specialty: 'Cardiology',
  description: '14-day risk of death, MI or urgent revascularisation in UA/NSTEMI.',
  fields: [
    bin('age', 'Age ≥ 65'),
    bin('rf', '≥ 3 CAD risk factors'),
    bin('stenosis', 'Prior coronary stenosis ≥ 50%'),
    bin('st', 'ST deviation on ECG'),
    bin('angina', '≥ 2 anginal events in last 24 h'),
    bin('asa', 'Aspirin use in past 7 days'),
    bin('markers', 'Elevated cardiac markers'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 2) return { score: s, category: 'Low risk', risk: 'low', interpretation: '~5–8% 14-day event rate.' };
    if (s <= 4) return { score: s, category: 'Intermediate risk', risk: 'moderate', interpretation: '~13–20% event rate — consider early invasive strategy.' };
    return { score: s, category: 'High risk', risk: 'high', interpretation: '~26–41% event rate — early invasive strategy indicated.' };
  },
};

const wellsPE: Calculator = {
  id: 'wells-pe',
  name: 'Wells Criteria (PE)',
  specialty: 'Cardiology',
  description: 'Pre-test probability of pulmonary embolism.',
  fields: [
    sel('dvt', 'Clinical signs of DVT', [{ label: 'No', value: 0 }, { label: 'Yes (+3)', value: 3 }]),
    sel('altdx', 'PE is most likely diagnosis', [{ label: 'No', value: 0 }, { label: 'Yes (+3)', value: 3 }]),
    sel('hr', 'HR > 100', [{ label: 'No', value: 0 }, { label: 'Yes (+1.5)', value: 1.5 }]),
    sel('immob', 'Immobilisation / surgery in past 4 weeks', [{ label: 'No', value: 0 }, { label: 'Yes (+1.5)', value: 1.5 }]),
    sel('prev', 'Previous DVT / PE', [{ label: 'No', value: 0 }, { label: 'Yes (+1.5)', value: 1.5 }]),
    sel('hemo', 'Haemoptysis', [{ label: 'No', value: 0 }, { label: 'Yes (+1)', value: 1 }]),
    sel('malig', 'Malignancy', [{ label: 'No', value: 0 }, { label: 'Yes (+1)', value: 1 }]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 4) return { score: s, category: 'PE unlikely', risk: 'low', interpretation: 'Consider D-dimer to rule out PE.' };
    return { score: s, category: 'PE likely', risk: 'high', interpretation: 'Proceed to CT pulmonary angiogram.' };
  },
};

// ── NEPHROLOGY ────────────────────────────────────────────────────────
const ckdEpi: Calculator = {
  id: 'ckd-epi',
  name: 'CKD-EPI eGFR (2021)',
  specialty: 'Nephrology',
  description: 'Estimated GFR using the 2021 CKD-EPI equation (race-free).',
  fields: [
    num('cr', 'Serum creatinine (mg/dL)', { min: 0.1, max: 20, step: 0.01 }),
    num('age', 'Age (years)', { min: 18, max: 120 }),
    sel('sex', 'Sex', [{ label: 'Male', value: 1 }, { label: 'Female', value: 0 }]),
  ],
  compute: (v) => {
    const cr = v.cr;
    const age = v.age;
    const female = v.sex === 0;
    const k = female ? 0.7 : 0.9;
    const a = female ? -0.241 : -0.302;
    const minCrK = Math.min(cr / k, 1);
    const maxCrK = Math.max(cr / k, 1);
    let egfr = 142 * Math.pow(minCrK, a) * Math.pow(maxCrK, -1.2) * Math.pow(0.9938, age);
    if (female) egfr *= 1.012;
    const eg = Math.round(egfr);
    let stage = 'G1 (normal)';
    let risk: RiskLevel = 'low';
    if (eg < 15) { stage = 'G5 (kidney failure)'; risk = 'high'; }
    else if (eg < 30) { stage = 'G4 (severe ↓)'; risk = 'high'; }
    else if (eg < 45) { stage = 'G3b (moderate–severe ↓)'; risk = 'moderate'; }
    else if (eg < 60) { stage = 'G3a (mild–moderate ↓)'; risk = 'moderate'; }
    else if (eg < 90) { stage = 'G2 (mild ↓)'; risk = 'low'; }
    return { score: `${eg} mL/min/1.73m²`, category: stage, risk, interpretation: `Stage ${stage} chronic kidney disease.` };
  },
};

const fena: Calculator = {
  id: 'fena',
  name: 'FENa',
  specialty: 'Nephrology',
  description: 'Fractional excretion of sodium — differentiates prerenal vs intrinsic AKI.',
  fields: [
    num('una', 'Urine sodium (mmol/L)', { min: 0, step: 0.1 }),
    num('pna', 'Plasma sodium (mmol/L)', { min: 100, max: 180, step: 0.1 }),
    num('ucr', 'Urine creatinine (mg/dL)', { min: 0, step: 0.1 }),
    num('pcr', 'Plasma creatinine (mg/dL)', { min: 0.1, step: 0.01 }),
  ],
  compute: (v) => {
    const fe = ((v.una * v.pcr) / (v.pna * v.ucr)) * 100;
    const f = Math.round(fe * 100) / 100;
    if (fe < 1) return { score: `${f}%`, category: 'Prerenal', risk: 'low', interpretation: 'Suggests prerenal cause — assess volume status.' };
    if (fe > 2) return { score: `${f}%`, category: 'Intrinsic renal', risk: 'high', interpretation: 'Suggests intrinsic renal injury (e.g. ATN).' };
    return { score: `${f}%`, category: 'Indeterminate', risk: 'moderate', interpretation: 'Overlap zone — correlate clinically.' };
  },
};

const uag: Calculator = {
  id: 'uag',
  name: 'Urinary Anion Gap',
  specialty: 'Nephrology',
  description: 'Differentiates renal vs GI causes of normal-AG metabolic acidosis.',
  fields: [
    num('na', 'Urine sodium (mmol/L)'),
    num('k', 'Urine potassium (mmol/L)'),
    num('cl', 'Urine chloride (mmol/L)'),
  ],
  compute: (v) => {
    const uag = v.na + v.k - v.cl;
    if (uag > 0) return { score: uag, category: 'Positive UAG', risk: 'high', interpretation: 'Suggests renal cause (e.g. RTA) — impaired NH4⁺ excretion.' };
    return { score: uag, category: 'Negative UAG', risk: 'low', interpretation: 'Suggests GI loss of bicarbonate (e.g. diarrhoea).' };
  },
};

const cockcroft: Calculator = {
  id: 'cockcroft',
  name: 'Cockcroft-Gault',
  specialty: 'Nephrology',
  description: 'Estimated creatinine clearance for drug dosing.',
  fields: [
    num('age', 'Age (years)', { min: 18, max: 120 }),
    num('wt', 'Weight (kg)', { min: 20, max: 250, step: 0.1 }),
    num('cr', 'Serum creatinine (mg/dL)', { min: 0.1, step: 0.01 }),
    sel('sex', 'Sex', [{ label: 'Male', value: 1 }, { label: 'Female', value: 0 }]),
  ],
  compute: (v) => {
    let cl = ((140 - v.age) * v.wt) / (72 * v.cr);
    if (v.sex === 0) cl *= 0.85;
    const c = Math.round(cl);
    let risk: RiskLevel = 'low';
    let cat = 'Normal';
    if (c < 30) { risk = 'high'; cat = 'Severe impairment'; }
    else if (c < 60) { risk = 'moderate'; cat = 'Moderate impairment'; }
    else if (c < 90) { risk = 'low'; cat = 'Mild impairment'; }
    return { score: `${c} mL/min`, category: cat, risk, interpretation: 'Use for renally-cleared drug dose adjustment.' };
  },
};

// ── GASTROENTEROLOGY ──────────────────────────────────────────────────
const childPugh: Calculator = {
  id: 'child-pugh',
  name: 'Child-Pugh',
  specialty: 'Gastroenterology',
  description: 'Severity of chronic liver disease and 1- and 2-year survival.',
  fields: [
    sel('bili', 'Bilirubin (mg/dL)', [
      { label: '< 2', value: 1 }, { label: '2–3', value: 2 }, { label: '> 3', value: 3 },
    ]),
    sel('alb', 'Albumin (g/dL)', [
      { label: '> 3.5', value: 1 }, { label: '2.8–3.5', value: 2 }, { label: '< 2.8', value: 3 },
    ]),
    sel('inr', 'INR', [
      { label: '< 1.7', value: 1 }, { label: '1.7–2.3', value: 2 }, { label: '> 2.3', value: 3 },
    ]),
    sel('ascites', 'Ascites', [
      { label: 'None', value: 1 }, { label: 'Mild', value: 2 }, { label: 'Moderate–severe', value: 3 },
    ]),
    sel('enceph', 'Encephalopathy', [
      { label: 'None', value: 1 }, { label: 'Grade 1–2', value: 2 }, { label: 'Grade 3–4', value: 3 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 6) return { score: s, category: 'Class A', risk: 'low', interpretation: 'Well-compensated cirrhosis (~100% 1-yr survival).' };
    if (s <= 9) return { score: s, category: 'Class B', risk: 'moderate', interpretation: 'Significant functional compromise (~80% 1-yr survival).' };
    return { score: s, category: 'Class C', risk: 'high', interpretation: 'Decompensated disease (~45% 1-yr survival).' };
  },
};

const meld: Calculator = {
  id: 'meld',
  name: 'MELD Score',
  specialty: 'Gastroenterology',
  description: '3-month mortality in end-stage liver disease.',
  fields: [
    num('bili', 'Bilirubin (mg/dL)', { min: 0.1, step: 0.1 }),
    num('cr', 'Creatinine (mg/dL)', { min: 0.1, step: 0.01 }),
    num('inr', 'INR', { min: 0.5, step: 0.1 }),
  ],
  compute: (v) => {
    const cap = (x: number) => Math.max(x, 1);
    const cr = Math.min(v.cr, 4);
    const meld = 3.78 * Math.log(cap(v.bili)) + 11.2 * Math.log(cap(v.inr)) + 9.57 * Math.log(cap(cr)) + 6.43;
    const s = Math.round(meld);
    if (s < 10) return { score: s, category: 'Low', risk: 'low', interpretation: '~1.9% 3-month mortality.' };
    if (s < 20) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: '~6–20% 3-month mortality.' };
    if (s < 30) return { score: s, category: 'High', risk: 'high', interpretation: '~20–50% 3-month mortality.' };
    return { score: s, category: 'Very high', risk: 'high', interpretation: '> 50% 3-month mortality — transplant priority.' };
  },
};

const blatchford: Calculator = {
  id: 'blatchford',
  name: 'Glasgow-Blatchford',
  specialty: 'Gastroenterology',
  description: 'Risk stratification for upper GI bleeding.',
  fields: [
    sel('urea', 'Blood urea (mmol/L)', [
      { label: '< 6.5', value: 0 }, { label: '6.5–7.9', value: 2 },
      { label: '8.0–9.9', value: 3 }, { label: '10–24.9', value: 4 }, { label: '≥ 25', value: 6 },
    ]),
    sel('hb', 'Haemoglobin (g/dL)', [
      { label: '≥ 13', value: 0 }, { label: '12–12.9', value: 1 },
      { label: '10–11.9', value: 3 }, { label: '< 10', value: 6 },
    ]),
    sel('sbp', 'Systolic BP (mmHg)', [
      { label: '≥ 110', value: 0 }, { label: '100–109', value: 1 },
      { label: '90–99', value: 2 }, { label: '< 90', value: 3 },
    ]),
    bin('hr', 'Pulse ≥ 100'),
    bin('mel', 'Presentation with melaena'),
    bin('syn', 'Presentation with syncope', 2),
    bin('hep', 'Hepatic disease', 2),
    bin('chf', 'Cardiac failure', 2),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s === 0) return { score: s, category: 'Very low risk', risk: 'low', interpretation: 'May be considered for outpatient management.' };
    if (s <= 5) return { score: s, category: 'Low–intermediate', risk: 'moderate', interpretation: 'Admit for observation and endoscopy.' };
    return { score: s, category: 'High risk', risk: 'high', interpretation: 'Urgent endoscopy and active resuscitation.' };
  },
};

const ranson: Calculator = {
  id: 'ranson',
  name: "Ranson's Criteria",
  specialty: 'Gastroenterology',
  description: 'Severity of acute pancreatitis at admission and 48 h.',
  fields: [
    bin('age', 'Age > 55', 1, 'At admission'),
    bin('wbc', 'WBC > 16 ×10⁹/L', 1, 'At admission'),
    bin('glu', 'Glucose > 200 mg/dL', 1, 'At admission'),
    bin('ldh', 'LDH > 350 IU/L', 1, 'At admission'),
    bin('ast', 'AST > 250 IU/L', 1, 'At admission'),
    bin('hct', 'Hct decrease > 10%', 1, 'At 48 hours'),
    bin('bun', 'BUN increase > 5 mg/dL', 1, 'At 48 hours'),
    bin('ca', 'Calcium < 8 mg/dL', 1, 'At 48 hours'),
    bin('pao2', 'PaO₂ < 60 mmHg', 1, 'At 48 hours'),
    bin('be', 'Base deficit > 4 mEq/L', 1, 'At 48 hours'),
    bin('fluid', 'Fluid sequestration > 6 L', 1, 'At 48 hours'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 2) return { score: s, category: 'Mild', risk: 'low', interpretation: '< 1% mortality.' };
    if (s <= 4) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: '~15% mortality.' };
    return { score: s, category: 'Severe', risk: 'high', interpretation: '≥ 40% mortality — ICU care.' };
  },
};

// ── NEUROLOGY ─────────────────────────────────────────────────────────
const gcs: Calculator = {
  id: 'gcs',
  name: 'Glasgow Coma Scale',
  specialty: 'Neurology',
  description: 'Conscious level after head injury or acute illness (3–15).',
  fields: [
    sel('eye', 'Eye opening', [
      { label: 'Spontaneous', value: 4 }, { label: 'To speech', value: 3 },
      { label: 'To pain', value: 2 }, { label: 'None', value: 1 },
    ]),
    sel('verbal', 'Verbal response', [
      { label: 'Oriented', value: 5 }, { label: 'Confused', value: 4 },
      { label: 'Inappropriate words', value: 3 }, { label: 'Incomprehensible sounds', value: 2 },
      { label: 'None', value: 1 },
    ]),
    sel('motor', 'Motor response', [
      { label: 'Obeys commands', value: 6 }, { label: 'Localises pain', value: 5 },
      { label: 'Withdraws from pain', value: 4 }, { label: 'Abnormal flexion', value: 3 },
      { label: 'Extension', value: 2 }, { label: 'None', value: 1 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s >= 13) return { score: s, category: 'Mild', risk: 'low', interpretation: 'Mild brain injury.' };
    if (s >= 9) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: 'Moderate brain injury — close neuro obs.' };
    return { score: s, category: 'Severe', risk: 'high', interpretation: 'Severe injury — consider intubation, urgent imaging.' };
  },
};

const nihssScale = (max: number) => Array.from({ length: max + 1 }, (_, i) => ({ label: String(i), value: i }));

const nihss: Calculator = {
  id: 'nihss',
  name: 'NIHSS',
  specialty: 'Neurology',
  description: 'NIH Stroke Scale — quantifies stroke-related deficit (0–42).',
  fields: [
    sel('loc', 'LOC', nihssScale(3)),
    sel('locq', 'LOC questions', nihssScale(2)),
    sel('locc', 'LOC commands', nihssScale(2)),
    sel('gaze', 'Best gaze', nihssScale(2)),
    sel('visual', 'Visual fields', nihssScale(3)),
    sel('facial', 'Facial palsy', nihssScale(3)),
    sel('armL', 'Motor — left arm', nihssScale(4)),
    sel('armR', 'Motor — right arm', nihssScale(4)),
    sel('legL', 'Motor — left leg', nihssScale(4)),
    sel('legR', 'Motor — right leg', nihssScale(4)),
    sel('ataxia', 'Limb ataxia', nihssScale(2)),
    sel('sensory', 'Sensory', nihssScale(2)),
    sel('language', 'Best language', nihssScale(3)),
    sel('dysarthria', 'Dysarthria', nihssScale(2)),
    sel('extinct', 'Extinction / inattention', nihssScale(2)),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s === 0) return { score: s, category: 'No stroke symptoms', risk: 'low', interpretation: 'No measurable deficit.' };
    if (s <= 4) return { score: s, category: 'Minor', risk: 'low', interpretation: 'Minor stroke.' };
    if (s <= 15) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: 'Moderate stroke — consider thrombolysis / thrombectomy work-up.' };
    if (s <= 20) return { score: s, category: 'Moderate–severe', risk: 'high', interpretation: 'Significant deficit — urgent stroke pathway.' };
    return { score: s, category: 'Severe', risk: 'high', interpretation: 'Severe stroke — high mortality, ICU level care.' };
  },
};

const abcd2: Calculator = {
  id: 'abcd2',
  name: 'ABCD² Score',
  specialty: 'Neurology',
  description: '2-day stroke risk after TIA.',
  fields: [
    bin('age', 'Age ≥ 60'),
    bin('bp', 'BP ≥ 140/90 mmHg'),
    sel('clin', 'Clinical features', [
      { label: 'Unilateral weakness', value: 2 },
      { label: 'Speech disturbance without weakness', value: 1 },
      { label: 'Other', value: 0 },
    ]),
    sel('dur', 'Duration', [
      { label: '≥ 60 min', value: 2 }, { label: '10–59 min', value: 1 }, { label: '< 10 min', value: 0 },
    ]),
    bin('dm', 'Diabetes'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 3) return { score: s, category: 'Low', risk: 'low', interpretation: '~1.0% 2-day stroke risk.' };
    if (s <= 5) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: '~4.1% 2-day stroke risk.' };
    return { score: s, category: 'High', risk: 'high', interpretation: '~8.1% 2-day stroke risk — admit and image urgently.' };
  },
};

const huntHess: Calculator = {
  id: 'hunt-hess',
  name: 'Hunt and Hess',
  specialty: 'Neurology',
  description: 'Clinical grading of subarachnoid haemorrhage severity.',
  fields: [
    sel('grade', 'Grade', [
      { label: 'I — Asymptomatic / mild headache', value: 1 },
      { label: 'II — Moderate–severe headache, no deficit (except CN palsy)', value: 2 },
      { label: 'III — Drowsy, mild focal deficit', value: 3 },
      { label: 'IV — Stuporous, hemiparesis', value: 4 },
      { label: 'V — Deep coma, decerebrate posturing', value: 5 },
    ]),
  ],
  compute: (v) => {
    const s = v.grade;
    const map: Record<number, { cat: string; mort: string; risk: RiskLevel }> = {
      1: { cat: 'Grade I', mort: '~1%', risk: 'low' },
      2: { cat: 'Grade II', mort: '~5%', risk: 'low' },
      3: { cat: 'Grade III', mort: '~19%', risk: 'moderate' },
      4: { cat: 'Grade IV', mort: '~42%', risk: 'high' },
      5: { cat: 'Grade V', mort: '~77%', risk: 'high' },
    };
    const m = map[s];
    return { score: s, category: m.cat, risk: m.risk, interpretation: `Approximate mortality ${m.mort}.` };
  },
};

const ichScore: Calculator = {
  id: 'ich',
  name: 'ICH Score',
  specialty: 'Neurology',
  description: '30-day mortality after intracerebral haemorrhage.',
  fields: [
    sel('gcs', 'GCS', [
      { label: '3–4', value: 2 }, { label: '5–12', value: 1 }, { label: '13–15', value: 0 },
    ]),
    bin('vol', 'ICH volume ≥ 30 cm³'),
    bin('ivh', 'Intraventricular haemorrhage'),
    bin('infra', 'Infratentorial origin'),
    bin('age', 'Age ≥ 80'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    const mort: Record<number, string> = { 0: '0%', 1: '13%', 2: '26%', 3: '72%', 4: '97%', 5: '100%', 6: '100%' };
    const risk: RiskLevel = s <= 1 ? 'low' : s <= 2 ? 'moderate' : 'high';
    return { score: s, category: `30-day mortality ~${mort[s]}`, risk, interpretation: 'Predicts 30-day mortality after spontaneous ICH.' };
  },
};

// ── RESPIRATORY ───────────────────────────────────────────────────────
const curb65: Calculator = {
  id: 'curb65',
  name: 'CURB-65',
  specialty: 'Respiratory',
  description: 'Severity of community-acquired pneumonia.',
  fields: [
    bin('c', 'Confusion (new disorientation)'),
    bin('u', 'Urea > 7 mmol/L'),
    bin('r', 'Respiratory rate ≥ 30'),
    bin('b', 'SBP < 90 or DBP ≤ 60'),
    bin('age', 'Age ≥ 65'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 1) return { score: s, category: 'Low severity', risk: 'low', interpretation: 'Outpatient treatment possible.' };
    if (s === 2) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: 'Consider hospital admission.' };
    return { score: s, category: 'Severe', risk: 'high', interpretation: 'Severe CAP — inpatient / ICU.' };
  },
};

const wellsDVT: Calculator = {
  id: 'wells-dvt',
  name: 'Wells DVT Criteria',
  specialty: 'Respiratory',
  description: 'Pre-test probability of deep vein thrombosis.',
  fields: [
    bin('cancer', 'Active cancer'),
    bin('paresis', 'Paralysis / paresis / recent plaster'),
    bin('bedridden', 'Bedridden > 3 days or surgery in 12 weeks'),
    bin('tender', 'Localised tenderness along deep veins'),
    bin('swelling', 'Entire leg swollen'),
    bin('calf', 'Calf swelling > 3 cm vs other side'),
    bin('oedema', 'Pitting oedema (greater on symptomatic leg)'),
    bin('collateral', 'Collateral superficial veins'),
    sel('altdx', 'Alternative diagnosis as likely', [{ label: 'No', value: 0 }, { label: 'Yes (−2)', value: -2 }]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 0) return { score: s, category: 'Low probability', risk: 'low', interpretation: '~5% probability — D-dimer to rule out.' };
    if (s <= 2) return { score: s, category: 'Moderate', risk: 'moderate', interpretation: '~17% probability — D-dimer or US.' };
    return { score: s, category: 'High probability', risk: 'high', interpretation: '~53% probability — proceed to compression US.' };
  },
};

const decaf: Calculator = {
  id: 'decaf',
  name: 'DECAF Score',
  specialty: 'Respiratory',
  description: 'In-hospital mortality in acute exacerbation of COPD.',
  fields: [
    sel('d', 'Dyspnoea (eMRCD)', [
      { label: '< 5a', value: 0 }, { label: '5a (too breathless to leave house, independent)', value: 1 }, { label: '5b (dependent for wash/dress)', value: 2 },
    ]),
    bin('e', 'Eosinopenia (< 0.05 ×10⁹/L)'),
    bin('c', 'Consolidation on CXR'),
    bin('a', 'Acidaemia pH < 7.30'),
    bin('af', 'Atrial fibrillation'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 1) return { score: s, category: 'Low risk', risk: 'low', interpretation: 'Consider supported discharge.' };
    if (s === 2) return { score: s, category: 'Intermediate', risk: 'moderate', interpretation: 'Admit; mortality ~8%.' };
    return { score: s, category: 'High', risk: 'high', interpretation: 'High mortality (~24–70%) — escalate care.' };
  },
};

const psi: Calculator = {
  id: 'psi',
  name: 'PSI / PORT',
  specialty: 'Respiratory',
  description: 'Pneumonia severity index — 30-day mortality in CAP.',
  fields: [
    num('age', 'Age (years)', { min: 18 }),
    sel('sex', 'Sex', [{ label: 'Male', value: 0 }, { label: 'Female (−10)', value: -10 }]),
    bin('nh', 'Nursing home resident', 10),
    bin('neop', 'Neoplastic disease', 30),
    bin('liver', 'Liver disease', 20),
    bin('chf', 'CHF', 10),
    bin('cvd', 'Cerebrovascular disease', 10),
    bin('renal', 'Renal disease', 10),
    bin('ams', 'Altered mental status', 20),
    bin('rr', 'RR ≥ 30', 20),
    bin('sbp', 'SBP < 90', 20),
    bin('temp', 'Temp < 35 or ≥ 40°C', 15),
    bin('hr', 'HR ≥ 125', 10),
    bin('ph', 'Arterial pH < 7.35', 30),
    bin('bun', 'BUN ≥ 30 mg/dL', 20),
    bin('na', 'Sodium < 130 mmol/L', 20),
    bin('glu', 'Glucose ≥ 250 mg/dL', 10),
    bin('hct', 'Haematocrit < 30%', 10),
    bin('pao2', 'PaO₂ < 60 mmHg', 10),
    bin('pleural', 'Pleural effusion on CXR', 10),
  ],
  compute: (v) => {
    const s = sumAll(v);
    let cls = 'I', risk: RiskLevel = 'low', interp = '~0.1% mortality — outpatient.';
    if (s > 130) { cls = 'V'; risk = 'high'; interp = '~27% mortality — ICU.'; }
    else if (s > 90) { cls = 'IV'; risk = 'high'; interp = '~9% mortality — inpatient.'; }
    else if (s > 70) { cls = 'III'; risk = 'moderate'; interp = '~2.8% mortality — short admission.'; }
    else if (s > 0 || v.age >= 50) { cls = 'II'; risk = 'low'; interp = '~0.6% mortality — outpatient.'; }
    return { score: s, category: `Class ${cls}`, risk, interpretation: interp };
  },
};

const bode: Calculator = {
  id: 'bode',
  name: 'BODE Index',
  specialty: 'Respiratory',
  description: '4-year survival prediction in COPD.',
  fields: [
    sel('fev1', 'FEV₁ % predicted', [
      { label: '≥ 65', value: 0 }, { label: '50–64', value: 1 },
      { label: '36–49', value: 2 }, { label: '≤ 35', value: 3 },
    ]),
    sel('walk', '6-minute walk (m)', [
      { label: '≥ 350', value: 0 }, { label: '250–349', value: 1 },
      { label: '150–249', value: 2 }, { label: '≤ 149', value: 3 },
    ]),
    sel('mmrc', 'mMRC dyspnoea', [
      { label: '0–1', value: 0 }, { label: '2', value: 1 },
      { label: '3', value: 2 }, { label: '4', value: 3 },
    ]),
    sel('bmi', 'BMI', [{ label: '> 21', value: 0 }, { label: '≤ 21', value: 1 }]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 2) return { score: s, category: 'Quartile 1', risk: 'low', interpretation: '~80% 4-yr survival.' };
    if (s <= 4) return { score: s, category: 'Quartile 2', risk: 'moderate', interpretation: '~67% 4-yr survival.' };
    if (s <= 6) return { score: s, category: 'Quartile 3', risk: 'high', interpretation: '~57% 4-yr survival.' };
    return { score: s, category: 'Quartile 4', risk: 'high', interpretation: '~18% 4-yr survival.' };
  },
};

// ── OBS / GYNAE ───────────────────────────────────────────────────────
const apgar: Calculator = {
  id: 'apgar',
  name: 'Apgar Score',
  specialty: 'Obs/Gynae',
  description: 'Neonatal status at 1 and 5 minutes (0–10).',
  fields: [
    sel('appearance', 'Appearance', [{ label: 'Blue/pale', value: 0 }, { label: 'Acrocyanotic', value: 1 }, { label: 'Pink', value: 2 }]),
    sel('pulse', 'Pulse', [{ label: 'Absent', value: 0 }, { label: '< 100', value: 1 }, { label: '≥ 100', value: 2 }]),
    sel('grimace', 'Grimace (reflex)', [{ label: 'None', value: 0 }, { label: 'Grimace', value: 1 }, { label: 'Cry / cough', value: 2 }]),
    sel('activity', 'Activity (tone)', [{ label: 'Flaccid', value: 0 }, { label: 'Some flexion', value: 1 }, { label: 'Active', value: 2 }]),
    sel('resp', 'Respiration', [{ label: 'Absent', value: 0 }, { label: 'Slow / irregular', value: 1 }, { label: 'Strong cry', value: 2 }]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s >= 7) return { score: s, category: 'Normal', risk: 'low', interpretation: 'Routine care.' };
    if (s >= 4) return { score: s, category: 'Moderate concern', risk: 'moderate', interpretation: 'May need stimulation / supplemental O₂.' };
    return { score: s, category: 'Critical', risk: 'high', interpretation: 'Immediate resuscitation required.' };
  },
};

const pphRisk: Calculator = {
  id: 'pph-risk',
  name: 'PPH Risk Score',
  specialty: 'Obs/Gynae',
  description: 'Antenatal risk score for postpartum haemorrhage.',
  fields: [
    bin('prev', 'Previous PPH', 3),
    bin('cs', 'Previous caesarean', 2),
    bin('multi', 'Multiple pregnancy', 2),
    bin('poly', 'Polyhydramnios', 2),
    bin('fib', 'Fibroids', 2),
    bin('prev_praev', 'Placenta praevia', 3),
    bin('bmi', 'BMI > 35'),
    bin('prol', 'Prolonged labour'),
    bin('oxy', 'Oxytocin use'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 2) return { score: s, category: 'Low risk', risk: 'low', interpretation: 'Standard active management of 3rd stage.' };
    if (s <= 4) return { score: s, category: 'Intermediate', risk: 'moderate', interpretation: 'Group & save, IV access, alert team.' };
    return { score: s, category: 'High risk', risk: 'high', interpretation: 'Cross-match, deliver in obstetric-led unit, plan accordingly.' };
  },
};

const vbac: Calculator = {
  id: 'vbac',
  name: 'VBAC Success (Grobman)',
  specialty: 'Obs/Gynae',
  description: 'Predicted likelihood of successful vaginal birth after caesarean.',
  fields: [
    bin('age', 'Age < 35'),
    bin('bmi', 'BMI < 30'),
    bin('eth', 'Non-Black / non-Hispanic ethnicity'),
    bin('vd', 'Previous vaginal delivery'),
    bin('vbac', 'Previous successful VBAC'),
    bin('dil', 'Cervical dilation ≥ 4 cm on admission'),
    bin('eff', 'Cervical effacement ≥ 75%'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    const pct = Math.min(40 + s * 8, 92);
    let risk: RiskLevel = 'high';
    if (pct >= 70) risk = 'low';
    else if (pct >= 50) risk = 'moderate';
    return { score: `${pct}%`, category: `${pct}% predicted success`, risk, interpretation: 'Counsel re: TOLAC vs elective repeat caesarean.' };
  },
};

const meows: Calculator = {
  id: 'meows',
  name: 'MEOWS',
  specialty: 'Obs/Gynae',
  description: 'Modified Early Obstetric Warning Score — escalation triggers.',
  fields: [
    sel('rr', 'Respiratory rate', [
      { label: '11–20', value: 0 }, { label: '21–29 or < 11', value: 1 }, { label: '≥ 30', value: 2 },
    ]),
    sel('hr', 'Heart rate', [
      { label: '60–110', value: 0 }, { label: '111–119 or 51–59', value: 1 }, { label: '≥ 120 or ≤ 50', value: 2 },
    ]),
    sel('sbp', 'Systolic BP', [
      { label: '90–139', value: 0 }, { label: '140–159 or 80–89', value: 1 }, { label: '≥ 160 or < 80', value: 2 },
    ]),
    sel('dbp', 'Diastolic BP', [
      { label: '< 90', value: 0 }, { label: '90–99', value: 1 }, { label: '≥ 100', value: 2 },
    ]),
    sel('temp', 'Temperature (°C)', [
      { label: '36–37.4', value: 0 }, { label: '35–35.9 or 37.5–37.9', value: 1 }, { label: '< 35 or ≥ 38', value: 2 },
    ]),
    sel('spo2', 'SpO₂', [{ label: '≥ 96%', value: 0 }, { label: '94–95%', value: 1 }, { label: '< 94%', value: 2 }]),
    sel('avpu', 'Neurological (AVPU)', [
      { label: 'Alert', value: 0 }, { label: 'Voice', value: 1 }, { label: 'Pain / Unresponsive', value: 2 },
    ]),
    sel('lochia', 'Lochia', [
      { label: 'Normal', value: 0 }, { label: 'Heavy / offensive', value: 1 }, { label: 'Foul / large clots', value: 2 },
    ]),
  ],
  compute: (v) => {
    const vals = Object.values(v);
    const maxTrig = Math.max(...vals);
    const s = sumAll(v);
    if (maxTrig === 0) return { score: s, category: 'White — normal', risk: 'low', interpretation: 'Continue routine observations.' };
    if (maxTrig === 1) return { score: s, category: 'Yellow trigger', risk: 'moderate', interpretation: 'Inform midwife in charge; reassess within 30 min.' };
    return { score: s, category: 'Red trigger', risk: 'high', interpretation: 'Urgent senior obstetric / anaesthetic review.' };
  },
};

// ── EMERGENCY / SEPSIS ────────────────────────────────────────────────
const alvarado: Calculator = {
  id: 'alvarado',
  name: 'Alvarado Score',
  specialty: 'Emergency',
  description: 'Likelihood of acute appendicitis (0–10).',
  fields: [
    bin('migration', 'Migration of pain to RIF'),
    bin('anorexia', 'Anorexia'),
    bin('nausea', 'Nausea / vomiting'),
    bin('rif', 'RIF tenderness', 2),
    bin('rebound', 'Rebound tenderness'),
    bin('temp', 'Temperature > 37.3°C'),
    bin('wbc', 'Leukocytosis (WBC > 10)', 2),
    bin('shift', 'Left shift (neutrophils > 75%)'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 3) return { score: s, category: 'Unlikely', risk: 'low', interpretation: 'Appendicitis unlikely — consider alternative dx.' };
    if (s <= 6) return { score: s, category: 'Possible', risk: 'moderate', interpretation: 'Observe / further imaging.' };
    return { score: s, category: 'Probable', risk: 'high', interpretation: 'Probable appendicitis — surgical consult.' };
  },
};

const qsofa: Calculator = {
  id: 'qsofa',
  name: 'qSOFA',
  specialty: 'Emergency',
  description: 'Bedside sepsis screen outside ICU.',
  fields: [
    bin('rr', 'Respiratory rate ≥ 22'),
    bin('ams', 'Altered mentation (GCS < 15)'),
    bin('sbp', 'Systolic BP ≤ 100 mmHg'),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s < 2) return { score: s, category: 'Low risk', risk: 'low', interpretation: 'Sepsis less likely — continue monitoring.' };
    return { score: s, category: 'High risk', risk: 'high', interpretation: 'High risk of poor outcome — initiate sepsis protocol.' };
  },
};

const news2: Calculator = {
  id: 'news2',
  name: 'NEWS2',
  specialty: 'Emergency',
  description: 'National Early Warning Score 2 — acute deterioration.',
  fields: [
    sel('rr', 'Respiratory rate', [
      { label: '12–20', value: 0 }, { label: '9–11', value: 1 }, { label: '21–24', value: 2 }, { label: '≤ 8 or ≥ 25', value: 3 },
    ]),
    sel('spo2', 'SpO₂ (Scale 1)', [
      { label: '≥ 96%', value: 0 }, { label: '94–95%', value: 1 }, { label: '92–93%', value: 2 }, { label: '≤ 91%', value: 3 },
    ]),
    bin('o2', 'Supplemental oxygen', 2),
    sel('sbp', 'Systolic BP', [
      { label: '111–219', value: 0 }, { label: '101–110', value: 1 }, { label: '91–100', value: 2 }, { label: '≤ 90 or ≥ 220', value: 3 },
    ]),
    sel('hr', 'Heart rate', [
      { label: '51–90', value: 0 }, { label: '41–50 or 91–110', value: 1 }, { label: '111–130', value: 2 }, { label: '≤ 40 or ≥ 131', value: 3 },
    ]),
    sel('cons', 'Consciousness (ACVPU)', [{ label: 'Alert', value: 0 }, { label: 'New confusion / V / P / U', value: 3 }]),
    sel('temp', 'Temperature (°C)', [
      { label: '36.1–38.0', value: 0 }, { label: '35.1–36.0 or 38.1–39.0', value: 1 }, { label: '≥ 39.1', value: 2 }, { label: '≤ 35', value: 3 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s === 0) return { score: s, category: 'Low', risk: 'low', interpretation: 'Routine monitoring (12-hourly).' };
    if (s <= 4) return { score: s, category: 'Low', risk: 'low', interpretation: 'Minimum 4–6 hourly observations.' };
    if (s <= 6) return { score: s, category: 'Medium', risk: 'moderate', interpretation: 'Urgent review by competent clinician; hourly obs.' };
    return { score: s, category: 'High', risk: 'high', interpretation: 'Emergency assessment by critical care team; continuous monitoring.' };
  },
};

const sofa: Calculator = {
  id: 'sofa',
  name: 'SOFA Score',
  specialty: 'Emergency',
  description: 'Sequential Organ Failure Assessment — ICU organ dysfunction.',
  fields: [
    sel('resp', 'Respiratory (PaO₂/FiO₂)', [
      { label: '≥ 400', value: 0 }, { label: '< 400', value: 1 }, { label: '< 300', value: 2 },
      { label: '< 200 with support', value: 3 }, { label: '< 100 with support', value: 4 },
    ]),
    sel('neuro', 'Neurological (GCS)', [
      { label: '15', value: 0 }, { label: '13–14', value: 1 }, { label: '10–12', value: 2 }, { label: '6–9', value: 3 }, { label: '< 6', value: 4 },
    ]),
    sel('cv', 'Cardiovascular', [
      { label: 'MAP ≥ 70', value: 0 }, { label: 'MAP < 70', value: 1 },
      { label: 'Dopamine ≤ 5 / dobutamine', value: 2 }, { label: 'Dopamine > 5 or NA ≤ 0.1', value: 3 }, { label: 'Dopamine > 15 or NA > 0.1', value: 4 },
    ]),
    sel('liver', 'Hepatic (bilirubin mg/dL)', [
      { label: '< 1.2', value: 0 }, { label: '1.2–1.9', value: 1 }, { label: '2.0–5.9', value: 2 }, { label: '6.0–11.9', value: 3 }, { label: '> 12', value: 4 },
    ]),
    sel('coag', 'Coagulation (platelets ×10⁹/L)', [
      { label: '≥ 150', value: 0 }, { label: '< 150', value: 1 }, { label: '< 100', value: 2 }, { label: '< 50', value: 3 }, { label: '< 20', value: 4 },
    ]),
    sel('renal', 'Renal (creatinine mg/dL)', [
      { label: '< 1.2', value: 0 }, { label: '1.2–1.9', value: 1 }, { label: '2.0–3.4', value: 2 }, { label: '3.5–4.9', value: 3 }, { label: '> 5.0', value: 4 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s < 2) return { score: s, category: 'No organ dysfunction', risk: 'low', interpretation: 'Baseline / no significant dysfunction.' };
    if (s < 8) return { score: s, category: 'Organ dysfunction', risk: 'moderate', interpretation: '≥ 2 points = sepsis criterion in suspected infection.' };
    return { score: s, category: 'Severe dysfunction', risk: 'high', interpretation: 'High mortality — escalate ICU support.' };
  },
};

const pews: Calculator = {
  id: 'pews',
  name: 'PEWS',
  specialty: 'Emergency',
  description: 'Paediatric Early Warning Score — clinical deterioration in children.',
  fields: [
    sel('behaviour', 'Behaviour', [
      { label: 'Playing / appropriate', value: 0 }, { label: 'Sleeping', value: 1 },
      { label: 'Irritable', value: 2 }, { label: 'Lethargic / confused / ↓ pain response', value: 3 },
    ]),
    sel('cv', 'Cardiovascular', [
      { label: 'Pink, CRT 1–2 s', value: 0 }, { label: 'Pale, CRT 3 s', value: 1 },
      { label: 'Grey, CRT 4 s, HR ↑ 20 above normal', value: 2 }, { label: 'Grey / mottled, CRT ≥ 5 s, HR ↑ 30 above normal or bradycardia', value: 3 },
    ]),
    sel('resp', 'Respiratory', [
      { label: 'Within normal range, no recession', value: 0 }, { label: 'RR > 10 above normal, accessory muscle use, FiO₂ ≥ 30%', value: 1 },
      { label: 'RR > 20 above normal, recession, FiO₂ ≥ 40%', value: 2 }, { label: '≥ 5 below normal, sternal recession, grunting, FiO₂ ≥ 50%', value: 3 },
    ]),
    bin('neb', '¼-hourly nebulisers', 2),
    bin('vom', 'Persistent vomiting post-op', 2),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 2) return { score: s, category: 'Low', risk: 'low', interpretation: 'Routine observations.' };
    if (s <= 4) return { score: s, category: 'Medium', risk: 'moderate', interpretation: 'Inform nurse-in-charge; reassess within the hour.' };
    return { score: s, category: 'High', risk: 'high', interpretation: 'Urgent medical review; escalate to paediatric team.' };
  },
};

// ── OBSTETRIC SCORE — Bishop ──────────────────────────────────────────
const bishop: Calculator = {
  id: 'bishop',
  name: 'Bishop Score',
  specialty: 'Obs/Gynae',
  description: 'Cervical favourability for induction of labour.',
  fields: [
    sel('dilation', 'Cervical dilation (cm)', [
      { label: 'Closed', value: 0 }, { label: '1–2', value: 1 }, { label: '3–4', value: 2 }, { label: '≥ 5', value: 3 },
    ]),
    sel('effacement', 'Effacement (%)', [
      { label: '0–30', value: 0 }, { label: '40–50', value: 1 }, { label: '60–70', value: 2 }, { label: '≥ 80', value: 3 },
    ]),
    sel('station', 'Fetal station', [
      { label: '−3', value: 0 }, { label: '−2', value: 1 }, { label: '−1 / 0', value: 2 }, { label: '+1 / +2', value: 3 },
    ]),
    sel('consistency', 'Consistency', [
      { label: 'Firm', value: 0 }, { label: 'Medium', value: 1 }, { label: 'Soft', value: 2 },
    ]),
    sel('position', 'Position', [
      { label: 'Posterior', value: 0 }, { label: 'Mid', value: 1 }, { label: 'Anterior', value: 2 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 5) return { score: s, category: 'Unfavourable', risk: 'high', interpretation: 'Cervical ripening likely required before induction.' };
    if (s <= 7) return { score: s, category: 'Intermediate', risk: 'moderate', interpretation: 'Induction may succeed; counsel re: ripening agents.' };
    return { score: s, category: 'Favourable', risk: 'low', interpretation: 'Favourable cervix — induction likely to succeed.' };
  },
};

// ── HAEMATOLOGY ───────────────────────────────────────────────────────
const isthDIC: Calculator = {
  id: 'isth-dic',
  name: 'ISTH DIC Score',
  specialty: 'Haematology',
  description: 'Overt disseminated intravascular coagulation in adults.',
  fields: [
    sel('plt', 'Platelet count (×10⁹/L)', [
      { label: '> 100', value: 0 }, { label: '50–100', value: 1 }, { label: '< 50', value: 2 },
    ]),
    sel('fib', 'Elevated fibrin markers (D-dimer)', [
      { label: 'No increase', value: 0 }, { label: 'Moderate increase', value: 2 }, { label: 'Strong increase', value: 3 },
    ]),
    sel('pt', 'Prolonged PT', [
      { label: '< 3 s', value: 0 }, { label: '3–6 s', value: 1 }, { label: '> 6 s', value: 2 },
    ]),
    sel('fibrinogen', 'Fibrinogen', [
      { label: '> 1 g/L', value: 0 }, { label: '< 1 g/L', value: 1 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s >= 5) return { score: s, category: 'Overt DIC', risk: 'high', interpretation: 'Compatible with overt DIC — repeat scoring daily; treat trigger.' };
    return { score: s, category: 'Non-overt', risk: 'moderate', interpretation: 'Non-overt — repeat in 1–2 days.' };
  },
};

const geneva: Calculator = {
  id: 'geneva',
  name: 'Revised Geneva (PE)',
  specialty: 'Haematology',
  description: 'Clinical pre-test probability of pulmonary embolism.',
  fields: [
    bin('age', 'Age > 65'),
    bin('prev', 'Previous DVT / PE', 3),
    bin('surg', 'Surgery / fracture in past month', 2),
    bin('malig', 'Active malignancy', 2),
    bin('pain', 'Unilateral lower limb pain', 3),
    bin('hemo', 'Haemoptysis', 2),
    sel('hr', 'Heart rate', [
      { label: '< 75', value: 0 }, { label: '75–94', value: 3 }, { label: '≥ 95', value: 5 },
    ]),
    bin('palp', 'Pain on palpation and unilateral oedema', 4),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 3) return { score: s, category: 'Low probability', risk: 'low', interpretation: '~8% PE prevalence — D-dimer to rule out.' };
    if (s <= 10) return { score: s, category: 'Intermediate', risk: 'moderate', interpretation: '~29% PE prevalence — D-dimer / imaging.' };
    return { score: s, category: 'High probability', risk: 'high', interpretation: '~74% PE prevalence — proceed to CTPA.' };
  },
};

const fourT: Calculator = {
  id: '4t',
  name: '4T Score (HIT)',
  specialty: 'Haematology',
  description: 'Probability of heparin-induced thrombocytopenia.',
  fields: [
    sel('thrombo', 'Thrombocytopenia', [
      { label: '< 30% fall or nadir < 10', value: 0 },
      { label: '30–50% fall or nadir 10–19', value: 1 },
      { label: '> 50% fall and nadir ≥ 20', value: 2 },
    ]),
    sel('timing', 'Timing of platelet fall', [
      { label: '< 4 days, no prior heparin', value: 0 },
      { label: 'Consistent with 5–10 d but unclear / < 1 d with prior heparin 30–100 d ago', value: 1 },
      { label: 'Clear onset days 5–10 or < 1 d with recent heparin (≤ 30 d)', value: 2 },
    ]),
    sel('thrombosis', 'Thrombosis or other sequelae', [
      { label: 'None', value: 0 },
      { label: 'Progressive / recurrent / silent thrombosis / erythematous skin lesion', value: 1 },
      { label: 'New thrombosis, skin necrosis, acute systemic reaction', value: 2 },
    ]),
    sel('other', 'Other causes of thrombocytopenia', [
      { label: 'Definite other cause', value: 0 },
      { label: 'Possible', value: 1 },
      { label: 'None apparent', value: 2 },
    ]),
  ],
  compute: (v) => {
    const s = sumAll(v);
    if (s <= 3) return { score: s, category: 'Low probability', risk: 'low', interpretation: '~1% HIT — continue heparin if otherwise indicated.' };
    if (s <= 5) return { score: s, category: 'Intermediate', risk: 'moderate', interpretation: '~14% HIT — stop heparin, send PF4 ELISA, alt anticoagulation.' };
    return { score: s, category: 'High', risk: 'high', interpretation: '~64% HIT — stop heparin immediately, alternative anticoagulation.' };
  },
};

const fib4: Calculator = {
  id: 'fib4',
  name: 'FIB-4 Index',
  specialty: 'Haematology',
  description: 'Non-invasive assessment of liver fibrosis.',
  fields: [
    num('age', 'Age (years)', { min: 18 }),
    num('ast', 'AST (U/L)', { min: 1 }),
    num('alt', 'ALT (U/L)', { min: 1 }),
    num('plt', 'Platelets (×10⁹/L)', { min: 1 }),
  ],
  compute: (v) => {
    const fib = (v.age * v.ast) / (v.plt * Math.sqrt(v.alt));
    const f = Math.round(fib * 100) / 100;
    if (fib < 1.3) return { score: f, category: 'Low risk', risk: 'low', interpretation: 'Advanced fibrosis unlikely — NPV ~90%.' };
    if (fib <= 2.67) return { score: f, category: 'Indeterminate', risk: 'moderate', interpretation: 'Indeterminate — consider elastography / specialist review.' };
    return { score: f, category: 'High risk', risk: 'high', interpretation: 'Advanced fibrosis likely — hepatology referral.' };
  },
};

// ── EXPORT ────────────────────────────────────────────────────────────
export const calculators: Calculator[] = [
  // Cardiology
  heart, chadsvasc, timi, wellsPE,
  // Nephrology
  ckdEpi, fena, uag, cockcroft,
  // Gastroenterology
  childPugh, meld, blatchford, ranson,
  // Neurology
  gcs, nihss, abcd2, huntHess, ichScore,
  // Respiratory
  curb65, wellsDVT, decaf, psi, bode,
  // Obs/Gynae
  apgar, pphRisk, vbac, meows, bishop,
  // Emergency
  alvarado, qsofa, news2, sofa, pews,
  // Haematology
  isthDIC, geneva, fourT, fib4,
];
