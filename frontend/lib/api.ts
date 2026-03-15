/**
 * api.ts — Frontend service layer for KA-CHOW Rebackend API.
 * Base URL: http://localhost:8000 (set via NEXT_PUBLIC_API_URL)
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Generic HTTP Helpers ──────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    const detail = typeof error.detail === "object" ? JSON.stringify(error.detail, null, 2) : error.detail
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
    const detail = typeof error.detail === "object" ? JSON.stringify(error.detail, null, 2) : error.detail
    throw new Error(detail || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Matches rebackend FileNode Pydantic model */
export interface ApiGraphNode {
  id: string
  label: string
  type: string           // "file" | "folder"
  layer: string          // "backend" | "frontend" | "system"
  language?: string
  size_bytes?: number
  sonar_health?: Record<string, unknown>
}

/** Matches rebackend edge structure */
export interface ApiGraphEdge {
  source: string
  target: string
  relation: string       // "imports" | "contains"
}

/** Matches rebackend GraphResponse Pydantic model */
export interface KnowledgeGraphResponse {
  project_name: string
  branch: string
  nodes: ApiGraphNode[]
  edges: ApiGraphEdge[]
  project_root: string
  processed_at?: string
  total_files: number
  total_chunks_embedded?: number
  documented_ratio: number
  from_cache: boolean
  // Computed on the client side for compatibility
  health_score?: number
}

export interface CommitInfo {
  hash: string
  message: string
  author: string
  date: string
  commit_type: string
}

// ─── Librarian Agent ──────────────────────────────────────────────────────────

/**
 * Fetches available branches for a repository.
 * Endpoint: GET /api/librarian/branches?repo_url=...
 */
export async function getBranches(repoUrl: string): Promise<string[]> {
  const data = await get<{ branches: string[] }>(
    `/api/librarian/branches?repo_url=${encodeURIComponent(repoUrl)}`
  )
  return data.branches
}

/**
 * Clones/processes a repository and builds its knowledge graph.
 * Endpoint: POST /api/librarian/process
 */
export async function analyzeRepository(
  repoUrl: string,
  branch: string = "main",
  force: boolean = false
): Promise<KnowledgeGraphResponse> {
  const data = await post<KnowledgeGraphResponse>("/api/librarian/process", {
    input_source: repoUrl,
    branch,
    force,
  })
  // Compute a simple health_score for compatibility with components that use it
  return { ...data, health_score: data.documented_ratio ? Math.round(data.documented_ratio * 100) : 0 }
}

/**
 * Fetches raw content for a specific file.
 * Endpoint: GET /api/librarian/file?full_path=...
 */
export async function getFileContent(filePath: string): Promise<string> {
  const data = await get<{ content: string; path: string }>(
    `/api/librarian/file?full_path=${encodeURIComponent(filePath)}`
  )
  return data.content
}

/**
 * Fetches commit history for a repository.
 * Endpoint: GET /api/librarian/history?input_source=...
 */
export async function getHistory(repoUrl: string): Promise<CommitInfo[]> {
  return get<CommitInfo[]>(
    `/api/librarian/history?input_source=${encodeURIComponent(repoUrl)}`
  )
}

/**
 * Triggers a stub scan (SonarQube deferred).
 * Endpoint: POST /api/scan/trigger
 */
export async function triggerSonarScan(
  repoUrl: string,
  _branch: string = "main"
): Promise<{ status: string; message: string }> {
  return post<{ status: string; message: string }>("/api/scan/trigger", {
    project_root: repoUrl,
  })
}

// ─── Architect Agent ──────────────────────────────────────────────────────────

export interface ScaffoldRequest {
  prompt: string
}

export interface ScaffoldResponse {
  status: string
  message: string
  project_path: string   // mapped from project_root
  files: string[]        // mapped from files_created
  blueprint_summary: string
}

/**
 * Generates a scaffolded project from a natural-language prompt.
 * Endpoint: POST /api/architect/build
 */
