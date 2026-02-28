/**
 * api.ts — Frontend service layer for CODESIB backend API.
 * Base URL: http://localhost:8000
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Types ───────────────────────────────────────────────────────────────────

/** Matches backend FileNode Pydantic model */
export interface ApiGraphNode {
  id: string
  label: string
  type: string          // "file" | "folder"
  sonar_health: Record<string, any> // metrics from SonarQube
  layer: string         // e.g. "backend", "system"
}

/** Matches backend edges structure */
export interface ApiGraphEdge {
  source: string
  target: string
  relation: string      // "imports" | "contains"
}

/** Matches backend GraphResponse Pydantic model */
export interface KnowledgeGraphResponse {
  project_name: string
  branch: string
  nodes: ApiGraphNode[]
  edges: ApiGraphEdge[]
  health_score: number
  project_root: string    // absolute path on disk to the cloned/local repo
}

export interface ScaffoldRequest {
  prompt: string
}

export interface ScaffoldResponse {
  status: string
  message: string
  project_path: string
  files: string[]
  blueprint_summary: string
}

export interface ImpactAnalysisRequest {
  target_endpoint: string
  proposed_change: string
  repo_url: string
}

export interface ImpactResult {
  severity: "high" | "medium" | "low"
  affected_services: { name: string; reason: string }[]
  summary: string
}

