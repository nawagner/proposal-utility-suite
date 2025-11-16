import { createServerClient } from "@/lib/supabase/server";

export interface SyntheticProposalInput {
  characteristics: Record<string, string>;
  content: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  rubricId?: string;
}

export interface SyntheticProposalRecord {
  id: string;
  batchId: string;
  characteristics: Record<string, string>;
  content: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  rubricId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyntheticBatchInput {
  name?: string;
  description?: string;
  proposals: SyntheticProposalInput[];
}

export interface SyntheticBatchRecord {
  id: string;
  name: string;
  description?: string;
  count: number;
  createdAt: Date;
  proposals?: SyntheticProposalRecord[];
}

/**
 * Get Supabase client with user authentication
 */
function getAuthenticatedClient(accessToken?: string) {
  return createServerClient(accessToken);
}

/**
 * Generate a default batch name based on current date
 */
function generateDefaultBatchName(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  return `Batch from ${dateStr}`;
}

/**
 * Validate batch input
 */
function validateBatchInput(input: SyntheticBatchInput) {
  if (!Array.isArray(input.proposals) || input.proposals.length === 0) {
    throw new Error("At least one proposal is required");
  }

  if (input.proposals.length > 20) {
    throw new Error("Cannot save more than 20 proposals per batch");
  }

  for (const proposal of input.proposals) {
    if (!proposal.content || typeof proposal.content !== "string" || proposal.content.trim().length === 0) {
      throw new Error("Each proposal must have non-empty content");
    }
    if (!proposal.characteristics || typeof proposal.characteristics !== "object") {
      throw new Error("Each proposal must have characteristics");
    }
  }
}

/**
 * Save a batch of synthetic proposals for the authenticated user
 */
export async function saveSyntheticBatch(
  input: SyntheticBatchInput,
  accessToken: string
): Promise<SyntheticBatchRecord> {
  validateBatchInput(input);

  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  const batchName = input.name?.trim() || generateDefaultBatchName();
  const description = input.description?.trim();

  // Insert batch
  const { data: batch, error: batchError } = await supabase
    .from("synthetic_batches")
    .insert({
      user_id: user.id,
      name: batchName,
      description,
      count: input.proposals.length,
    })
    .select()
    .single();

  if (batchError || !batch) {
    throw new Error(`Failed to save batch: ${batchError?.message ?? "Unknown error"}`);
  }

  // Insert proposals
  const proposalsToInsert = input.proposals.map((proposal) => ({
    user_id: user.id,
    batch_id: batch.id,
    characteristics: proposal.characteristics,
    content: proposal.content.trim(),
    system_prompt: proposal.systemPrompt?.trim(),
    user_prompt_template: proposal.userPromptTemplate?.trim(),
    rubric_id: proposal.rubricId,
  }));

  const { data: proposals, error: proposalsError } = await supabase
    .from("synthetic_proposals")
    .insert(proposalsToInsert)
    .select();

  if (proposalsError || !proposals) {
    // Rollback: delete the batch if proposals insertion fails
    await supabase.from("synthetic_batches").delete().eq("id", batch.id);
    throw new Error(`Failed to save proposals: ${proposalsError?.message ?? "Unknown error"}`);
  }

  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    count: batch.count,
    createdAt: new Date(batch.created_at),
    proposals: proposals.map((p) => ({
      id: p.id,
      batchId: p.batch_id,
      characteristics: p.characteristics as Record<string, string>,
      content: p.content,
      systemPrompt: p.system_prompt,
      userPromptTemplate: p.user_prompt_template,
      rubricId: p.rubric_id,
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    })),
  };
}

/**
 * Update batch metadata (name and description)
 */
export async function updateBatch(
  id: string,
  name: string,
  description: string | undefined,
  accessToken: string
): Promise<SyntheticBatchRecord> {
  const trimmedName = name?.trim();
  if (!trimmedName) {
    throw new Error("Batch name is required");
  }

  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Update batch
  const { data: batch, error: batchError } = await supabase
    .from("synthetic_batches")
    .update({
      name: trimmedName,
      description: description?.trim(),
    })
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user owns this batch
    .select()
    .single();

  if (batchError || !batch) {
    throw new Error(`Failed to update batch: ${batchError?.message ?? "Unknown error"}`);
  }

  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    count: batch.count,
    createdAt: new Date(batch.created_at),
  };
}