export async function scaffoldProject(prompt: string): Promise<ScaffoldResponse> {
  const data = await post<{
    project_root: string
    files_created: string[]
    message: string
  }>("/api/architect/build", {
    requirements: prompt,
    project_name: "ai_gen",
  })
  return {
    status: "success",
    message: data.message,
    project_path: data.project_root,
    files: data.files_created,
    blueprint_summary: `Generated ${data.files_created.length} files in ${data.project_root}`,
  }
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

export interface JiraTicketData {
  key: string
  summary: string
  status: string
  description: string
}

export interface JiraCreateTasksRequest {
  parent_key: string
  tasks: string[]
}

/**
 * Runs blast-radius impact analysis.
 * Endpoint: POST /api/architect/impact
 */
export async function architectAnalyzeImpact(req: ImpactAnalysisRequest): Promise<ImpactResult> {
  const data = await post<{
    impacted_files: { file_path: string; severity: string; reason: string }[]
    total_impacted: number
    blast_radius_depth: number
  }>("/api/architect/impact", {
    project_name: req.repo_url.split("/").pop()?.replace(".git", "") || "project",
    target_file: req.target_endpoint,
    proposed_change: req.proposed_change,
  })
  const highest = data.impacted_files.find(f => f.severity === "high") || data.impacted_files[0]
  return {
    severity: (highest?.severity as "high" | "medium" | "low") || "low",
    affected_services: data.impacted_files.map(f => ({ name: f.file_path, reason: f.reason })),
    summary: `${data.total_impacted} files affected at depth ${data.blast_radius_depth}`,
  }
}

export async function syncJiraTicket(key: string): Promise<JiraTicketData> {
  return get<JiraTicketData>(`/api/architect/jira/ticket/${key}`)
}

export async function createJiraTasks(parentKey: string, tasks: string[]): Promise<{success: boolean, message: string}> {
  return post<{success: boolean, message: string}>("/api/architect/jira/tasks", {
    parent_key: parentKey,
    tasks: tasks,
  })
}

// ─── Guardian Agent ───────────────────────────────────────────────────────────

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

export interface EditorSaveRequest {
  file_path: string
  content: string
  project_key?: string
}

export interface EditorResponse {
  status: string
  sonar_metrics: Record<string, unknown>
  message: string
}

/**
 * Submits code to the Guardian agent for PR review.
 * Endpoint: POST /api/guardian/review
 */
export async function guardianReviewPR(req: PRReviewRequest): Promise<PRReviewResponse> {
  const data = await post<{ passed: boolean; issues: string[]; message: string }>(
    "/api/guardian/review",
    req
  )
  return {
    status: data.passed ? "PASSED" : "BLOCKED",
    issues_found: data.issues,
    message: data.message,
  }
}

/**
 * Requests AI-powered auto-healing of bad code.
 * Endpoint: POST /api/guardian/heal
 */
export async function guardianAutoHeal(req: AutoHealRequest): Promise<AutoHealResponse> {
  return post<AutoHealResponse>("/api/guardian/heal", req)
}

/**
 * Saves healed code back to disk.
 * Endpoint: POST /api/guardian/save
 */
export async function guardianSaveCheck(req: EditorSaveRequest): Promise<EditorResponse> {
  const data = await post<{ success: boolean; message: string }>("/api/guardian/save", {
    file_path: req.file_path,
    content: req.content,
  })
  return {
    status: data.success ? "OK" : "ERROR",
    sonar_metrics: {},
    message: data.message,
  }
}

// ─── Mentor Agent ─────────────────────────────────────────────────────────────

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
  type: string
}

/**
 * Ask the Mentor AI a question with live RAG context.
 * Endpoint: POST /api/mentor/chat
 */
export async function fetchMentorChat(
  question: string,
  role: string,
  repoUrl?: string
): Promise<MentorChatResponse> {
  return post<MentorChatResponse>("/api/mentor/chat", {
    question,
    user_role: role,
    repo_url: repoUrl,
  })
}

/**
 * Get role-based onboarding checklist.
 * Endpoint: GET /api/mentor/onboarding/{role}
 */
export async function getOnboardingPath(role: string): Promise<OnboardingStep[]> {
  return get<OnboardingStep[]>(`/api/mentor/onboarding/${encodeURIComponent(role)}`)
}

/**
 * Get the gamified daily quest.
 * Endpoint: GET /api/mentor/quest
 */
export async function getDailyQuest(repoUrl?: string): Promise<StarterQuest> {
  const path = repoUrl
    ? `/api/mentor/quest?repo_url=${encodeURIComponent(repoUrl)}`
    : "/api/mentor/quest"
  return get<StarterQuest>(path)
}

/**
 * Get git commit timeline for the Architecture Time Machine.
 * Endpoint: GET /api/mentor/timeline
 */
export async function getArchitectureTimeline(repoUrl?: string): Promise<TimelineEvent[]> {
  const path = repoUrl
    ? `/api/mentor/timeline?repo_url=${encodeURIComponent(repoUrl)}`
    : "/api/mentor/timeline"
  return get<TimelineEvent[]>(path)
}

// ─── Documentation Generator ──────────────────────────────────────────────────

export interface DocNode {
  id: string
  label: string
  type: string
  layer?: string
  sonar_health?: Record<string, unknown>
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
 * Generates README and PRD documentation.
 * Endpoint: POST /api/librarian/generate-docs (compat stub on rebackend)
 */
export async function generateDocs(req: DocsRequest): Promise<DocsResponse> {
  return post<DocsResponse>("/api/librarian/generate-docs", req)
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

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

// ─── GitHub OAuth (Stubs — returns safe empty data) ───────────────────────────

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
