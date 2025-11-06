import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import duckdb from "duckdb";

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

type DuckConnection = duckdb.Connection;

let connectionPromise: Promise<DuckConnection> | null = null;
let currentDbPath: string | null = null;
let currentDatabase: duckdb.Database | null = null;
let schemaInitializedForPath: string | null = null;

function getDatabasePath(): string {
  const envPath = process.env.DUCKDB_PATH;
  if (envPath && envPath.trim().length > 0) {
    return envPath;
  }
  return join(process.cwd(), "storage", "rubrics.duckdb");
}

async function getConnection(): Promise<DuckConnection> {
  const targetPath = getDatabasePath();

  if (connectionPromise && currentDbPath !== targetPath) {
    const existing = await connectionPromise;
    existing.close();
    connectionPromise = null;
    currentDbPath = null;
    if (currentDatabase) {
      currentDatabase.close();
      currentDatabase = null;
    }
  }

  if (!connectionPromise) {
    mkdirSync(dirname(targetPath), { recursive: true });
    currentDatabase = new duckdb.Database(targetPath);
    const connection = currentDatabase.connect();
    connectionPromise = Promise.resolve(connection);
    currentDbPath = targetPath;
  }

  return connectionPromise;
}

async function runQuery(connection: DuckConnection, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    const callback = (error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const args = params.length > 0 ? [sql, ...params, callback] : [sql, callback];
    (connection.run as (...args: unknown[]) => void)(...args);
  });
}

async function allQuery<T = unknown>(connection: DuckConnection, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const callback = (error: Error | null, rows?: unknown[]) => {
      if (error) {
        reject(error);
        return;
      }
      resolve((rows ?? []) as T[]);
    };

    const args = params.length > 0 ? [sql, ...params, callback] : [sql, callback];
    (connection.all as (...args: unknown[]) => void)(...args);
  });
}

export async function initializeRubricStore(): Promise<void> {
  const connection = await getConnection();
  const dbPath = currentDbPath;

  if (schemaInitializedForPath === dbPath) {
    return;
  }

  await runQuery(
    connection,
    `
    CREATE TABLE IF NOT EXISTS rubrics (
      id VARCHAR PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    );
  `.trim(),
  );

  await runQuery(
    connection,
    `
    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id VARCHAR PRIMARY KEY,
      rubric_id VARCHAR NOT NULL REFERENCES rubrics(id),
      label TEXT NOT NULL,
      weight INTEGER NOT NULL,
      position INTEGER NOT NULL
    );
  `.trim(),
  );

  await runQuery(
    connection,
    `
    CREATE INDEX IF NOT EXISTS idx_rubric_criteria_rubric_id
    ON rubric_criteria (rubric_id);
  `.trim(),
  );

  schemaInitializedForPath = dbPath ?? null;
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

export async function saveRubric(input: RubricInput): Promise<RubricRecord> {
  await initializeRubricStore();
  validateRubricInput(input);

  const connection = await getConnection();

  const rubricId = randomUUID();
  const createdAt = new Date();
  const name = input.name.trim();
  const description = input.description.trim();

  await runQuery(connection, "BEGIN TRANSACTION;");

  try {
    await runQuery(
      connection,
      `
        INSERT INTO rubrics (id, name, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?);
      `.trim(),
      [
        rubricId,
        name,
        description,
        createdAt.toISOString(),
        createdAt.toISOString(),
      ],
    );

    for (const [index, criterion] of input.criteria.entries()) {
      const criterionId = randomUUID();
      await runQuery(
        connection,
        `
          INSERT INTO rubric_criteria (id, rubric_id, label, weight, position)
          VALUES (?, ?, ?, ?, ?);
        `.trim(),
        [
          criterionId,
          rubricId,
          criterion.label.trim(),
          criterion.weight,
          index,
        ],
      );
    }

    await runQuery(connection, "COMMIT;");
  } catch (error) {
    await runQuery(connection, "ROLLBACK;");
    throw error;
  }

  const saved = await getRubricById(rubricId);
  if (!saved) {
    throw new Error("Unable to load rubric after save");
  }
  return saved;
}

export async function listRubrics(): Promise<RubricRecord[]> {
  await initializeRubricStore();
  const connection = await getConnection();
  const rubrics = await allQuery<{
    id: string;
    name: string;
    description: string;
    created_at: string | Date;
    updated_at: string | Date;
  }>(
    connection,
    `
      SELECT id, name, description, created_at, updated_at
      FROM rubrics
      ORDER BY created_at DESC;
    `.trim(),
  );

  if (rubrics.length === 0) {
    return [];
  }

  const rubricIds = rubrics.map((rubric) => rubric.id);
  const placeholders = rubricIds.map(() => "?").join(", ");
  const criteriaRows = await allQuery<{
    id: string;
    rubric_id: string;
    label: string;
    weight: number;
    position: number;
  }>(
    connection,
    `
      SELECT id, rubric_id, label, weight, position
      FROM rubric_criteria
      WHERE rubric_id IN (${placeholders})
      ORDER BY position ASC;
    `.trim(),
    rubricIds,
  );

  const grouped = new Map<string, RubricCriterionRecord[]>();
  for (const row of criteriaRows) {
    if (!grouped.has(row.rubric_id)) {
      grouped.set(row.rubric_id, []);
    }
    grouped.get(row.rubric_id)!.push({
      id: row.id,
      label: row.label,
      weight: row.weight,
      position: row.position,
    });
  }

  return rubrics.map((rubric) => ({
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    createdAt: new Date(rubric.created_at),
    updatedAt: new Date(rubric.updated_at),
    criteria: grouped.get(rubric.id) ?? [],
  }));
}

export async function getRubricById(id: string): Promise<RubricRecord | null> {
  await initializeRubricStore();
  const connection = await getConnection();
  const rubrics = await allQuery<{
    id: string;
    name: string;
    description: string;
    created_at: string | Date;
    updated_at: string | Date;
  }>(
    connection,
    `
      SELECT id, name, description, created_at, updated_at
      FROM rubrics
      WHERE id = ?
      LIMIT 1;
    `.trim(),
    [id],
  );

  if (rubrics.length === 0) {
    return null;
  }

  const rubric = rubrics[0];
  const criteriaRows = await allQuery<{
      id: string;
      rubric_id: string;
      label: string;
      weight: number;
      position: number;
    }>(
    connection,
    `
      SELECT id, rubric_id, label, weight, position
      FROM rubric_criteria
      WHERE rubric_id = ?
      ORDER BY position ASC;
    `.trim(),
    [id],
  );

  return {
    id: rubric.id,
    name: rubric.name,
    description: rubric.description,
    createdAt: new Date(rubric.created_at),
    updatedAt: new Date(rubric.updated_at),
    criteria: criteriaRows.map((row) => ({
      id: row.id,
      label: row.label,
      weight: row.weight,
      position: row.position,
    })),
  };
}
