export type Role = 'ADMIN' | 'ANALYST';
export type ProjectRole = 'OWNER' | 'MANAGER' | 'VIEWER';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
export type ExternalIssueProvider = 'GITHUB' | 'JIRA';
export type ProjectStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type RequirementStatus = 'DRAFT' | 'READY' | 'COVERED' | 'BLOCKED';
export type ScenarioType = 'FUNCTIONAL' | 'REGRESSION' | 'SMOKE' | 'INTEGRATION';
export type ScenarioStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type StepAction = 'NAVIGATE' | 'FILL' | 'CLICK' | 'SELECT' | 'CHECK' | 'UPLOAD' | 'ASSERT_TEXT' | 'ASSERT_VISIBLE' | 'ASSERT_URL';
export type ExecutionStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
export type ScreenshotMode = 'NONE' | 'FAILURE' | 'ALL';

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type Bug = {
  id: number;
  code: string;
  title: string;
  description: string;
  reproduction?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  severity: Severity;
  priority: Priority;
  environment?: string | null;
  browser?: string | null;
  status: BugStatus;
  evidenceUrl?: string | null;
  technicalError?: string | null;
  assigneeId?: number | null;
  projectId?: number | null;
  scenarioId?: number | null;
  executionId?: number | null;
  assignee?: Pick<User, 'id' | 'name' | 'email'> | null;
  reporter: Pick<User, 'id' | 'name' | 'email'>;
  project?: Pick<Project, 'id' | 'code' | 'name'> | null;
  scenario?: Pick<TestScenario, 'id' | 'code' | 'title'> | null;
  execution?: Pick<TestExecution, 'id' | 'code' | 'status'> | null;
  externalIssues?: BugExternalIssue[];
  createdAt: string;
  updatedAt: string;
};

export type BugExternalIssue = {
  id: number;
  provider: ExternalIssueProvider;
  externalKey: string;
  url: string;
  state: string;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
  bugId: number;
  createdAt: string;
  updatedAt: string;
};

export type BugPayload = {
  title: string;
  description: string;
  reproduction?: string | null;
  expectedResult?: string | null;
  actualResult?: string | null;
  severity: Severity;
  priority: Priority;
  environment?: string | null;
  browser?: string | null;
  status?: BugStatus;
  evidenceUrl?: string | null;
  technicalError?: string | null;
  assigneeId?: number | null;
  projectId?: number | null;
  scenarioId?: number | null;
  executionId?: number | null;
};

export type PaginatedBugs = {
  items: Bug[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type DashboardData = {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    critical: number;
    resolved: number;
    projects: number;
    scenarios: number;
    automated: number;
    automationRate: number;
    executions: number;
    passRate: number;
  };
  byStatus: { label: BugStatus; value: number }[];
  bySeverity: { label: Severity; value: number }[];
};

export type Environment = {
  id: number;
  name: string;
  baseUrl: string;
  isDefault: boolean;
  projectId: number;
};

export type Requirement = {
  id: number;
  code: string;
  title: string;
  description: string;
  status: RequirementStatus;
  projectId: number;
  _count?: { scenarios: number };
};

export type Project = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  repositoryUrl?: string | null;
  status: ProjectStatus;
  ownerId: number;
  owner: Pick<User, 'id' | 'name' | 'email'>;
  currentUserRole?: ProjectRole;
  members?: ProjectMember[];
  environments: Environment[];
  requirements?: Requirement[];
  scenarios?: TestScenario[];
  executions?: TestExecution[];
  _count: { requirements: number; scenarios: number; executions: number; bugs: number };
  passRate?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  projectId: number;
  userId: number;
  role: ProjectRole;
  user: User;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: number;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  projectId: number;
  actorId: number;
  actor: Pick<User, 'id' | 'name' | 'email'>;
  createdAt: string;
};

export type ProjectApiKey = {
  id: number;
  name: string;
  prefix: string;
  token?: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  createdBy: Pick<User, 'id' | 'name' | 'email'>;
};

export type GitHubIntegration = {
  id: number;
  repositoryOwner: string;
  repositoryName: string;
  enabled: boolean;
  lastPublishedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<User, 'id' | 'name' | 'email'>;
};

