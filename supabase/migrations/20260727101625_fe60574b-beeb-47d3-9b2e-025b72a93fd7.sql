CREATE TABLE public.patient_cases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  specialty text NOT NULL,
  mode text NOT NULL DEFAULT 'clinical',
  chief_complaint text NOT NULL,
  starting_vitals jsonb NOT NULL,
  decision_points jsonb NOT NULL,
  stabilize_threshold integer NOT NULL DEFAULT 5,
  critical_threshold integer NOT NULL DEFAULT -5,
  final_score integer,
  outcome text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_cases TO authenticated;
GRANT ALL ON public.patient_cases TO service_role;

ALTER TABLE public.patient_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cases"
  ON public.patient_cases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own cases"
  ON public.patient_cases FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX patient_cases_user_created_idx ON public.patient_cases (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_patient_cases_updated_at
BEFORE UPDATE ON public.patient_cases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();