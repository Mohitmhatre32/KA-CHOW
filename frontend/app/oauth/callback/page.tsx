"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { exchangeGithubToken } from "@/lib/api"

export default function OAuthCallbackPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const code = searchParams.get("code")

        if (!code) {
            setError("No authorization code provided by GitHub.")
            return
        }

        const exchangeToken = async () => {
            try {
                const { access_token } = await exchangeGithubToken(code)
                if (access_token) {
                    // Store securely - localStorage is sufficient for this scope
                    localStorage.setItem("github_token", access_token)
                    router.push("/import-repository?auth=success")
                } else {
                    setError("GitHub did not return an access token.")
                }
            } catch (err: any) {
                setError(err.message || "Failed to exchange token.")
            }
        }

        exchangeToken()
    }, [searchParams, router])

    if (error) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-8 flex flex-col items-center max-w-md w-full">
                    <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                    <h1 className="text-xl font-semibold text-foreground mb-2 text-center">Authentication Failed</h1>
                    <p className="text-sm text-destructive text-center mb-6">{error}</p>
                    <button
                        onClick={() => router.push("/import-repository")}
                        className="rounded-lg bg-primary py-2 px-6 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
                    >
                        Return to Import
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h2 className="text-lg font-medium text-foreground">Authenticating with GitHub...</h2>
                <p className="text-sm text-muted-foreground">Please wait a moment.</p>
            </div>
        </div>
    )
}
