"use client"

import { useState } from "react"
import { signInWithPopup, GithubAuthProvider } from "firebase/auth"
import { auth, githubProvider, isFirebaseConfigured } from "@/lib/firebase"
import { Key, Loader2, AlertCircle, ExternalLink, ShieldCheck, Github, Settings, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConnectGithubModalProps {
  isOpen: boolean
  onClose: () => void
  onConnected: () => void
}

export function ConnectGithubModal({
  isOpen,
  onClose,
  onConnected,
}: ConnectGithubModalProps) {
  const [patToken, setPatToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usePatFallback, setUsePatFallback] = useState(!isFirebaseConfigured)

  // Firebase OAuth Popup Flow
  const handleFirebaseSignIn = async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (!auth) {
        throw new Error("Firebase Authentication is not initialized.")
      }

      const result = await signInWithPopup(auth, githubProvider)
      const credential = GithubAuthProvider.credentialFromResult(result)
      const token = credential?.accessToken

      if (!token) {
        throw new Error("Failed to retrieve GitHub access token from login.")
      }

      // Extract username/screenName safely
      const rawUserInfo = (result.user as any).reloadUserInfo
      const username = rawUserInfo?.screenName || result.user.displayName || "github-user"

      // Store credentials in localStorage
      localStorage.setItem("github_token", token)
      localStorage.setItem(
        "github_user",
        JSON.stringify({
          username,
          name: result.user.displayName || username,
          avatar_url: result.user.photoURL || "",
        })
      )

      onConnected()
      onClose()
    } catch (err: any) {
      console.error("Firebase Login Error:", err)
      let msg = "Failed to sign in with GitHub."
      if (err.code === "auth/popup-closed-by-user") {
        msg = "Sign in popup was closed. Please try again."
      } else if (err.code === "auth/configuration-not-found") {
        msg = "GitHub Social Sign-In has not been enabled in your Firebase project console."
      } else if (err.message) {
        msg = err.message
      }
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // PAT Fallback Flow (Manual paste)
  const handlePatConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patToken.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      // Validate the token by fetching user profile from GitHub
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${patToken.trim()}`,
          Accept: "application/vnd.github.v3+json",
        },
      })

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Invalid GitHub token. Please check and try again.")
        }
        throw new Error(`GitHub verification failed: ${res.statusText}`)
      }

      const userData = await res.json()

      // Save token and user details to localStorage
      localStorage.setItem("github_token", patToken.trim())
      localStorage.setItem(
        "github_user",
        JSON.stringify({
          username: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
        })
      )

      setPatToken("")
      onConnected()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to GitHub")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border bg-card max-w-md p-6">
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background mb-2">
            <Github className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight italic">
            Connect GitHub
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs mt-1">
            Choose how you would like to connect your GitHub account
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive animate-in fade-in zoom-in-95 duration-200">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Flow A: Firebase Popup (Only shown if configured and not explicitly using PAT) */}
          {isFirebaseConfigured && !usePatFallback && (
            <div className="space-y-4">
              <Button
                onClick={handleFirebaseSignIn}
                disabled={isLoading}
                className="w-full h-11 flex items-center justify-center gap-2 text-sm font-semibold hover:bg-primary/95 shadow-[var(--shadow-brutal-primary)]"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Github className="h-4.5 w-4.5" />
                )}
                Sign in with GitHub
              </Button>
              
              <div className="flex items-center justify-center gap-2">
                <div className="h-px bg-border flex-1" />
                <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">or connect via token</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <button
                onClick={() => setUsePatFallback(true)}
                className="w-full text-center text-xs font-semibold text-primary hover:underline"
              >
                Use Personal Access Token instead
              </button>
            </div>
          )}

          {/* Flow B: PAT fallback form */}
          {usePatFallback && (
            <form onSubmit={handlePatConnect} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Personal Access Token (PAT)
                </label>
                <Input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={patToken}
                  onChange={(e) => setPatToken(e.target.value)}
                  disabled={isLoading}
                  className="h-10 text-sm"
                  required
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-success" /> Token Instructions
                </h4>
                <ol className="list-decimal pl-4 text-xs text-muted-foreground space-y-1.5">
                  <li>
                    Go to{" "}
                    <a
                      href="https://github.com/settings/tokens/new?description=KA-CHOW%20Intelligence%20Brain&scopes=repo,read:user"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5 font-medium"
                    >
                      GitHub Settings <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </li>
                  <li>
                    Ensure <code className="bg-background px-1 py-0.5 rounded font-mono text-[10px] text-foreground">repo</code> and <code className="bg-background px-1 py-0.5 rounded font-mono text-[10px] text-foreground">read:user</code> are selected.
                  </li>
                  <li>Paste the generated token in the field above.</li>
                </ol>
              </div>

              {isFirebaseConfigured && (
                <button
                  type="button"
                  onClick={() => setUsePatFallback(false)}
                  className="w-full text-center text-xs font-semibold text-primary hover:underline pt-2"
                >
                  ← Back to Social Sign-In
                </button>
              )}
            </form>
          )}

          {/* Setup notice when Firebase is not configured */}
          {!isFirebaseConfigured && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-warning flex items-center gap-1.5">
                <Info className="h-4 w-4 text-warning" /> Firebase Auth Setup
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                To enable one-click social logins, configure Firebase credentials in your frontend <code className="font-mono bg-background text-foreground px-1 py-0.5 rounded">.env</code> file:
              </p>
              <pre className="text-[10px] bg-background border border-border p-2.5 rounded font-mono text-muted-foreground overflow-x-auto">
{`NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."`}
              </pre>
            </div>
          )}

          {/* Dialog Footer for PAT */}
          {usePatFallback && (
            <div className="flex gap-3 justify-end pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isLoading}
                className="h-9 px-4 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePatConnect}
                disabled={isLoading || !patToken.trim()}
                className="h-9 px-6 text-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                    Connecting
                  </>
                ) : (
                  "Connect Token"
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
