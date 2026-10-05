import type {
  Bug,
  BugExternalIssue,
  AuditLog,
  BugPayload,
  DashboardData,
  ExecutionEvidence,
  PaginatedBugs,
  Project,
  ProjectMember,
  ProjectRole,
  ProjectApiKey,
  GitHubIntegration,
  JiraIntegration,
  RecordingSession,
  Requirement,
  ScenarioPayload,
  TestExecution,
  TestCycle,
  TestCyclePayload,
  CycleScenarioResult,
  TestCycleStatus,
  TestCycleComparison,
  TestPlan,
  TestPlanPayload,
  TestPlanStatus,
  TestSuite,
  TestSuitePayload,
  TestScenario,
  User
} from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('qa-token');
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.message ?? 'Não foi possível concluir a operação.', response.status, body.details);
  }
  return body as T;
}

async function requestBlob(path: string) {
  const token = localStorage.getItem('qa-token');
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? 'Não foi possível gerar o relatório.', response.status, body.details);
  }
  return response.blob();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  users: () => request<User[]>('/users'),
  dashboard: () => request<DashboardData>('/dashboard'),
  bugs: (query = '') => request<PaginatedBugs>(`/bugs${query ? `?${query}` : ''}`),
  bug: (id: number) => request<Bug>(`/bugs/${id}`),
  createBug: (payload: BugPayload) =>
    request<Bug>('/bugs', { method: 'POST', body: JSON.stringify(payload) }),
  updateBug: (id: number, payload: BugPayload) =>
    request<Bug>(`/bugs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateStatus: (id: number, status: Bug['status']) =>
    request<Bug>(`/bugs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),
  deleteBug: (id: number) => request<void>(`/bugs/${id}`, { method: 'DELETE' }),
  syncBugToGitHub: (id: number) =>
    request<BugExternalIssue>(`/bugs/${id}/github-sync`, { method: 'POST' }),
  syncBugToJira: (id: number) =>
    request<BugExternalIssue>(`/bugs/${id}/jira-sync`, { method: 'POST' }),
  projects: () => request<Project[]>('/projects'),
  project: (id: number) => request<Project>(`/projects/${id}`),
  projectMembers: (id: number) => request<ProjectMember[]>(`/projects/${id}/members`),
  updateProjectMember: (projectId: number, userId: number, role: Exclude<ProjectRole, 'OWNER'>) =>
    request<ProjectMember>(`/projects/${projectId}/members/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    }),
  removeProjectMember: (projectId: number, userId: number) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
  projectAudit: (id: number) => request<AuditLog[]>(`/projects/${id}/audit`),
  projectApiKeys: (id: number) => request<ProjectApiKey[]>(`/projects/${id}/api-keys`),
  createProjectApiKey: (projectId: number, payload: { name: string; expiresAt?: string | null }) =>
    request<ProjectApiKey & { token: string }>(`/projects/${projectId}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  revokeProjectApiKey: (projectId: number, keyId: number) =>
    request<void>(`/projects/${projectId}/api-keys/${keyId}`, { method: 'DELETE' }),
  githubIntegration: (projectId: number) =>
    request<GitHubIntegration | null>(`/projects/${projectId}/github-integration`),
  updateGitHubIntegration: (projectId: number, payload: { repository: string; token?: string; enabled: boolean }) =>
    request<GitHubIntegration>(`/projects/${projectId}/github-integration`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  removeGitHubIntegration: (projectId: number) =>
    request<void>(`/projects/${projectId}/github-integration`, { method: 'DELETE' }),
  jiraIntegration: (projectId: number) =>
    request<JiraIntegration | null>(`/projects/${projectId}/jira-integration`),
  updateJiraIntegration: (projectId: number, payload: { siteUrl: string; email: string; projectKey: string; issueType: string; token?: string; enabled: boolean }) =>
    request<JiraIntegration>(`/projects/${projectId}/jira-integration`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  removeJiraIntegration: (projectId: number) =>
    request<void>(`/projects/${projectId}/jira-integration`, { method: 'DELETE' }),
  createProject: (payload: {
    name: string;
    description?: string;
    repositoryUrl?: string;
    environments: { name: string; baseUrl: string; isDefault?: boolean }[];
  }) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(payload) }),
  createRequirement: (projectId: number, payload: { title: string; description: string; status?: string }) =>
    request<Requirement>(`/projects/${projectId}/requirements`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  scenarios: (query = '') => request<TestScenario[]>(`/scenarios${query ? `?${query}` : ''}`),
  scenario: (id: number) => request<TestScenario>(`/scenarios/${id}`),
  createScenario: (payload: ScenarioPayload) =>
    request<TestScenario>('/scenarios', { method: 'POST', body: JSON.stringify(payload) }),
  updateScenario: (id: number, payload: ScenarioPayload) =>
    request<TestScenario>(`/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  duplicateScenario: (id: number) =>
    request<TestScenario>(`/scenarios/${id}/duplicate`, { method: 'POST' }),
  executions: (projectId?: number) =>
    request<TestExecution[]>(`/executions${projectId ? `?projectId=${projectId}` : ''}`),
  execution: (id: number) => request<TestExecution>(`/executions/${id}`),
  runScenario: (scenarioId: number, environmentId: number, browser = 'chromium') =>
    request<TestExecution>('/executions', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, environmentId, browser })
    }),
  cancelExecution: (id: number) =>
    request<TestExecution>(`/executions/${id}/cancel`, { method: 'POST' }),
  retryExecution: (id: number) =>
    request<TestExecution>(`/executions/${id}/retry`, { method: 'POST' }),
  uploadExecutionEvidence: (id: number, file: File, description?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);
    return request<ExecutionEvidence>(`/executions/${id}/evidences`, {
      method: 'POST',
      body: form
    });
  },
  deleteExecutionEvidence: (executionId: number, evidenceId: number) =>
    request<void>(`/executions/${executionId}/evidences/${evidenceId}`, { method: 'DELETE' }),
  updateExecutionRetention: (id: number, retentionDays: number) =>
    request<TestExecution>(`/executions/${id}/retention`, {
      method: 'PATCH',
      body: JSON.stringify({ retentionDays })
    }),
  executionReport: (id: number, format: 'pdf' | 'csv') =>
    requestBlob(`/executions/${id}/report.${format}`),
  createBugFromExecution: (id: number, payload: { title?: string; severity: string; priority: string }) =>
    request<Bug>(`/executions/${id}/bugs`, { method: 'POST', body: JSON.stringify(payload) }),
  recordings: () => request<RecordingSession[]>('/recordings'),
  testPlans: (projectId?: number) =>
    request<TestPlan[]>(`/test-plans${projectId ? `?projectId=${projectId}` : ''}`),
  testPlan: (planId: number) => request<TestPlan>(`/test-plans/${planId}`),
  testSuites: (projectId?: number) =>
    request<TestSuite[]>(`/test-plans/suites${projectId ? `?projectId=${projectId}` : ''}`),
  createTestSuite: (payload: TestSuitePayload) =>
    request<TestSuite>('/test-plans/suites', { method: 'POST', body: JSON.stringify(payload) }),
  updateTestSuite: (suiteId: number, payload: Omit<TestSuitePayload, 'projectId'>) =>
    request<TestSuite>(`/test-plans/suites/${suiteId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createTestPlan: (payload: TestPlanPayload) =>
    request<TestPlan>('/test-plans', { method: 'POST', body: JSON.stringify(payload) }),
  updateTestPlan: (planId: number, payload: Omit<TestPlanPayload, 'projectId'> & { status: TestPlanStatus }) =>
    request<TestPlan>(`/test-plans/${planId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createTestCycle: (planId: number, payload: TestCyclePayload) =>
    request<TestCycle>(`/test-plans/${planId}/cycles`, { method: 'POST', body: JSON.stringify(payload) }),
  testCycle: (cycleId: number) => request<TestCycle>(`/test-plans/cycles/${cycleId}`),
  startTestCycle: (cycleId: number) =>
    request<{ cycleId: number; executions: TestExecution[]; skipped: { scenarioId: number; reason: string }[] }>(`/test-plans/cycles/${cycleId}/start`, { method: 'POST' }),
  scheduleTestCycle: (cycleId: number, scheduledAt: string | null) =>
    request<TestCycle>(`/test-plans/cycles/${cycleId}/schedule`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt })
    }),
  updateTestCycleStatus: (cycleId: number, status: TestCycleStatus) =>
    request<TestCycle>(`/test-plans/cycles/${cycleId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateCycleScenarioResult: (cycleId: number, scenarioId: number, result: CycleScenarioResult, notes?: string) =>
    request<{ item: unknown; cycleStatus?: TestCycleStatus }>(`/test-plans/cycles/${cycleId}/scenarios/${scenarioId}`, {
      method: 'PATCH',
      body: JSON.stringify({ result, notes: notes || null })
    }),
  compareTestCycles: (planId: number, baselineId?: number, targetId?: number) => {
    const query = new URLSearchParams();
    if (baselineId) query.set('baselineId', String(baselineId));
    if (targetId) query.set('targetId', String(targetId));
    return request<TestCycleComparison>(`/test-plans/${planId}/comparison${query.size ? `?${query}` : ''}`);
  }
};
