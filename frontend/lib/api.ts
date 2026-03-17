/**
 * api.ts — Frontend service layer for KA-CHOW Rebackend API.
 * Base URL: http://localhost:8000 (set via NEXT_PUBLIC_API_URL)
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"

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
  const url = `${BASE_URL}${path}`
  console.log(`[API] GET ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`[API] GET ${url} failed with status ${res.status}`)
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
  owner?: string
  sonar_health?: Record<string, any>
  jira_tickets?: string[]
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

/** Result from the Incremental Brain update endpoint */
export interface IncrementalUpdateResult {
  changed_files: string[]
  skipped_files: number
  total_files: number
  update_time_seconds: number
  full_scan_baseline_seconds: number
  graph_updated: boolean
  message: string
}

/**
 * Runs a git-diff-based incremental re-index.
 * Only processes files that changed since the last commit — much faster than a full scan.
 * Endpoint: POST /api/librarian/incremental-update
 */
export async function incrementalUpdate(repoUrl: string): Promise<IncrementalUpdateResult> {
  return post<IncrementalUpdateResult>("/api/librarian/incremental-update", {
    repo_url: repoUrl,
  })
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

export interface PullRequestInfo {
  id: number
  number: number
  title: string
  state: string
  author: string
  created_at: string
  url: string
}

export interface GithubSyncResult {
  commits: CommitInfo[]
  pull_requests: PullRequestInfo[]
  message: string
}

export async function syncGithub(repoUrl: string): Promise<GithubSyncResult> {
  return get<GithubSyncResult>(
    `/api/librarian/sync-github?input_source=${encodeURIComponent(repoUrl)}`
  )
}

export interface SonarScanResponse {
  status: string
  project_metrics?: Record<string, any>
  message: string
}

/**
 * Triggers a real-time SonarQube quality audit.
 * Endpoint: POST /api/librarian/sonar-scan
 */
export async function triggerSonarScan(repoUrl: string): Promise<SonarScanResponse> {
  return post<SonarScanResponse>("/api/librarian/sonar-scan", {
    repo_url: repoUrl,
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
  impacted_files: { file_path: string; severity: string; reason: string }[]
  total_impacted: number
  blast_radius_depth: number
  severity: "high" | "medium" | "low"
  summary: string
  scenario_explanation?: string
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
  const data = await post<ImpactResult>("/api/architect/impact", {
    project_name: req.repo_url.split("/").pop()?.replace(".git", "") || "project",
    target_file: req.target_endpoint,
    proposed_change: req.proposed_change,
  })
  
  // Ensure we have a top-level severity and summary for the UI if not already there
  const highestSvc = data.impacted_files.find(f => f.severity === "high") || data.impacted_files[0]
  return {
    ...data,
    severity: (highestSvc?.severity as "high" | "medium" | "low") || "low",
    summary: `${data.total_impacted} files affected at depth ${data.blast_radius_depth}`,
    scenario_explanation: data.scenario_explanation
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

export interface AppTask {
  id: string
  project_name: string
  title: string
  status: string
  linked_nodes: string[]
}

export async function getAppTasks(projectName: string): Promise<AppTask[]> {
  return get<AppTask[]>(`/api/tasks/${encodeURIComponent(projectName)}`)
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

export interface GuardianAuditRecord {
  timestamp: string
  file_name: string
  passed: boolean
  issues_count: number
  message: string
  issues: string[]
}

/**
 * Fetches the trail of Guardian review decisions.
 * Endpoint: GET /api/guardian/audit
 */
export async function getGuardianAuditLogs(): Promise<GuardianAuditRecord[]> {
  return get<GuardianAuditRecord[]>("/api/guardian/audit")
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

export interface DocumentationRequest {
  project_name: string
  repo_url?: string
}

export interface DocumentationResponse {
  markdown: string
  message: string
}

/**
 * Generates industry-standard PROJECT_GUIDE.md documentation.
 * Endpoint: POST /api/librarian/generate-docs
 */
export async function generateIndustryDocs(req: DocumentationRequest): Promise<DocumentationResponse> {
  return post<DocumentationResponse>("/api/librarian/generate-docs", req)
}

/** @deprecated Use generateIndustryDocs */
export interface DocNode { id: string; label: string; type: string }
/** @deprecated Use generateIndustryDocs */
export interface DocEdge { source: string; target: string; relation: string }
/** @deprecated Use generateIndustryDocs */
export interface DocsRequest { project_name: string; project_root: string; nodes: DocNode[]; edges: DocEdge[] }
/** @deprecated Use generateIndustryDocs */
export interface DocsResponse { readme: string; prd: string; message: string; markdown?: string }

/** @deprecated Use generateIndustryDocs */
export async function generateDocs(req: DocsRequest): Promise<DocsResponse> {
  const res = await post<DocsResponse>("/api/librarian/generate-docs", req)
  // Compatibility fix: if the server returns the new markdown format, map it to readme for the UI
  if (res.markdown && !res.readme) {
    return { ...res, readme: res.markdown, prd: "# Dynamic PRD\nPRD content is inside the main guide." }
  }
  return res
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

// ─── Diagram Agent ────────────────────────────────────────────────────────────

export interface DiagramRequest {
  repo_url: string
  diagram_type?: string
  prompt_override?: string
}

export interface DiagramResponse {
  repo_url: string
  diagram_type: string
  mermaid_markdown: string
  message: string
}

/**
 * Generates an architecture diagram for an ingested repository.
 * Endpoint: POST /api/diagram/generate
 */
export async function generateArchitectureDiagram(req: DiagramRequest): Promise<DiagramResponse> {
  return post<DiagramResponse>("/api/diagram/generate", req)
}
