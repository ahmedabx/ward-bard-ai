# Roadmap — Merge Qbank Maker + My Patient into "Practice"

- [ ] DB: topics / practice_sessions / practice_items tables, RLS, grants, legacy backfill (migration)
- [ ] DB: topics seed (separate editable SQL file, organ-system names only) + apply
- [ ] Edge function: practice-sessions (create-session validation + per-user rate limit), deploy
- [ ] Shared components: TopicPicker, PracticeQuestion (one MCQ component, both formats)
- [ ] PracticeSetup (/practice): format, exam, mode, topic picker, settings, Start, recent 5 sessions, quota checks
- [ ] PracticeSession (/practice/session/:id): questions flow + case stage flow, resume, persistence
- [ ] PracticeResults (/practice/results/:id): score, time, topic accuracy, review, actions
- [ ] Routes + nav: single Practice item, redirect /qbank and /my-patient, "Quiz me on this" handoff retarget
- [ ] Types regen, typecheck, build
- [ ] Browser E2E: run a questions session and a case session end-to-end
- [ ] Acceptance checks from task file

Constraints (from task file): no touches to My Assistant/Calculators/auth/global styles; keep Groq models as-is; keep generation logic as-is; no new colors/fonts/shadows/gradients; every stored item carries topic_id (null only for custom); daily limits unchanged (40 questions/day silent, 2 cases/day server-side).
