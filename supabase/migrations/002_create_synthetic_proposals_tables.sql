-- Create synthetic_batches table
CREATE TABLE IF NOT EXISTS public.synthetic_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  count INTEGER NOT NULL CHECK (count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create synthetic_proposals table
CREATE TABLE IF NOT EXISTS public.synthetic_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.synthetic_batches(id) ON DELETE CASCADE,

  -- Characteristics used for generation (stored as JSONB)
  characteristics JSONB NOT NULL,

  -- Generated content
  content TEXT NOT NULL,

  -- Optional: Generation prompts used
  system_prompt TEXT,
  user_prompt_template TEXT,

  -- Optional: Link to rubric if generated for testing
  rubric_id UUID REFERENCES public.rubrics(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_synthetic_batches_user_id ON public.synthetic_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_synthetic_proposals_user_id ON public.synthetic_proposals(user_id);
CREATE INDEX IF NOT EXISTS idx_synthetic_proposals_batch_id ON public.synthetic_proposals(batch_id);
CREATE INDEX IF NOT EXISTS idx_synthetic_proposals_rubric_id ON public.synthetic_proposals(rubric_id);

-- Enable Row Level Security
ALTER TABLE public.synthetic_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_proposals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for synthetic_batches table
-- Policy: Users can only view their own batches
CREATE POLICY "Users can view their own synthetic batches"
  ON public.synthetic_batches
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own batches
CREATE POLICY "Users can insert their own synthetic batches"
  ON public.synthetic_batches
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own batches
CREATE POLICY "Users can update their own synthetic batches"
  ON public.synthetic_batches
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own batches
CREATE POLICY "Users can delete their own synthetic batches"
  ON public.synthetic_batches
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for synthetic_proposals table
-- Policy: Users can view proposals for their own batches
CREATE POLICY "Users can view their own synthetic proposals"
  ON public.synthetic_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.synthetic_batches
      WHERE synthetic_batches.id = synthetic_proposals.batch_id
      AND synthetic_batches.user_id = auth.uid()
    )
  );

-- Policy: Users can insert proposals for their own batches
CREATE POLICY "Users can insert their own synthetic proposals"
  ON public.synthetic_proposals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.synthetic_batches
      WHERE synthetic_batches.id = synthetic_proposals.batch_id
      AND synthetic_batches.user_id = auth.uid()
    )
  );

-- Policy: Users can update proposals for their own batches
CREATE POLICY "Users can update their own synthetic proposals"
  ON public.synthetic_proposals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.synthetic_batches
      WHERE synthetic_batches.id = synthetic_proposals.batch_id
      AND synthetic_batches.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.synthetic_batches
      WHERE synthetic_batches.id = synthetic_proposals.batch_id
      AND synthetic_batches.user_id = auth.uid()
    )
  );

-- Policy: Users can delete proposals for their own batches
CREATE POLICY "Users can delete their own synthetic proposals"
  ON public.synthetic_proposals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.synthetic_batches
      WHERE synthetic_batches.id = synthetic_proposals.batch_id
      AND synthetic_batches.user_id = auth.uid()
    )
  );

-- Create trigger to automatically update updated_at on synthetic_proposals table
CREATE TRIGGER update_synthetic_proposals_updated_at
  BEFORE UPDATE ON public.synthetic_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
