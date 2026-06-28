import { z } from "zod";

export const REVIEW_LABEL = "ready for human review";

export const workflowModeSchema = z.enum(["dry-run", "write"]);
export type WorkflowMode = z.infer<typeof workflowModeSchema>;

export const codexModeSchema = z.enum(["auto", "off", "required"]);
export type CodexMode = z.infer<typeof codexModeSchema>;

export const checkBucketSchema = z.enum(["pass", "fail", "pending", "skipping", "cancel"]);
export type CheckBucket = z.infer<typeof checkBucketSchema>;

export const checkConclusionSchema = z.enum(["pass", "fail", "pending", "unknown"]);
export type CheckConclusion = z.infer<typeof checkConclusionSchema>;

export const reviewSeveritySchema = z.enum(["blocker", "warning", "info"]);
export type ReviewSeverity = z.infer<typeof reviewSeveritySchema>;

export const workflowActionSchema = z.enum([
  "dry-run",
  "label-original",
  "supersede-original",
  "needs-human",
  "wait-for-checks",
]);
export type WorkflowAction = z.infer<typeof workflowActionSchema>;

export const workflowOptionsSchema = z.object({
  codexMode: codexModeSchema.default("auto"),
  mode: workflowModeSchema.default("dry-run"),
  postReviewComment: z.boolean().default(false),
  prNumber: z.number().int().positive().optional(),
  readyForHumanReviewLabel: z.string().min(1).default(REVIEW_LABEL),
  repository: z.string().min(1).optional(),
  repoRoot: z.string().min(1),
  runLocalValidation: z.boolean().default(true),
  supersede: z.boolean().default(false),
});
export type WorkflowOptions = z.infer<typeof workflowOptionsSchema>;

export const checkRunSchema = z.object({
  bucket: checkBucketSchema.optional(),
  completedAt: z.string().optional(),
  description: z.string().optional(),
  link: z.string().optional(),
  name: z.string(),
  startedAt: z.string().optional(),
  state: z.string().optional(),
  workflow: z.string().optional(),
});
export type CheckRun = z.infer<typeof checkRunSchema>;

export const checkStatusSchema = z.object({
  conclusion: checkConclusionSchema,
  failing: z.array(checkRunSchema),
  passing: z.array(checkRunSchema),
  pending: z.array(checkRunSchema),
  skipping: z.array(checkRunSchema),
  summary: z.string(),
});
export type CheckStatus = z.infer<typeof checkStatusSchema>;

export const renovatePullRequestSchema = z.object({
  authorLogin: z.string(),
  baseRefName: z.string(),
  createdAt: z.string().optional(),
  headRefName: z.string(),
  isDraft: z.boolean(),
  labels: z.array(z.string()),
  number: z.number().int().positive(),
  status: checkStatusSchema,
  title: z.string(),
  updatedAt: z.string().optional(),
  url: z.string(),
});
export type RenovatePullRequest = z.infer<typeof renovatePullRequestSchema>;

export const dependencyUpdateSchema = z.object({
  file: z.string(),
  from: z.string().optional(),
  name: z.string(),
  to: z.string().optional(),
});
export type DependencyUpdate = z.infer<typeof dependencyUpdateSchema>;

export const dependencyMetadataSchema = z.object({
  changelogUrl: z.string().optional(),
  homepage: z.string().optional(),
  name: z.string(),
  registryVersion: z.string().optional(),
  repositoryUrl: z.string().optional(),
});
export type DependencyMetadata = z.infer<typeof dependencyMetadataSchema>;

export const usageMatchSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  text: z.string(),
});
export type UsageMatch = z.infer<typeof usageMatchSchema>;

export const failedCheckLogSchema = z.object({
  checkName: z.string(),
  log: z.string(),
  runId: z.string().optional(),
});
export type FailedCheckLog = z.infer<typeof failedCheckLogSchema>;

export const pullRequestContextSchema = z.object({
  affectedAreas: z.array(z.string()),
  body: z.string(),
  dependencyMetadata: z.array(dependencyMetadataSchema),
  dependencyUpdates: z.array(dependencyUpdateSchema),
  diff: z.string(),
  failedCheckLogs: z.array(failedCheckLogSchema),
  files: z.array(z.string()),
  pr: renovatePullRequestSchema,
  usageMatches: z.array(usageMatchSchema),
});
export type PullRequestContext = z.infer<typeof pullRequestContextSchema>;

export const reviewFindingSchema = z.object({
  details: z.string(),
  file: z.string().optional(),
  severity: reviewSeveritySchema,
  title: z.string(),
});
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;

export const reviewResultSchema = z.object({
  affectedAreas: z.array(z.string()),
  automatedTestSuggestions: z.array(z.string()),
  changelogNotes: z.array(z.string()),
  findings: z.array(reviewFindingSchema),
  manualTestPlan: z.array(z.string()),
  summary: z.string(),
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export const codexReviewResultSchema = reviewResultSchema.extend({
  error: z.string().optional(),
  rawOutput: z.string().optional(),
  ran: z.boolean(),
});
export type CodexReviewResult = z.infer<typeof codexReviewResultSchema>;

export const reviewBundleSchema = z.object({
  codex: codexReviewResultSchema,
  context: pullRequestContextSchema,
  deterministic: reviewResultSchema,
});
export type ReviewBundle = z.infer<typeof reviewBundleSchema>;

export const reviewDecisionSchema = z.object({
  action: workflowActionSchema,
  blockingFindings: z.array(reviewFindingSchema),
  foundIssues: z.boolean(),
  review: reviewBundleSchema,
  summary: z.string(),
});
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export const supersedingPullRequestSchema = z.object({
  agentCommits: z.array(z.string()).optional(),
  agentLogPath: z.string().optional(),
  branchName: z.string().optional(),
  localValidationPassed: z.boolean().optional(),
  localValidationOutput: z.string().optional(),
  prUrl: z.string().optional(),
  summary: z.string(),
  updatedOriginalPr: z.boolean().optional(),
});
export type SupersedingPullRequest = z.infer<typeof supersedingPullRequestSchema>;

export const workflowResultSchema = z.object({
  decision: reviewDecisionSchema,
  dryRun: z.boolean(),
  labelAppliedTo: z.number().int().positive().optional(),
  originalPr: renovatePullRequestSchema,
  report: z.string(),
  supersedingPullRequest: supersedingPullRequestSchema.optional(),
});
export type WorkflowResult = z.infer<typeof workflowResultSchema>;

export const listedPullRequestsStateSchema = z.object({
  candidates: z.array(renovatePullRequestSchema),
  options: workflowOptionsSchema,
});
export type ListedPullRequestsState = z.infer<typeof listedPullRequestsStateSchema>;

export const selectedPullRequestStateSchema = z.object({
  options: workflowOptionsSchema,
  pr: renovatePullRequestSchema,
});
export type SelectedPullRequestState = z.infer<typeof selectedPullRequestStateSchema>;

export const contextStateSchema = z.object({
  context: pullRequestContextSchema,
  options: workflowOptionsSchema,
});
export type ContextState = z.infer<typeof contextStateSchema>;
