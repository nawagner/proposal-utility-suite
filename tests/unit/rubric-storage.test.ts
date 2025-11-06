import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  initializeRubricStore,
  saveRubric,
  listRubrics,
  getRubricById,
  type RubricInput,
} from "@/lib/rubric-store";

function createTempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), "rubric-store-"));
  const file = join(dir, "rubrics.duckdb");
  return { dir, file };
}

describe("rubric-store", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    const paths = createTempDbPath();
    tempDir = paths.dir;
    dbPath = paths.file;
    process.env.DUCKDB_PATH = dbPath;
    await initializeRubricStore();
  });

  afterEach(() => {
    delete process.env.DUCKDB_PATH;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("persists and retrieves rubric metadata with criteria", async () => {
    const input: RubricInput = {
      name: "STEM Grant Scoring",
      description: "Binary criteria for evaluating STEM proposals.",
      criteria: [
        { label: "Clear problem statement", weight: 35 },
        { label: "Evidence-backed solution", weight: 45 },
        { label: "Budget justification", weight: 20 },
      ],
    };

    const created = await saveRubric(input);
    assert.ok(created.id, "Expected rubric id to be generated");
    assert.equal(created.name, input.name);
    assert.equal(created.criteria.length, 3);

    const loaded = await getRubricById(created.id);
    assert.ok(loaded, "Expected to load saved rubric");
    assert.equal(loaded?.name, input.name);
    assert.equal(loaded?.criteria.length, 3);
    assert.deepEqual(
      loaded?.criteria.map((criterion) => [criterion.label, criterion.weight]),
      input.criteria.map((criterion) => [criterion.label, criterion.weight]),
    );
  });

  it("lists rubrics ordered by newest first", async () => {
    const firstInput: RubricInput = {
      name: "First Rubric",
      description: "First description",
      criteria: [
        { label: "Criterion A", weight: 60 },
        { label: "Criterion B", weight: 40 },
      ],
    };

    const secondInput: RubricInput = {
      name: "Second Rubric",
      description: "Second description",
      criteria: [
        { label: "Criterion C", weight: 55 },
        { label: "Criterion D", weight: 45 },
      ],
    };

    await saveRubric(firstInput);
    const createdSecond = await saveRubric(secondInput);

    const rubrics = await listRubrics();
    assert.equal(rubrics.length, 2);
    assert.equal(rubrics[0].id, createdSecond.id, "Latest rubric should appear first");
  });

  it("rejects rubrics whose criteria weights do not sum to 100", async () => {
    const invalidInput: RubricInput = {
      name: "Invalid Weights",
      description: "Weights should sum to 100",
      criteria: [
        { label: "Criterion A", weight: 40 },
        { label: "Criterion B", weight: 40 },
      ],
    };

    await assert.rejects(
      () => saveRubric(invalidInput),
      /sum to 100/,
    );
  });

  it("stores criteria with generated ids for downstream evaluation", async () => {
    const input: RubricInput = {
      name: "ID check",
      description: "Ensure criteria get ids",
      criteria: [
        { label: "Criterion A", weight: 70 },
        { label: "Criterion B", weight: 30 },
      ],
    };

    const created = await saveRubric(input);

    for (const criterion of created.criteria) {
      assert.match(criterion.id, /^[0-9a-fA-F-]{36}$/, "criterion id should be a UUID");
    }
  });
});