export type JiraIntegration = {
  id: number;
  siteUrl: string;
  email: string;
  jiraProjectKey: string;
  issueType: string;
  enabled: boolean;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<User, 'id' | 'name' | 'email'>;
};

export type ProjectWebhook = {
  id: number;
  enabled: boolean;
  lastDeliveredAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<User, 'id' | 'name' | 'email'>;
  secret?: string;
};

export type ScenarioStep = {
  id?: number;
  order?: number;
  action: StepAction;
  description: string;
  target?: string | null;
  value?: string | null;
  expected?: string | null;
  timeoutMs?: number | null;
};

export type TestScenario = {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  preconditions?: string | null;
  priority: Priority;
  type: ScenarioType;
  status: ScenarioStatus;
  automated: boolean;
  timeoutMs: number;
  screenshotMode: ScreenshotMode;
  captureVideo: boolean;
  captureTrace: boolean;
  captureConsole: boolean;
  captureNetwork: boolean;
  retentionDays: number;
  projectId: number;
  requirementId?: number | null;
  project: Pick<Project, 'id' | 'code' | 'name'> & { environments?: Environment[] };
  requirement?: Pick<Requirement, 'id' | 'code' | 'title'> | null;
  steps?: ScenarioStep[];
  executions?: TestExecution[];
  bugs?: Bug[];
  _count?: { steps: number; executions: number; bugs: number };
  createdAt: string;
  updatedAt: string;
};

export type ScenarioPayload = {
  title: string;
  description?: string | null;
  preconditions?: string | null;
  priority: Priority;
  type: ScenarioType;
  status: ScenarioStatus;
  automated: boolean;
  timeoutMs: number;
  screenshotMode: ScreenshotMode;
  captureVideo: boolean;
  captureTrace: boolean;
  captureConsole: boolean;
  captureNetwork: boolean;
  retentionDays: number;
  projectId: number;
  requirementId?: number | null;
  steps: ScenarioStep[];
};

export type ExecutionStep = {
  id: number;
  order: number;
  description: string;
  action: StepAction;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  durationMs?: number | null;
  error?: string | null;
  expected?: string | null;
  actual?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type ExecutionEvidence = {
  id: number;
  type: 'SCREENSHOT' | 'VIDEO' | 'TRACE' | 'CONSOLE' | 'NETWORK' | 'MANUAL';
  name: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  description?: string | null;
  stepOrder?: number | null;
  uploadedBy?: Pick<User, 'id' | 'name'> | null;
  createdAt: string;
};

export type ExecutionLog = {
  id: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  stepOrder?: number | null;
  createdAt: string;
};

export type TestExecution = {
  id: number;
  code: string;
  status: ExecutionStatus;
  browser: string;
  durationMs?: number | null;
  timeoutMs: number;
  screenshotMode: ScreenshotMode;
  captureVideo: boolean;
  captureTrace: boolean;
  captureConsole: boolean;
  captureNetwork: boolean;
  retentionUntil?: string | null;
  progress: number;
  currentStep?: number | null;
  errorMessage?: string | null;
  screenshotPath?: string | null;
  scenarioId: number;
  environmentId: number;
  projectId: number;
  scenario: Pick<TestScenario, 'id' | 'code' | 'title'> & { requirement?: Requirement | null };
  project: Pick<Project, 'id' | 'code' | 'name'>;
  environment: Environment;
  createdBy?: Pick<User, 'id' | 'name' | 'email'>;
  cycle?: {
    id: number;
    code: string;
    name: string;
    status: TestCycleStatus;
    plan?: { id: number; code: string; name: string; releaseVersion?: string | null };
  } | null;
  steps?: ExecutionStep[];
  logs?: ExecutionLog[];
  evidences?: ExecutionEvidence[];
  bugs?: Bug[];
  retryOf?: Pick<TestExecution, 'id' | 'code' | 'status'> | null;
  retries?: Pick<TestExecution, 'id' | 'code' | 'status'>[];
  _count?: { bugs: number };
  cancelRequestedAt?: string | null;
  heartbeatAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  cycleId?: number | null;
};

export type TestPlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type TestCycleStatus = 'PLANNED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
export type CycleScenarioResult = 'NOT_RUN' | 'PASSED' | 'FAILED' | 'BLOCKED';

export type TestSuite = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  projectId: number;
  project?: Pick<Project, 'id' | 'code' | 'name'>;
  scenarios: {
    order: number;
    scenario: Pick<TestScenario, 'id' | 'code' | 'title' | 'automated' | 'status'>;
  }[];
  _count?: { plans: number };
  createdAt: string;
  updatedAt: string;
};

