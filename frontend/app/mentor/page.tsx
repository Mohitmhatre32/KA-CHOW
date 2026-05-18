"use client"

/**
 * This standalone /mentor route is a legacy artifact superseded by the
 * Mentor tab inside the main dashboard (components/dashboard/mentor-view.tsx).
 *
 * It now redirects users to the appropriate dashboard so they use the
 * canonical, design-system-consistent implementation instead.
 */

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAllRepos } from "@/lib/repo-store"
import { Brain, Loader2 } from "lucide-react"

export default function MentorPageRedirect() {
    const router = useRouter()

    useEffect(() => {
        const repos = getAllRepos()
        if (repos.length > 0) {
            // Deep-link directly to the Mentor agent tab
            router.replace(`/dashboard/${repos[0].id}?view=mentor`)
        } else {
            // No repos imported yet — send to the repositories list
            router.replace("/repositories")
        }
    }, [router])

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 text-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <Brain className="h-8 w-8 text-primary" />
            </div>
            <div className="flex flex-col items-center gap-2">
                <p className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
                    Redirecting to Mentor
                </p>
                <p className="font-mono text-xs text-muted-foreground">
                    The Mentor view has moved to the main dashboard
                </p>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
    )
}
