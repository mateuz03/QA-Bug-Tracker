export type Role = 'ADMIN' | 'ANALYST';
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type BugStatus = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'CLOSED';
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
  environments: Environment[];
  requirements?: Requirement[];
  scenarios?: TestScenario[];
  executions?: TestExecution[];
  _count: { requirements: number; scenarios: number; executions: number; bugs: number };
  passRate?: number | null;
  createdAt: string;
  updatedAt: string;
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