/**
 * Delete a batch and all its proposals (cascade)
 */
export async function deleteBatch(id: string, accessToken: string): Promise<void> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Delete batch (proposals will be cascade deleted)
  const { error } = await supabase
    .from("synthetic_batches")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure user owns this batch

  if (error) {
    throw new Error(`Failed to delete batch: ${error.message}`);
  }
}

/**
 * List all batches for the authenticated user
 */
export async function listBatches(accessToken: string): Promise<SyntheticBatchRecord[]> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Fetch batches
  const { data: batches, error: batchesError } = await supabase
    .from("synthetic_batches")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (batchesError) {
    throw new Error(`Failed to fetch batches: ${batchesError.message}`);
  }

  return (batches ?? []).map((batch) => ({
    id: batch.id,
    name: batch.name,
    description: batch.description,
    count: batch.count,
    createdAt: new Date(batch.created_at),
  }));
}

/**
 * Get a specific batch by ID with all its proposals
 */
export async function getBatchById(
  id: string,
  accessToken: string
): Promise<SyntheticBatchRecord | null> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Fetch batch
  const { data: batch, error: batchError } = await supabase
    .from("synthetic_batches")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (batchError || !batch) {
    return null;
  }

  // Fetch proposals for this batch
  const { data: proposals, error: proposalsError } = await supabase
    .from("synthetic_proposals")
    .select("*")
    .eq("batch_id", id)
    .order("created_at", { ascending: true });

  if (proposalsError) {
    throw new Error(`Failed to fetch proposals: ${proposalsError.message}`);
  }

  return {
    id: batch.id,
    name: batch.name,
    description: batch.description,
    count: batch.count,
    createdAt: new Date(batch.created_at),
    proposals: (proposals ?? []).map((p) => ({
      id: p.id,
      batchId: p.batch_id,
      characteristics: p.characteristics as Record<string, string>,
      content: p.content,
      systemPrompt: p.system_prompt,
      userPromptTemplate: p.user_prompt_template,
      rubricId: p.rubric_id,
      createdAt: new Date(p.created_at),
      updatedAt: new Date(p.updated_at),
    })),
  };
}

/**
 * List proposals with optional filters
 */
export async function listProposals(
  accessToken: string,
  filters?: {
    batchId?: string;
    rubricId?: string;
  }
): Promise<SyntheticProposalRecord[]> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  let query = supabase
    .from("synthetic_proposals")
    .select("*")
    .eq("user_id", user.id);

  if (filters?.batchId) {
    query = query.eq("batch_id", filters.batchId);
  }

  if (filters?.rubricId) {
    query = query.eq("rubric_id", filters.rubricId);
  }

  const { data: proposals, error: proposalsError } = await query.order("created_at", {
    ascending: false,
  });

  if (proposalsError) {
    throw new Error(`Failed to fetch proposals: ${proposalsError.message}`);
  }

  return (proposals ?? []).map((p) => ({
    id: p.id,
    batchId: p.batch_id,
    characteristics: p.characteristics as Record<string, string>,
    content: p.content,
    systemPrompt: p.system_prompt,
    userPromptTemplate: p.user_prompt_template,
    rubricId: p.rubric_id,
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));
}

/**
 * Get a specific proposal by ID
 */
export async function getProposalById(
  id: string,
  accessToken: string
): Promise<SyntheticProposalRecord | null> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Fetch proposal
  const { data: proposal, error: proposalError } = await supabase
    .from("synthetic_proposals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (proposalError || !proposal) {
    return null;
  }

  return {
    id: proposal.id,
    batchId: proposal.batch_id,
    characteristics: proposal.characteristics as Record<string, string>,
    content: proposal.content,
    systemPrompt: proposal.system_prompt,
    userPromptTemplate: proposal.user_prompt_template,
    rubricId: proposal.rubric_id,
    createdAt: new Date(proposal.created_at),
    updatedAt: new Date(proposal.updated_at),
  };
}

/**
 * Delete a single proposal
 */
export async function deleteProposal(id: string, accessToken: string): Promise<void> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Delete proposal
  const { error } = await supabase
    .from("synthetic_proposals")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure user owns this proposal

  if (error) {
    throw new Error(`Failed to delete proposal: ${error.message}`);
  }
}
