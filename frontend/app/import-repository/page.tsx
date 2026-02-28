"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, ArrowLeft, Loader2, Check, Github, AlertCircle, Book, Lock, Unlock } from "lucide-react"
import { analyzeRepository, getGithubClientId, getUserRepos, GithubRepo } from "@/lib/api"
import { upsertRepo, setActiveRepoId, getAllRepos } from "@/lib/repo-store"

const ANALYSIS_STEPS = [
  "Cloning repository...",
  "Parsing file structure...",
  "Analyzing dependencies...",
  "Building dependency graph...",
  "Finalizing insights...",
]

const STEP_INTERVAL_MS = 2800

export default function ImportRepositoryPage() {
  const router = useRouter()

  // Auth & Repos State
  const [githubToken, setGithubToken] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [repos, setRepos] = useState<GithubRepo[]>([])
  const [filteredRepos, setFilteredRepos] = useState<GithubRepo[]>([])
  const [isFetchingRepos, setIsFetchingRepos] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Selection State
  const [selectedRepoUrl, setSelectedRepoUrl] = useState("")
  const [branch, setBranch] = useState("main")

  // App State
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMounted(true)

    // Check for existing token
    const token = localStorage.getItem("github_token")
    if (token) {
      setGithubToken(token)
    }

    // Fetch client ID for OAuth
    getGithubClientId()
      .then(res => setClientId(res.client_id))
      .catch(err => console.error("Failed to fetch client ID", err))

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    if (githubToken) {
      setIsFetchingRepos(true)
      getUserRepos(githubToken)
        .then(data => {
          setRepos(data)
          setFilteredRepos(data)
        })
        .catch(err => {
          setError("Failed to fetch repositories. Token may be expired.")
          localStorage.removeItem("github_token")
          setGithubToken(null)
        })
        .finally(() => setIsFetchingRepos(false))
    }
  }, [githubToken])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRepos(repos)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredRepos(repos.filter(r => r.full_name.toLowerCase().includes(query)))
    }
  }, [searchQuery, repos])

  const handleConnectGithub = () => {
    if (!clientId) return
    const redirectUri = `${window.location.origin}/oauth/callback`
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  const handleDisconnect = () => {
    localStorage.removeItem("github_token")
    setGithubToken(null)
    setRepos([])
    setFilteredRepos([])
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedRepoUrl.trim()) return

    setIsLoading(true)
    setCurrentStep(0)
    setError(null)

    // Append OAuth token to URL if we have one to support private repositories seamlessly
    let finalUrl = selectedRepoUrl.trim()
    if (githubToken && finalUrl.startsWith("https://github.com/")) {
      finalUrl = finalUrl.replace("https://github.com/", `https://x-access-token:${githubToken}@github.com/`)
    }

    const PENULTIMATE = ANALYSIS_STEPS.length - 2
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= PENULTIMATE) {
          clearInterval(intervalRef.current!)
          return prev
        }
        return prev + 1
      })
    }, STEP_INTERVAL_MS)

    try {
      const data = await analyzeRepository(finalUrl, branch.trim() || "main")

      if (intervalRef.current) clearInterval(intervalRef.current)
      setCurrentStep(ANALYSIS_STEPS.length - 1)

      const storeUrl = selectedRepoUrl.trim() // store clean URL without token
      const newId = upsertRepo(storeUrl, data)
      setActiveRepoId(newId)

      setTimeout(() => router.push("/dashboard"), 600)
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setIsLoading(false)
      setCurrentStep(0)
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <button
        onClick={() => router.push(getAllRepos().length > 0 ? "/dashboard" : "/")}
        className="absolute left-6 top-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className={`w-full max-w-2xl transition-all duration-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
        <div className="rounded-xl border border-border bg-card p-8">

          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Import Your Repository</h1>
            <p className="text-center text-sm text-muted-foreground">
              {githubToken ? "Select a repository to analyze codebase architecture" : "Connect with GitHub to seamlessly import your repositories"}
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!githubToken ? (
            // Not Authenticated View
            <div className="flex flex-col items-center justify-center py-6 gap-6">
              <button
                onClick={handleConnectGithub}
                disabled={!clientId}
                className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-foreground text-background py-3 px-8 text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Github className="h-5 w-5" />
                Connect with GitHub
              </button>

              <div className="flex w-full items-center gap-4 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                or use public URL
              </div>

              <form onSubmit={handleSubmit} className="w-full flex gap-3 flex-col sm:flex-row">
                <input
                  type="url"
                  placeholder="https://github.com/user/repo"
                  value={selectedRepoUrl}
                  onChange={(e) => setSelectedRepoUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-input py-3 px-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !selectedRepoUrl}
                  className="rounded-lg bg-primary py-3 px-6 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
                </button>
              </form>
            </div>
          ) : (
            // Authenticated View
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                  <Github className="h-4 w-4" />
                  Connected to GitHub
                </div>
                <button onClick={handleDisconnect} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Disconnect
                </button>
              </div>

              {isFetchingRepos ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading your repositories...</span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-border bg-input py-2.5 px-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-1 space-y-1">
                    {filteredRepos.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No repositories found.
                      </div>
                    ) : (
                      filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => setSelectedRepoUrl(repo.clone_url)}
                          className={`w-full flex items-center justify-between p-3 rounded-md transition-colors text-left ${selectedRepoUrl === repo.clone_url ? 'bg-primary/10 border-primary border' : 'hover:bg-secondary border border-transparent'}`}
                          disabled={isLoading}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-md ${repo.private ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                              {repo.private ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{repo.full_name}</p>
                              {repo.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{repo.description}</p>}
                            </div>
                          </div>
                          {selectedRepoUrl === repo.clone_url && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="branch (e.g. main)"
                      disabled={isLoading}
                      className="w-1/3 rounded-lg border border-border bg-input py-3 px-4 text-sm focus:border-primary focus:outline-none"
                    />

                    <button
                      onClick={() => handleSubmit()}
                      disabled={isLoading || !selectedRepoUrl}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Import Selected Repository"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {isLoading && (
            <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6">
              {ANALYSIS_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-sm transition-all duration-500 ${i <= currentStep ? "opacity-100" : "opacity-0 translate-y-2"}`}
                >
                  {i < currentStep ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : i === currentStep ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span className={i < currentStep ? "text-muted-foreground line-through" : i === currentStep ? "text-foreground font-medium" : "text-muted-foreground/50"}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          OAuth authentication enables seamless imports of both public and private repositories.
        </p>
      </div>
    </main>
  )
}
