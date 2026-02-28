"use client"

/**
 * repo-switcher.tsx
 *
 * Sidebar panel that lists all imported repos.
 * Clicking a repo sets it as active (fires "active-repo-changed" event).
 * The (+) button redirects to /import-repository.
 */

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
    GitBranch,
    Plus,
    Trash2,
    Check,
    Clock,
} from "lucide-react"
import {
    getAllRepos,
    getActiveRepoId,
    setActiveRepoId,
    removeRepo,
    type RepoEntry,
} from "@/lib/repo-store"

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

export function RepoSwitcher() {
    const router = useRouter()
    const [repos, setRepos] = useState<RepoEntry[]>([])
    const [activeId, setActiveId] = useState<string>("")

    const refresh = useCallback(() => {
        setRepos(getAllRepos())
        setActiveId(getActiveRepoId())
    }, [])

    useEffect(() => {
        refresh()
        window.addEventListener("active-repo-changed", refresh)
        return () => window.removeEventListener("active-repo-changed", refresh)
    }, [refresh])

    const handleSelect = (id: string) => {
        if (id === activeId) return
        setActiveRepoId(id)
        setActiveId(id)
        window.dispatchEvent(new Event("active-repo-changed"))
    }

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        removeRepo(id)
        refresh()
        // If we just deleted the active repo, fire the event so graph resets
        window.dispatchEvent(new Event("active-repo-changed"))
    }

    return (
        <div className="flex h-full flex-col">
            {/* Section header */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Repositories
                </span>
                <button
                    onClick={() => router.push("/import-repository")}
                    title="Add repository"
                    className="flex h-5 w-5 items-center justify-center rounded border border-border bg-secondary text-muted-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                >
                    <Plus className="h-3 w-3" />
                </button>
            </div>

            {/* Repo list */}
            <div className="flex-1 overflow-y-auto">
                {repos.length === 0 ? (
                    /* Empty state */
                    <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30">
                            <GitBranch className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-xs text-muted-foreground/60">
                            No repositories yet.
                            <br />
                            Click&nbsp;
                            <button
                                onClick={() => router.push("/import-repository")}
                                className="text-primary underline-offset-2 hover:underline"
                            >
                                + Add
                            </button>
                            &nbsp;to import one.
                        </p>
                    </div>
                ) : (
                    <ul className="py-1">
                        {repos.map((repo) => {
                            const isActive = repo.id === activeId
                            return (
                                <li key={repo.id}>
                                    <div
                                        onClick={() => handleSelect(repo.id)}
                                        className={`group relative flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${isActive
                                            ? "bg-primary/10 text-foreground"
                                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                            }`}
                                    >
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <span className="absolute left-0 top-1/4 h-1/2 w-0.5 rounded-r-full bg-primary" />
                                        )}

                                        {/* Icon */}
                                        <div
                                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${isActive
                                                ? "border-primary/40 bg-primary/10"
                                                : "border-border bg-card/50"
                                                }`}
                                        >
                                            {isActive ? (
                                                <Check className="h-3 w-3 text-primary" />
                                            ) : (
                                                <GitBranch className="h-3 w-3" />
                                            )}
                                        </div>

                                        {/* Text */}
                                        <div className="min-w-0 flex-1">
                                            <p
                                                className={`truncate text-xs font-semibold ${isActive ? "text-foreground" : ""
                                                    }`}
                                            >
                                                {repo.repo_name}
                                            </p>
                                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                                                <Clock className="h-2.5 w-2.5" />
                                                <span>{timeAgo(repo.added_at)}</span>
                                                <span className="text-muted-foreground/40">·</span>
                                                <span>{repo.data.nodes.length} files</span>
                                            </div>
                                        </div>

                                        {/* Delete button — appears on hover */}
                                        <button
                                            onClick={(e) => handleDelete(e, repo.id)}
                                            title="Remove repository"
                                            className="mt-0.5 shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </div>
    )
}