export interface CommitInfo {
  hash: string
  message: string
  author: string
  date: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = typeof error.detail === 'object' ? JSON.stringify(error.detail, null, 2) : error.detail
    throw new Error(detail || `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = typeof error.detail === 'object' ? JSON.stringify(error.detail, null, 2) : error.detail
    throw new Error(detail || `Request failed: ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ─── Mentor Agent Types ────────────────────────────────────────────────────

export interface MentorChatResponse {
  answer: string
  sources: string[]
  sonar_stats: Record<string, unknown>
}

export interface OnboardingStep {
  id: string
  task: string
  description: string
  is_completed: boolean
}

export interface StarterQuest {
  title: string
  issue_description: string
  file_path: string
  xp_reward: number
  sonar_link: string
}

export interface TimelineEvent {
  sha: string
  author: string
  date: string
  message: string
  type: string  // 'feat' | 'fix' | 'chore' | 'docs' | 'refactor' | 'test' | 'other'
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────
// ─── Librarian Agent ──────────────────────────────────────────────────────────

/**
 * Fetches available branches for a repository.
 */
export async function getBranches(repoUrl: string): Promise<string[]> {
  return post<string[]>("/api/librarian/branches", { repo_url: repoUrl })
}

/**
 * Clones a repository and builds its knowledge graph.
 */
export async function analyzeRepository(
  repoUrl: string,
  branch: string = "main"
): Promise<KnowledgeGraphResponse> {
  return post<KnowledgeGraphResponse>("/api/librarian/scan", {
    input_source: repoUrl,
    branch
  })
}

/**
 * Triggers an asynchronous SonarQube scan for a repository.
 */
export async function triggerSonarScan(
  repoUrl: string,
  branch: string = "main"
): Promise<{ status: string, message: string }> {
  return post<{ status: string, message: string }>("/api/librarian/scan/trigger", {
    input_source: repoUrl,
    branch
  })
}

/**
 * Fetches raw content for a specific file.
 */
export async function getFileContent(filePath: string): Promise<string> {
  return post<string>("/api/librarian/content", { file_path: filePath })
}

/**
 * Fetches commit history for a repository.
 */
export async function getHistory(repoUrl: string): Promise<CommitInfo[]> {
  return post<CommitInfo[]>("/api/librarian/history", { repo_url: repoUrl })
}

// ─── Architect Agent ──────────────────────────────────────────────────────────

/**
 * Generates a scaffolded project from a natural-language prompt.
 */
export async function scaffoldProject(
  prompt: string
): Promise<ScaffoldResponse> {
  return post<ScaffoldResponse>("/api/architect/scaffold", { requirements: prompt })
}

/**
 * Runs a What-If blast radius impact analysis on the backend.
 */
export async function architectAnalyzeImpact(
  req: ImpactAnalysisRequest
): Promise<ImpactResult> {
  return post<ImpactResult>("/api/architect/analyze-impact", req)
}

// ─── Mentor Agent ─────────────────────────────────────────────────────────────

/**
 * Ask the Mentor AI a question with live SonarQube context.
 * Endpoint: POST /api/v1/mentor/chat
 */
export async function fetchMentorChat(
  question: string,
  role: string,
  repoUrl?: string
): Promise<MentorChatResponse> {
  return post<MentorChatResponse>("/api/v1/mentor/chat", {
    question,
    user_role: role,
    repo_url: repoUrl
  })
}

/**
 * Get role-based onboarding checklist.
 * Endpoint: GET /api/v1/mentor/onboarding/{role}
 */
export async function getOnboardingPath(role: string): Promise<OnboardingStep[]> {
  return get<OnboardingStep[]>(`/api/v1/mentor/onboarding/${encodeURIComponent(role)}`)
}

/**
 * Get the gamified daily quest from SonarQube.
 * Endpoint: GET /api/v1/mentor/quest
 */
export async function getDailyQuest(repoUrl?: string): Promise<StarterQuest> {
  const path = repoUrl ? `/api/v1/mentor/quest?repo_url=${encodeURIComponent(repoUrl)}` : "/api/v1/mentor/quest"
  return get<StarterQuest>(path)
}

/**
 * Get the git commit timeline for the Architecture Time Machine.
 * Endpoint: GET /api/v1/mentor/timeline
 */
export async function getArchitectureTimeline(repoUrl?: string): Promise<TimelineEvent[]> {
  const path = repoUrl ? `/api/v1/mentor/timeline?repo_url=${encodeURIComponent(repoUrl)}` : "/api/v1/mentor/timeline"
  return get<TimelineEvent[]>(path)
}

// ─── Guardian (CI/CD Enforcer) ───────────────────────────────────────────────
export interface PRReviewRequest {
  file_name: string
  code_content: string
}

export interface PRReviewResponse {
  status: "PASSED" | "BLOCKED"
  issues_found: string[]
  message: string
}

export interface AutoHealRequest {
  file_name: string
  code_content: string
  issues: string[]
}

export interface AutoHealResponse {
  fixed_code: string
  message: string
}

/**
 * Submits code to the Guardian agent for PR review.
 * Endpoint: POST /api/v1/guardian/review
 */
export async function guardianReviewPR(
  req: PRReviewRequest
): Promise<PRReviewResponse> {
  return post<PRReviewResponse>("/api/guardian/review", req)
}

/**
 * Requests AI-powered auto-healing of bad code.
 * Endpoint: POST /api/v1/guardian/heal
 */
export async function guardianAutoHeal(
  req: AutoHealRequest
): Promise<AutoHealResponse> {
  return post<AutoHealResponse>("/api/guardian/heal", req)
}

export interface EditorSaveRequest {
  file_path: string   // absolute path on disk
  content: string     // healed file content to write
  project_key: string // SonarQube project key (repo name)
}

export interface EditorResponse {
  status: string
  sonar_metrics: Record<string, unknown>
  message: string
}

/**
 * Saves healed code back to disk and runs a Sonar quality check.
 * Endpoint: POST /api/guardian/save-check
 */
export async function guardianSaveCheck(
  req: EditorSaveRequest
): Promise<EditorResponse> {
  return post<EditorResponse>("/api/guardian/save-check", req)
}

// ─── Documentation Generator ──────────────────────────────────────────────────

export interface DocNode {
  id: string
  label: string
  type: string
  layer?: string
  sonar_health?: Record<string, any>
}

export interface DocEdge {
  source: string
  target: string
  relation: string
}

export interface DocsRequest {
  project_name: string
  project_root: string
  nodes: DocNode[]
  edges: DocEdge[]
}

export interface DocsResponse {
  readme: string
  prd: string
  message: string
}

/**
 * Generates README and PRD documentation from the repo knowledge graph.
 */
export async function generateDocs(req: DocsRequest): Promise<DocsResponse> {
  return post<DocsResponse>("/api/librarian/generate-docs", req)
}

// ─── Alerts Inbox ─────────────────────────────────────────────────────────────

export interface Alert {
  id: number
  timestamp: string
  title: string
  message: string
  severity: "info" | "success" | "warning" | "critical"
  read: boolean
}

export async function getAlerts(): Promise<Alert[]> {
  return get<Alert[]>("/api/alerts")
}

export async function markAlertRead(alertId: number): Promise<void> {
  await post<{ ok: boolean }>(`/api/alerts/${alertId}/read`, {})
}

export async function markAllAlertsRead(): Promise<void> {
  await post<{ ok: boolean }>("/api/alerts/read-all", {})
}

export async function clearAlerts(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/alerts`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to clear alerts")
}

// ─── GitHub OAuth & Repository Selection ──────────────────────────────────────

export interface GithubRepo {
  id: number
  name: string
  full_name: string
  html_url: string
  clone_url: string
  private: boolean
  description: string | null
  default_branch: string
}

export async function getGithubClientId(): Promise<{ client_id: string }> {
  return get<{ client_id: string }>("/api/github/client-id")
}

export async function exchangeGithubToken(code: string): Promise<{ access_token: string }> {
  return post<{ access_token: string }>("/api/github/token", { code })
}

export async function getUserRepos(token: string): Promise<GithubRepo[]> {
  return post<GithubRepo[]>("/api/github/repos", { token })
}
