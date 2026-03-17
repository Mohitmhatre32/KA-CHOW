"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { GitBranch, ArrowLeft, Loader2, Check, AlertCircle } from "lucide-react"
import { analyzeRepository } from "@/lib/api"
import { upsertRepo, setActiveRepoId } from "@/lib/repo-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedRepoUrl.trim()) return

    setIsLoading(true)
    setCurrentStep(0)
    setError(null)

    const finalUrl = selectedRepoUrl.trim()

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

      const storeUrl = selectedRepoUrl.trim()
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
            <CardDescription>
              Provide a public repository URL to analyze the codebase architecture
            </CardDescription>
          </CardHeader>

          <CardContent>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

            <div className="flex flex-col items-center justify-center py-6 gap-8">
              <form onSubmit={handleSubmit} className="w-full flex gap-3 flex-col sm:flex-row">
                <Input
                  type="url"
                  placeholder="https://github.com/user/repo"
                  value={selectedRepoUrl}
                  onChange={(e) => setSelectedRepoUrl(e.target.value)}
                  className="h-12 flex-1"
                  disabled={isLoading}
                />
                <Input
                  type="text"
                  placeholder="branch (e.g. main)"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="h-12 w-32"
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
      </div>
    </main>
  )
}
