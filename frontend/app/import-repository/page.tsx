"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, ArrowLeft, Loader2, Check, Github, AlertCircle } from "lucide-react"
import { analyzeRepository } from "@/lib/api"
import { upsertRepo, setActiveRepoId, getAllRepos } from "@/lib/repo-store"

const ANALYSIS_STEPS = [
  "Cloning repository...",
  "Parsing file structure...",
  "Analyzing dependencies...",
  "Building dependency graph...",
  "Running AI analysis...",
  "Finalizing insights...",
]

// Advance through steps during the API call (one step every ~3 s), stopping at
// the second-to-last so the final step is only reached once the API responds.
const STEP_INTERVAL_MS = 2800

export default function ImportRepositoryPage() {
  const router = useRouter()
  const [url, setUrl] = useState("")
  const [branch, setBranch] = useState("main")
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setCurrentStep(0)
    setError(null)

    // Animate steps forward while the API is in-flight (stop one before the last)
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
      // Call the real backend with optional branch
      const data = await analyzeRepository(url.trim(), branch.trim() || "main")

      // Stop the progress interval and jump to last step
      if (intervalRef.current) clearInterval(intervalRef.current)
      setCurrentStep(ANALYSIS_STEPS.length - 1)

      // Upsert into the multi-repo store and make it the active repo
      const newId = upsertRepo(url.trim(), data)
      setActiveRepoId(newId)

      // Short pause so the user sees the final step complete
      setTimeout(() => router.push("/dashboard"), 600)
    } catch (err) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setIsLoading(false)
      setCurrentStep(0)
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6">
      {/* Back button */}
      <button
        onClick={() => router.push(getAllRepos().length > 0 ? "/dashboard" : "/")}
        className="absolute left-6 top-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div
        className={`w-full max-w-lg transition-all duration-700 ${mounted ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
      >
        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Import Your Repository</h1>
            <p className="text-center text-sm text-muted-foreground">
              Paste a GitHub repository URL to begin analysis
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="space-y-4">
              <div className="relative">
                <Github className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/user/repo"
                  required
                  disabled={isLoading}
                  className="w-full rounded-lg border border-border bg-input py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="branch (e.g. main)"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-border bg-input py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-all duration-300 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Submit"
              )}
            </button>
          </form>

          {/* Loading Steps */}
          {isLoading && (
            <div className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
              {ANALYSIS_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-sm transition-all duration-500 ${i <= currentStep ? "opacity-100" : "opacity-0 translate-y-2"
                    }`}
                >
                  {i < currentStep ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : i === currentStep ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <span
                    className={
                      i < currentStep
                        ? "text-muted-foreground line-through"
                        : i === currentStep
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Helper text */}
        <p className="mt-4 text-center text-xs text-muted-foreground/60">
          Supports public and private repositories. Analysis typically takes 10-30 seconds.
        </p>
      </div>
    </main>
  )
}
