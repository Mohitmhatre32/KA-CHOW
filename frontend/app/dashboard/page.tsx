"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getActiveRepo, getAllRepos } from "@/lib/repo-store"
import { Loader2 } from "lucide-react"

/**
 * /dashboard → Smart redirect
 *
 * • If there's an active repo → /dashboard/[id]
 * • If repos exist but none selected → /dashboard/[firstRepo.id]
 * • Otherwise → /repositories
 */
export default function DashboardRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const active = getActiveRepo()
    if (active) {
      router.replace(`/dashboard/${active.id}`)
      return
    }
    const repos = getAllRepos()
    if (repos.length > 0) {
      router.replace(`/dashboard/${repos[0].id}`)
      return
    }
    router.replace("/repositories")
  }, [router])

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}