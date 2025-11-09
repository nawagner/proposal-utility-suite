import { createServerClient } from "@/lib/supabase/server";

export interface RubricCriterionInput {
  label: string;
  weight: number;
}

export interface RubricCriterionRecord extends RubricCriterionInput {
  id: string;
  position: number;
}

export interface RubricInput {
  name: string;
  description: string;
  criteria: RubricCriterionInput[];
}

export interface RubricRecord {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  criteria: RubricCriterionRecord[];
}

function validateRubricInput(input: RubricInput) {
  const name = input.name?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  if (!name) {
    throw new Error("Rubric name is required");
  }
  if (!description) {
    throw new Error("Rubric description is required");
  }

  if (!Array.isArray(input.criteria) || input.criteria.length === 0) {
    throw new Error("Provide at least one rubric criterion");
  }

  let totalWeight = 0;
  for (const criterion of input.criteria) {
    if (!criterion || typeof criterion.label !== "string" || criterion.label.trim().length === 0) {
      throw new Error("Each criterion requires a non-empty label");
    }
    if (typeof criterion.weight !== "number" || Number.isNaN(criterion.weight)) {
      throw new Error("Each criterion requires a numeric weight");
    }
    totalWeight += criterion.weight;
  }

  if (totalWeight !== 100) {
    throw new Error("Criterion weights must sum to 100");
  }
}

/**
 * Get Supabase client with user authentication
 */
function getAuthenticatedClient(accessToken?: string) {
  return createServerClient(accessToken);
}

/**
 * Save a new rubric for the authenticated user
 */
export async function saveRubric(input: RubricInput, accessToken: string): Promise<RubricRecord> {
  validateRubricInput(input);

  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  const name = input.name.trim();
  const description = input.description.trim();

  // Insert rubric
  const { data: rubric, error: rubricError } = await supabase
    .from("rubrics")
    .insert({
      user_id: user.id,
      name,
      description,
    })
    .select()
    .single();

  if (rubricError || !rubric) {
    throw new Error(`Failed to save rubric: ${rubricError?.message ?? "Unknown error"}`);
  }

  // Insert criteria
  const criteriaToInsert = input.criteria.map((criterion, index) => ({
    rubric_id: rubric.id,
    label: criterion.label.trim(),
    weight: criterion.weight,
    position: index,
  }));

  const { data: criteria, error: criteriaError } = await supabase
    .from("rubric_criteria")
    .insert(criteriaToInsert)
    .select();

  if (criteriaError || !criteria) {
    // Rollback: delete the rubric if criteria insertion fails
    await supabase.from("rubrics").delete().eq("id", rubric.id);
    throw new Error(`Failed to save criteria: ${criteriaError?.message ?? "Unknown error"}`);
  }

  return {
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    createdAt: new Date(rubric.created_at),
    updatedAt: new Date(rubric.updated_at),
    criteria: criteria
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        label: c.label,
        weight: c.weight,
        position: c.position,
      })),
  };
}

/**
 * Update an existing rubric
 */
export async function updateRubric(
  id: string,
  input: RubricInput,
  accessToken: string
): Promise<RubricRecord> {
  validateRubricInput(input);

  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  const name = input.name.trim();
  const description = input.description.trim();

  // Update rubric
  const { data: rubric, error: rubricError } = await supabase
    .from("rubrics")
    .update({
      name,
      description,
    })
    .eq("id", id)
    .eq("user_id", user.id) // Ensure user owns this rubric
    .select()
    .single();

  if (rubricError || !rubric) {
    throw new Error(`Failed to update rubric: ${rubricError?.message ?? "Unknown error"}`);
  }

  // Delete existing criteria
  const { error: deleteError } = await supabase
    .from("rubric_criteria")
    .delete()
    .eq("rubric_id", id);

  if (deleteError) {
    throw new Error(`Failed to update criteria: ${deleteError.message}`);
  }

  // Insert new criteria
  const criteriaToInsert = input.criteria.map((criterion, index) => ({
    rubric_id: rubric.id,
    label: criterion.label.trim(),
    weight: criterion.weight,
    position: index,
  }));

  const { data: criteria, error: criteriaError } = await supabase
    .from("rubric_criteria")
    .insert(criteriaToInsert)
    .select();

  if (criteriaError || !criteria) {
    throw new Error(`Failed to save updated criteria: ${criteriaError?.message ?? "Unknown error"}`);
  }

  return {
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    createdAt: new Date(rubric.created_at),
    updatedAt: new Date(rubric.updated_at),
    criteria: criteria
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        label: c.label,
        weight: c.weight,
        position: c.position,
      })),
  };
}

/**
 * Delete a rubric (hard delete)
 */
export async function deleteRubric(id: string, accessToken: string): Promise<void> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Delete rubric (criteria will be cascade deleted)
  const { error } = await supabase
    .from("rubrics")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensure user owns this rubric

  if (error) {
    throw new Error(`Failed to delete rubric: ${error.message}`);
  }
}

/**
 * List all rubrics for the authenticated user
 */
export async function listRubrics(accessToken: string): Promise<RubricRecord[]> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Fetch rubrics
  const { data: rubrics, error: rubricsError } = await supabase
    .from("rubrics")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (rubricsError) {
    throw new Error(`Failed to fetch rubrics: ${rubricsError.message}`);
  }

  if (!rubrics || rubrics.length === 0) {
    return [];
  }

  // Fetch all criteria for these rubrics
  const rubricIds = rubrics.map((r) => r.id);
  const { data: criteria, error: criteriaError } = await supabase
    .from("rubric_criteria")
    .select("*")
    .in("rubric_id", rubricIds)
    .order("position", { ascending: true });

  if (criteriaError) {
    throw new Error(`Failed to fetch criteria: ${criteriaError.message}`);
  }

  // Group criteria by rubric_id
  const criteriaByRubric = new Map<string, RubricCriterionRecord[]>();
  for (const criterion of criteria ?? []) {
    if (!criteriaByRubric.has(criterion.rubric_id)) {
      criteriaByRubric.set(criterion.rubric_id, []);
    }
    criteriaByRubric.get(criterion.rubric_id)!.push({
      id: criterion.id,
      label: criterion.label,
      weight: criterion.weight,
      position: criterion.position,
    });
  }

  return rubrics.map((rubric) => ({
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    createdAt: new Date(rubric.created_at),
    updatedAt: new Date(rubric.updated_at),
    criteria: criteriaByRubric.get(rubric.id) ?? [],
  }));
}

/**
 * Get a specific rubric by ID for the authenticated user
 */
export async function getRubricById(id: string, accessToken: string): Promise<RubricRecord | null> {
  const supabase = getAuthenticatedClient(accessToken);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Authentication required");
  }

  // Fetch rubric
  const { data: rubric, error: rubricError } = await supabase
    .from("rubrics")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (rubricError || !rubric) {
    return null;
  }

  // Fetch criteria
  const { data: criteria, error: criteriaError } = await supabase
    .from("rubric_criteria")
    .select("*")
    .eq("rubric_id", id)
    .order("position", { ascending: true });

  if (criteriaError) {
    throw new Error(`Failed to fetch criteria: ${criteriaError.message}`);
  }

  return {
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    createdAt: new Date(rubric.created_at),
    updatedAt: new Date(rubric.updated_at),
    criteria: (criteria ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      weight: c.weight,
      position: c.position,
    })),
  };
}
