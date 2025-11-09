-- Create rubrics table
CREATE TABLE IF NOT EXISTS public.rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create rubric_criteria table
CREATE TABLE IF NOT EXISTS public.rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id UUID NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight >= 0 AND weight <= 100),
  position INTEGER NOT NULL CHECK (position >= 0)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rubrics_user_id ON public.rubrics(user_id);
CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric_id ON public.rubric_criteria(rubric_id);

-- Enable Row Level Security
ALTER TABLE public.rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rubrics table
-- Policy: Users can only view their own rubrics
CREATE POLICY "Users can view their own rubrics"
  ON public.rubrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own rubrics
CREATE POLICY "Users can insert their own rubrics"
  ON public.rubrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own rubrics
CREATE POLICY "Users can update their own rubrics"
  ON public.rubrics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rubrics
CREATE POLICY "Users can delete their own rubrics"
  ON public.rubrics
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for rubric_criteria table
-- Policy: Users can view criteria for their own rubrics
CREATE POLICY "Users can view criteria for their own rubrics"
  ON public.rubric_criteria
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics
      WHERE rubrics.id = rubric_criteria.rubric_id
      AND rubrics.user_id = auth.uid()
    )
  );

-- Policy: Users can insert criteria for their own rubrics
CREATE POLICY "Users can insert criteria for their own rubrics"
  ON public.rubric_criteria
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rubrics
      WHERE rubrics.id = rubric_criteria.rubric_id
      AND rubrics.user_id = auth.uid()
    )
  );

-- Policy: Users can update criteria for their own rubrics
CREATE POLICY "Users can update criteria for their own rubrics"
  ON public.rubric_criteria
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics
      WHERE rubrics.id = rubric_criteria.rubric_id
      AND rubrics.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rubrics
      WHERE rubrics.id = rubric_criteria.rubric_id
      AND rubrics.user_id = auth.uid()
    )
  );

-- Policy: Users can delete criteria for their own rubrics
CREATE POLICY "Users can delete criteria for their own rubrics"
  ON public.rubric_criteria
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.rubrics
      WHERE rubrics.id = rubric_criteria.rubric_id
      AND rubrics.user_id = auth.uid()
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on rubrics table
CREATE TRIGGER update_rubrics_updated_at
  BEFORE UPDATE ON public.rubrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
