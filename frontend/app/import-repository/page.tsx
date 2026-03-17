"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, ArrowLeft, Loader2, Check, Github, AlertCircle, Lock, Unlock, Search } from "lucide-react"
import { analyzeRepository, getGithubClientId, getUserRepos, GithubRepo } from "@/lib/api"
import { upsertRepo, setActiveRepoId, getAllRepos } from "@/lib/repo-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

      setTimeout(() => router.push(`/dashboard/${newId}`), 600)
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setIsLoading(false)
      setCurrentStep(0)
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/repositories")}
        className="absolute left-6 top-6 gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <div className={`w-full max-w-2xl transition-all duration-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-col items-center text-center pb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background mb-4">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl italic">Import Your Repository</CardTitle>
          </CardHeader>

          <CardContent>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!githubToken ? (
            // Not Authenticated View
            <div className="flex flex-col items-center justify-center py-6 gap-8">
              {/* <Button
                onClick={handleConnectGithub}
                disabled={!clientId}
                className="w-full sm:w-auto h-12 px-8 bg-foreground text-background hover:bg-foreground/90 font-semibold"
              >
                <Github className="mr-2 h-5 w-5" />
                Connect with GitHub
              </Button> */}

              <div className="flex w-full items-center gap-4 text-xs text-muted-foreground/60 uppercase tracking-widest before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                Use a public GitHub URL
              </div>

              <form onSubmit={handleSubmit} className="w-full flex gap-3 flex-col sm:flex-row">
                <Input
                  type="url"
                  placeholder="https://github.com/user/repo"
                  value={selectedRepoUrl}
                  onChange={(e) => setSelectedRepoUrl(e.target.value)}
                  className="h-12"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !selectedRepoUrl}
                  className="h-12 px-8"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
                </Button>
              </form>
            </div>
          ) : (
            // Authenticated View
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Github className="h-4 w-4 text-primary" />
                  Connected to GitHub
                </div>
                <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs text-muted-foreground hover:text-destructive">
                  Disconnect
                </Button>
              </div>

              {isFetchingRepos ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Loading your repositories...</span>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      type="text"
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/20 p-1 space-y-1">
                    {filteredRepos.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground italic">
                        No repositories found.
                      </div>
                    ) : (
                      filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => setSelectedRepoUrl(repo.clone_url)}
                          className={`w-full flex items-center justify-between p-3 rounded-lg transition-all text-left border ${selectedRepoUrl === repo.clone_url ? 'bg-primary/5 border-primary/50' : 'hover:bg-accent border-transparent'}`}
                          disabled={isLoading}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-md ${repo.private ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                              {repo.private ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground leading-none mb-1">{repo.full_name}</p>
                              {repo.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{repo.description}</p>}
                            </div>
                          </div>
                          {selectedRepoUrl === repo.clone_url && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="flex gap-4">
                    <Input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="branch (e.g. main)"
                      disabled={isLoading}
                      className="w-1/3"
                    />

                    <Button
                      onClick={() => handleSubmit()}
                      disabled={isLoading || !selectedRepoUrl}
                      className="flex-1 h-12"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Import Selected Repository"
                      )}
                    </Button>
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
                  className={`flex items-center gap-3 text-xs tracking-wide uppercase font-mono transition-all duration-500 ${i <= currentStep ? "opacity-100" : "opacity-0 translate-y-2"}`}
                >
                  {i < currentStep ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : i === currentStep ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span className={i < currentStep ? "text-muted-foreground line-through opacity-50" : i === currentStep ? "text-primary font-bold" : "text-muted-foreground/30"}>
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
        <div className="mt-6 text-center">
            <small>OAuth authentication enables seamless imports of both public and private repositories.</small>
        </div>
      </div>
    </main>
  )
}
