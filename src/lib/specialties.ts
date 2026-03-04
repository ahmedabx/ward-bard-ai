export type Specialty = 'all' | 'medicine' | 'surgery' | 'psychiatry' | 'gynae' | 'ophthalmology';

export const specialties: { id: Specialty; label: string; icon: string; color: string }[] = [
  { id: 'all', label: 'All', icon: '🩺', color: 'primary' },
  { id: 'medicine', label: 'Medicine', icon: '💊', color: 'specialty-medicine' },
  { id: 'surgery', label: 'Surgery', icon: '🔪', color: 'specialty-surgery' },
  { id: 'psychiatry', label: 'Psychiatry', icon: '🧠', color: 'specialty-psychiatry' },
  { id: 'gynae', label: 'Gynae/Obs', icon: '🤰', color: 'specialty-gynae' },
  { id: 'ophthalmology', label: 'Ophthalmology', icon: '👁', color: 'specialty-ophthalmology' },
];

export const specialtyReferences: Record<Exclude<Specialty, 'all'>, string[]> = {
  medicine: ["Harrison's Principles of Internal Medicine", "Oxford Handbook of Clinical Medicine", "UpToDate", "NEJM", "The Lancet"],
  surgery: ["Bailey & Love's Short Practice of Surgery", "Schwartz's Principles of Surgery", "Washington Manual of Surgery", "BMJ", "JACS"],
  psychiatry: ["DSM-5-TR", "Kaplan & Sadock's Comprehensive Textbook of Psychiatry", "Oxford Textbook of Psychiatry", "World Psychiatry"],
  gynae: ["Williams Obstetrics", "RCOG Guidelines", "ACOG Practice Bulletins", "BJOG", "WHO Reproductive Health Guidelines"],
  ophthalmology: ["Kanski's Clinical Ophthalmology", "AAO Preferred Practice Patterns", "Survey of Ophthalmology"],
};

export const suggestedQueries: { text: string; specialty: Specialty }[] = [
  { text: "First-line Rx for community-acquired pneumonia?", specialty: 'medicine' },
  { text: "Bishop score interpretation", specialty: 'gynae' },
  { text: "Acute red eye differentials", specialty: 'ophthalmology' },
  { text: "Stages of labour — when to intervene?", specialty: 'gynae' },
];

export const exampleQueriesBySpecialty: Record<Exclude<Specialty, 'all'>, string[]> = {
  medicine: ["First-line treatment for DKA?", "Criteria for diagnosing SLE", "Management of acute STEMI"],
  surgery: ["Alvarado score components", "Post-op fever differentials by day", "Indications for cholecystectomy"],
  psychiatry: ["DSM-5 criteria for MDD", "First-line SSRI for GAD", "Differentiating delirium from dementia"],
  gynae: ["Bishop score components", "HELLP syndrome management", "Stages of labour explained"],
  ophthalmology: ["Acute angle-closure glaucoma Rx", "Marcus Gunn pupil significance", "Differentials for painful red eye"],
};
