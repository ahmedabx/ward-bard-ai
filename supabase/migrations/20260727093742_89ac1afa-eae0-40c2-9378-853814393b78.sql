CREATE TABLE public.patient_case_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  specialty TEXT NOT NULL,
  generated_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_case_generations_user_day
  ON public.patient_case_generations (user_id, generated_on);

GRANT SELECT ON public.patient_case_generations TO authenticated;
GRANT ALL ON public.patient_case_generations TO service_role;

ALTER TABLE public.patient_case_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own case generations"
  ON public.patient_case_generations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);