export type TestCycleSummary = {
  total: number;
  executed: number;
  passed: number;
  failed: number;
  blocked: number;
  running: number;
  queued: number;
  notRun: number;
  progress: number;
};

export type TestCycleScenario = {
  scenarioId: number;
  order?: number;
  result: CycleScenarioResult;
  notes?: string | null;
  executedAt?: string | null;
  executedBy?: Pick<User, 'id' | 'name'> | null;
  scenario?: TestScenario;
};

export type TestCycle = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status: TestCycleStatus;
  browser: 'chromium' | 'firefox' | 'webkit';
  plannedStart?: string | null;
  plannedEnd?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  planId: number;
  plan?: Pick<TestPlan, 'id' | 'code' | 'name' | 'releaseVersion' | 'status'> & {
    project?: Pick<Project, 'id' | 'code' | 'name'>;
  };
  environmentId: number;
  environment: Environment;
  createdBy?: Pick<User, 'id' | 'name'>;
  scenarios: TestCycleScenario[];
  executions: (Pick<TestExecution, 'id' | 'code' | 'scenarioId' | 'status' | 'createdAt'> & {
    scenario?: Pick<TestScenario, 'id' | 'code' | 'title'>;
  })[];
  summary: TestCycleSummary;
  createdAt: string;
  updatedAt: string;
};

export type TestPlan = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  releaseVersion?: string | null;
  status: TestPlanStatus;
  projectId: number;
  project: Pick<Project, 'id' | 'code' | 'name'> & { environments: Environment[] };
  createdBy: Pick<User, 'id' | 'name'>;
  suites: { order: number; suite: TestSuite }[];
  cycles: TestCycle[];
  createdAt: string;
  updatedAt: string;
};

export type TestSuitePayload = {
  projectId: number;
  name: string;
  description?: string | null;
  scenarioIds: number[];
};

export type TestPlanPayload = {
  projectId: number;
  name: string;
  description?: string | null;
  objective?: string | null;
  releaseVersion?: string | null;
  status?: TestPlanStatus;
  suiteIds: number[];
};

export type TestCyclePayload = {
  name: string;
  description?: string | null;
  environmentId: number;
  browser: 'chromium' | 'firefox' | 'webkit';
  plannedStart?: string | null;
  plannedEnd?: string | null;
  scheduledAt?: string | null;
  suiteIds?: number[];
};

export type CycleComparisonClassification = 'REGRESSION' | 'IMPROVEMENT' | 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'CHANGED';

export type TestCycleComparison = {
  plan: Pick<TestPlan, 'id' | 'code' | 'name' | 'releaseVersion'> & {
    project: Pick<Project, 'id' | 'code' | 'name'>;
  };
  baseline: Pick<TestCycle, 'id' | 'code' | 'name' | 'status' | 'createdAt' | 'finishedAt'> & { passRate: number };
  target: Pick<TestCycle, 'id' | 'code' | 'name' | 'status' | 'createdAt' | 'finishedAt'> & { passRate: number };
  summary: {
    total: number;
    regressions: number;
    improvements: number;
    changed: number;
    unchanged: number;
    added: number;
    removed: number;
    passRateDelta: number;
  };
  items: {
    scenarioId: number;
    scenario: Pick<TestScenario, 'id' | 'code' | 'title' | 'automated'>;
    baselineResult: CycleScenarioResult | ExecutionStatus | null;
    targetResult: CycleScenarioResult | ExecutionStatus | null;
    classification: CycleComparisonClassification;
  }[];
};

export type RecordingSession = {
  id: number;
  code: string;
  title: string;
  status: 'RECORDING' | 'REVIEW' | 'SAVED' | 'CANCELLED';
  projectId: number;
  scenarioId?: number | null;
  project: Pick<Project, 'id' | 'code' | 'name'>;
  scenario?: Pick<TestScenario, 'id' | 'code' | 'title'> | null;
  createdBy: Pick<User, 'id' | 'name'>;
  _count: { events: number };
  startedAt: string;
  finishedAt?: string | null;
};
