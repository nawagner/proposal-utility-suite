export const RUBRIC_STORAGE_KEY = "proposal-suite-rubric-v1";
export const RUBRIC_SELECTION_KEY = "proposal-suite-rubric-selection-v1";
export const REVIEW_STATE_STORAGE_KEY = "proposal-suite-review-v1";

export interface StoredRubric {
  source: "upload" | "manual";
  text: string;
  filename?: string;
  mimetype?: string;
  wordCount: number;
  characterCount: number;
  preview: string;
  savedAt: string;
}

export interface StoredRubricSelection {
  rubricId: string;
  savedAt: string;
}

export interface StoredReviewState {
  submissionContext: string;
  reviews: ProposalReviewResult[];
  lastRunAt: string;
  files: {
    name: string;
    size: number;
  }[];
}

export interface ProposalReviewCriterion {
  name: string;
  result: "pass" | "fail";
  explanation: string;
}

export interface ProposalReviewResult {
  id: string;
  filename: string;
  wordCount: number;
  overallVerdict: "pass" | "fail";
  overallFeedback: string;
  criteria: ProposalReviewCriterion[];
  notableStrengths: string[];
  recommendedImprovements: string[];
}
