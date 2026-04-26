// Calculator definitions: each field has options with label + score.
export type FieldType = 'select' | 'binary';

export interface CalcField {
  id: string;
  label: string;
  type: FieldType;
  options: { label: string; value: number }[];
}

export interface Calculator {
  id: string;
  name: string;
  description: string;
  fields: CalcField[];
  interpret: (score: number) => string;
}

const yesNo = [
  { label: 'No', value: 0 },
  { label: 'Yes', value: 1 },
];

export const calculators: Calculator[] = [
  {
    id: 'gcs',
    name: 'GCS',
    description: 'Glasgow Coma Scale — assess level of consciousness (3–15).',
    fields: [
      {
        id: 'eye',
        label: 'Eye opening',
        type: 'select',
        options: [
          { label: 'Spontaneous', value: 4 },
          { label: 'To speech', value: 3 },
          { label: 'To pain', value: 2 },
          { label: 'None', value: 1 },
        ],
      },
      {
        id: 'verbal',
        label: 'Verbal response',
        type: 'select',
        options: [
          { label: 'Oriented', value: 5 },
          { label: 'Confused conversation', value: 4 },
          { label: 'Inappropriate words', value: 3 },
          { label: 'Incomprehensible sounds', value: 2 },
          { label: 'None', value: 1 },
        ],
      },
      {
        id: 'motor',
        label: 'Motor response',
        type: 'select',
        options: [
          { label: 'Obeys commands', value: 6 },
          { label: 'Localizes pain', value: 5 },
          { label: 'Withdraws from pain', value: 4 },
          { label: 'Abnormal flexion (decorticate)', value: 3 },
          { label: 'Abnormal extension (decerebrate)', value: 2 },
          { label: 'None', value: 1 },
        ],
      },
    ],
    interpret: (s) => (s >= 13 ? 'Mild brain injury' : s >= 9 ? 'Moderate brain injury' : 'Severe brain injury'),
  },
  {
    id: 'curb65',
    name: 'CURB-65',
    description: 'Pneumonia severity score for community-acquired pneumonia (0–5).',
    fields: [
      { id: 'confusion', label: 'Confusion (new disorientation)', type: 'binary', options: yesNo },
      { id: 'urea', label: 'Urea > 7 mmol/L', type: 'binary', options: yesNo },
      { id: 'rr', label: 'Respiratory rate ≥ 30', type: 'binary', options: yesNo },
      { id: 'bp', label: 'BP: systolic < 90 or diastolic ≤ 60', type: 'binary', options: yesNo },
      { id: 'age', label: 'Age ≥ 65', type: 'binary', options: yesNo },
    ],
    interpret: (s) =>
      s <= 1 ? 'Low severity — outpatient possible' : s === 2 ? 'Moderate — consider admission' : 'Severe CAP — inpatient/ICU',
  },
  {
    id: 'alvarado',
    name: 'Alvarado Score',
    description: 'Likelihood of acute appendicitis (0–10).',
    fields: [
      { id: 'migration', label: 'Migration of pain to RIF (1)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
      { id: 'anorexia', label: 'Anorexia (1)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
      { id: 'nausea', label: 'Nausea / vomiting (1)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
      { id: 'rifTender', label: 'RIF tenderness (2)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 2 }] },
      { id: 'rebound', label: 'Rebound tenderness (1)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
      { id: 'temp', label: 'Elevated temperature > 37.3°C (1)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
      { id: 'wbc', label: 'Leukocytosis (WBC > 10) (2)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 2 }] },
      { id: 'shift', label: 'Shift to left (neutrophils > 75%) (1)', type: 'binary', options: [{ label: 'No', value: 0 }, { label: 'Yes', value: 1 }] },
    ],
    interpret: (s) =>
      s <= 3 ? 'Appendicitis unlikely' : s <= 6 ? 'Possible — observe / further imaging' : 'Probable appendicitis — surgical consult',
  },
  {
    id: 'bishop',
    name: 'Bishop Score',
    description: 'Cervical favorability for induction of labor (0–13).',
    fields: [
      {
        id: 'dilation',
        label: 'Cervical dilation (cm)',
        type: 'select',
        options: [
          { label: 'Closed', value: 0 },
          { label: '1–2', value: 1 },
          { label: '3–4', value: 2 },
          { label: '≥ 5', value: 3 },
        ],
      },
      {
        id: 'effacement',
        label: 'Effacement (%)',
        type: 'select',
        options: [
          { label: '0–30%', value: 0 },
          { label: '40–50%', value: 1 },
          { label: '60–70%', value: 2 },
          { label: '≥ 80%', value: 3 },
        ],
      },
      {
        id: 'station',
        label: 'Fetal station',
        type: 'select',
        options: [
          { label: '−3', value: 0 },
          { label: '−2', value: 1 },
          { label: '−1 / 0', value: 2 },
          { label: '+1 / +2', value: 3 },
        ],
      },
      {
        id: 'consistency',
        label: 'Cervical consistency',
        type: 'select',
        options: [
          { label: 'Firm', value: 0 },
          { label: 'Medium', value: 1 },
          { label: 'Soft', value: 2 },
        ],
      },
      {
        id: 'position',
        label: 'Cervical position',
        type: 'select',
        options: [
          { label: 'Posterior', value: 0 },
          { label: 'Mid', value: 1 },
          { label: 'Anterior', value: 2 },
        ],
      },
    ],
    interpret: (s) =>
      s <= 5 ? 'Unfavorable — cervical ripening likely needed' : s <= 7 ? 'Intermediate' : 'Favorable for induction',
  },
];
