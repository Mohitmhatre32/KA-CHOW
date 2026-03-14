"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  GitBranch,
  Plus,
  Search,
  Trash2,
  Activity,
  Clock,
  LayoutGrid,
  ChevronRight,
  Code2,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { getAllRepos, removeRepo, setActiveRepoId, type RepoEntry } from "@/lib/repo-store"

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function HealthDot({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive"
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
  )
}

function RepoCard({ repo, onOpen, onDelete }: { repo: RepoEntry; onOpen: () => void; onDelete: () => void }) {
  const health = Math.round((repo.data?.health_score ?? 0) * 100)
  const files = repo.data?.nodes?.length ?? 0

  return (
    <div
      className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/40 hover:shadow-[0_0_24px_rgba(88,166,255,0.06)] cursor-pointer"
      onClick={onOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
            <Code2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground m-0 not-italic" style={{ fontFamily: "var(--font-serif)" }}>
              {repo.repo_name}
            </h2>
            <p className="truncate text-xs text-muted-foreground mt-0.5">
              {repo.repo_url.replace("https://github.com/", "")}
            </p>
          </div>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label="Delete repository"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <HealthDot score={health} />
          <span>{health}% health</span>
        </span>
        <span className="flex items-center gap-1.5">
          <LayoutGrid className="h-3 w-3" />
          {files} files
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <Clock className="h-3 w-3" />
          {timeAgo(repo.added_at)}
        </span>
      </div>

      {/* Health Bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${health >= 80 ? "bg-success" : health >= 50 ? "bg-warning" : "bg-destructive"}`}
          style={{ width: `${health}%` }}
        />
      </div>

      {/* Footer CTA */}
      <div className="flex items-center justify-end">
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open Dashboard <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-border bg-card">
        <GitBranch className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-foreground text-lg font-semibold m-0 not-italic" style={{ fontFamily: "var(--font-serif)" }}>
          No repositories yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          Import a GitHub repository to start analyzing its architecture and health metrics.
        </p>
      </div>
      <Button onClick={onImport} className="gap-2">
        <Plus className="h-4 w-4" />
        Import a Repository
      </Button>
    </div>
  )
}

export default function RepositoriesPage() {
  const router = useRouter()
  const [repos, setRepos] = useState<RepoEntry[]>([])
  const [query, setQuery] = useState("")
  const [mounted, setMounted] = useState(false)

  const load = useCallback(() => {
    setRepos(getAllRepos())
  }, [])

  useEffect(() => {
    setMounted(true)
    load()
  }, [load])

  const filtered = repos.filter(
    (r) =>
      r.repo_name.toLowerCase().includes(query.toLowerCase()) ||
      r.repo_url.toLowerCase().includes(query.toLowerCase())
  )

  const handleOpen = (repo: RepoEntry) => {
    setActiveRepoId(repo.id)
    router.push(`/dashboard/${repo.id}`)
  }

  const handleDelete = (id: string) => {
    removeRepo(id)
    load()
  }

  return (
    <div className={`min-h-screen bg-background transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2.5 group"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background transition-colors group-hover:border-primary/50">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground" style={{ fontFamily: "var(--font-serif)" }}>KA-CHOW</span>
        </button>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/import-repository")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Import Repo
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Page Title */}
        <div className="mb-8 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Your Repositories</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground m-0 not-italic" style={{ fontFamily: "var(--font-serif)" }}>
            Repository Intelligence Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {repos.length === 0
              ? "Start by importing a repository"
              : `${repos.length} repositor${repos.length === 1 ? "y" : "ies"} analyzed`}
          </p>
        </div>

        {repos.length === 0 ? (
          <EmptyState onImport={() => router.push("/import-repository")} />
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter repositories..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-16">
                No repositories match <span className="text-foreground font-medium">&ldquo;{query}&rdquo;</span>
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((repo) => (
                  <RepoCard
                    key={repo.id}
                    repo={repo}
                    onOpen={() => handleOpen(repo)}
                    onDelete={() => handleDelete(repo.id)}
                  />
                ))}

                {/* Add New Card */}
                <button
                  onClick={() => router.push("/import-repository")}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 p-5 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary min-h-[160px]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-current">
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium">Import Repository</span>
                </button>
              </div>
            )}

            {/* Footer note */}
            {repos.length > 0 && (
              <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Repository data is stored locally in your browser.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
