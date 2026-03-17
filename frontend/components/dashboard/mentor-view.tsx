"use client"

import { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
    fetchMentorChat,
    getOnboardingPath,
    getDailyQuest,
    getArchitectureTimeline,
    type MentorChatResponse,
    type OnboardingStep,
    type StarterQuest,
    type TimelineEvent,
} from "@/lib/api"
import { getActiveRepo } from "@/lib/repo-store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Brain,
    MessageSquare,
    CheckCircle2,
    ShieldCheck,
    Sword,
    ScrollText,
    Send,
    Loader2,
    Terminal,
} from "lucide-react"

// ─── Commit Type Config ───────────────────────────────────────────────────────
const COMMIT_TYPE: Record<string, { color: string; bg: string; label: string }> = {
    feat: { color: "var(--primary)", bg: "rgba(var(--primary),0.15)", label: "feat" },
    fix: { color: "var(--destructive)", bg: "rgba(var(--destructive),0.15)", label: "fix" },
    chore: { color: "var(--muted-foreground)", bg: "rgba(var(--muted-foreground),0.12)", label: "chore" },
    docs: { color: "var(--primary)", bg: "rgba(var(--primary),0.15)", label: "docs" },
    refactor: { color: "var(--warning)", bg: "rgba(var(--warning),0.15)", label: "refactor" },
    test: { color: "var(--success)", bg: "rgba(var(--success),0.15)", label: "test" },
    other: { color: "var(--muted-foreground)", bg: "rgba(var(--muted-foreground),0.10)", label: "other" },
}

const ROLES = ["Backend", "Frontend", "SRE"]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SonarBadge({ stats }: { stats: Record<string, unknown> }) {
    const gate = (stats.quality_gate as string) || "N/A"
    const isOk = gate === "OK" || gate === "PASSED"
    return (
        <Badge
            variant="outline"
            className={`h-5 gap-1.5 px-2 font-mono text-[9px] font-bold uppercase tracking-wider ${isOk ? "border-success/40 bg-success/10 text-success" : "border-destructive/40 bg-destructive/10 text-destructive"}`}
        >
            <div className={`h-1.5 w-1.5 rounded-full ${isOk ? "bg-success" : "bg-destructive"}`} />
            {isOk ? "SONAR OK" : `SONAR ${gate}`}
        </Badge>
    )
}

function ChatMessage({ role, content }: { role: "user" | "ai"; content: string }) {
    const isUser = role === "user"
    return (
        <div
            className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
        >
            {!isUser && (
                <div
                    className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-sm shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                >
                    <Brain className="h-4 w-4 text-primary" />
                </div>
            )}
            <div
                className={`group relative max-w-[85%] rounded-2xl px-4 py-3 transition-all duration-300 ${isUser
                        ? "ml-4 bg-primary text-primary-foreground shadow-lg"
                        : "mr-4 border border-border bg-muted/30 text-foreground backdrop-blur-sm"
                    }`}
            >
                <div className="font-mono text-xs leading-relaxed">
                    {isUser ? (
                        <div className="whitespace-pre-wrap">{content}</div>
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code: ({ node, className, children, ...props }: any) => {
                                    const match = /language-(\w+)/.exec(className || "")
                                    const isInline = !match && !String(children).includes("\n")
                                    return isInline ? (
                                        <code className="rounded bg-muted/40 px-1 py-0.5 font-mono text-[11px] font-medium text-primary border border-border/50" {...props}>
                                            {children}
                                        </code>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    )
                                },
                                pre: ({ children }) => (
                                    <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-black/40 p-3.5 font-mono text-xs leading-relaxed text-muted-foreground shadow-sm">
                                        {children}
                                    </pre>
                                ),
                                p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                h1: ({ children }) => <h1 className="mb-2 mt-5 font-mono text-base font-black text-foreground uppercase tracking-widest border-b border-border pb-1">{children}</h1>,
                                h2: ({ children }) => <h2 className="mb-2 mt-4 font-mono text-sm font-bold text-foreground uppercase tracking-tight">{children}</h2>,
                                h3: ({ children }) => <h3 className="mb-1 mt-3 font-mono text-[13px] font-bold text-foreground">{children}</h3>,
                                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 text-muted-foreground marker:text-primary">{children}</ul>,
                                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 text-muted-foreground marker:text-primary">{children}</ol>,
                                li: ({ children }) => <li className="pl-1 leading-relaxed text-muted-foreground">{children}</li>,
                                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                                a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">{children}</a>
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    )}
                </div>
                {isUser && (
                    <div className="invisible absolute -left-12 top-1/2 flex -translate-y-1/2 items-center gap-1 group-hover:visible">
                        <Badge variant="outline" className="h-5 bg-background/50 font-mono text-[8px] text-muted-foreground opacity-60">SENT</Badge>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── Mentor View (Internal Component) ─────────────────────────────────────────

export function MentorView() {
    // Chat
    const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([
        { role: "ai", content: "👋 Hey! I'm your **KA-CHOW Mentor**. Ask me anything about the codebase, architecture, or best practices. I have live SonarQube data to help guide you!" },
    ])
    const [input, setInput] = useState("")
    const [isChatLoading, setIsChatLoading] = useState(false)
    const [sonarStats, setSonarStats] = useState<Record<string, unknown>>({})
    const chatEndRef = useRef<HTMLDivElement>(null)

    // Onboarding
    const [role, setRole] = useState("Backend")
    const [onboarding, setOnboarding] = useState<OnboardingStep[]>([])
    const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
    const [onboardingLoading, setOnboardingLoading] = useState(false)

    // Quest
    const [quest, setQuest] = useState<StarterQuest | null>(null)
    const [questLoading, setQuestLoading] = useState(true)

    // Timeline
    const [timeline, setTimeline] = useState<TimelineEvent[]>([])
    const [selectedCommit, setSelectedCommit] = useState<TimelineEvent | null>(null)
    const [timelineLoading, setTimelineLoading] = useState(true)

    // ── Effects ────────────────────────────────────────────────────────────────
    useEffect(() => {
        const activeRepo = getActiveRepo()
        const repoUrl = activeRepo?.repo_url

        getDailyQuest(repoUrl)
            .then(setQuest)
            .catch(() => setQuest(null))
            .finally(() => setQuestLoading(false))

        getArchitectureTimeline(repoUrl)
            .then((data) => { setTimeline(data); if (data.length) setSelectedCommit(data[0]) })
            .catch(() => setTimeline([]))
            .finally(() => setTimelineLoading(false))
    }, [])

    useEffect(() => {
        setOnboardingLoading(true)
        getOnboardingPath(role)
            .then(setOnboarding)
            .catch(() => setOnboarding([]))
            .finally(() => setOnboardingLoading(false))
    }, [role])

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // ── Chat handler ───────────────────────────────────────────────────────────
    async function sendMessage() {
        const q = input.trim()
        if (!q || isChatLoading) return
        setInput("")
        setMessages((prev) => [...prev, { role: "user", content: q }])
        setIsChatLoading(true)
        try {
            const activeRepo = getActiveRepo()
            const res: MentorChatResponse = await fetchMentorChat(q, role, activeRepo?.repo_url)
            setSonarStats(res.sonar_stats || {})
            setMessages((prev) => [...prev, { role: "ai", content: res.answer }])
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: `⚠️ Error: ${(err as Error).message}` },
            ])
        } finally {
            setIsChatLoading(false)
        }
    }

    function toggleCheck(id: string) {
        setCheckedIds((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    // ── Styles ─────────────────────────────────────────────────────────────────
    const glass: React.CSSProperties = {
        background: "rgba(15,20,40,0.72)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
    }
    const neonBorder: React.CSSProperties = {
        border: "1px solid rgba(99,102,241,0.35)",
        boxShadow: "0 0 18px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="h-full overflow-y-auto bg-background/50 p-6 scrollbar-hide">
            {/* ── Header ── */}
            <div className="mb-8">
                <div className="flex items-center gap-4">
                    <div
                        className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_25px_rgba(var(--primary),0.15)]"
                    >
                        <Brain className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="font-mono text-2xl font-black uppercase tracking-tight text-foreground">
                            KA-CHOW{" "}
                            <span className="text-primary italic">
                                Mentor
                            </span>
                        </h1>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                            AI-Powered Developer Onboarding &amp; Code Intelligence
                        </p>
                    </div>

                    {/* Role selector in header */}
                    <div className="ml-auto flex gap-1.5">
                        {ROLES.map((r) => (
                            <Button
                                key={r}
                                onClick={() => setRole(r)}
                                variant={role === r ? "default" : "outline"}
                                size="sm"
                                className={`h-8 font-mono text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${role === r ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]" : "border-border text-muted-foreground opacity-70 hover:opacity-100"}`}
                            >
                                {r}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main Grid (Chat | Quest + Onboarding) ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,380px]">

                {/* ── LEFT: Chat ── */}
                <div className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-card/30 backdrop-blur-md shadow-2xl">
                    {/* Chat header */}
                    <div
                        className="flex items-center gap-3 border-b border-border bg-muted/20 px-5 py-4"
                    >
                        <div
                            className="h-2 w-2 animate-pulse rounded-full bg-success shadow-[0_0_10px_rgba(var(--success),0.8)]"
                        />
                        <span className="font-mono text-xs font-black uppercase tracking-widest text-foreground">Mentor AI</span>
                        <Badge variant="outline" className="font-mono text-[9px] text-muted-foreground opacity-50">{role} Mode</Badge>
                        <div className="ml-auto">
                            <SonarBadge stats={sonarStats} />
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-2">
                        {messages.map((m, i) => (
                            <ChatMessage key={i} role={m.role} content={m.content} />
                        ))}
                        {isChatLoading && (
                            <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground opacity-60">
                                <div className="flex gap-1">
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
                                            style={{ animationDelay: `${i * 0.2}s` }}
                                        />
                                    ))}
                                </div>
                                Mentor is thinking…
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div
                        className="flex items-center gap-3 border-t border-border bg-muted/20 p-4"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                            placeholder="Ask about architecture, patterns, bugs…"
                            className="flex-1 rounded-xl border border-border bg-background/50 px-4 py-2.5 font-mono text-xs text-foreground outline-none ring-primary/20 transition-all focus:border-primary/50 focus:ring-1"
                        />
                        <Button
                            onClick={sendMessage}
                            disabled={!input.trim() || isChatLoading}
                            size="icon"
                            className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all hover:scale-105 active:scale-95"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="flex flex-col gap-6">

                    {/* Quest Card */}
                    {/* <div
                        className="rounded-2xl border border-warning/30 bg-warning/5 p-5 backdrop-blur-sm shadow-[inset_0_0_40px_rgba(var(--warning),0.05)]"
                    >
                        <div className="mb-4 flex items-center gap-2">
                            <Sword className="h-5 w-5 text-warning" />
                            <span className="font-mono text-sm font-black uppercase tracking-widest text-warning">Daily Quest</span>
                            {quest && (
                                <Badge
                                    variant="outline"
                                    className="ml-auto border-warning/40 bg-warning/10 font-mono text-[10px] font-bold text-warning"
                                >
                                    +{quest.xp_reward} XP
                                </Badge>
                            )}
                        </div>

                        {questLoading ? (
                            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Fetching quest from SonarQube…
                            </div>
                        ) : quest ? (
                            <div className="space-y-4">
                                <div>
                                    <div className="mb-1 font-mono text-sm font-black text-warning uppercase">{quest.title}</div>
                                    <p className="font-mono text-[11px] leading-relaxed text-muted-foreground opacity-80">
                                        {quest.issue_description}
                                    </p>
                                </div>
                                <div
                                    className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 font-mono text-[10px] text-muted-foreground"
                                >
                                    <Terminal className="h-3.5 w-3.5 opacity-60" />
                                    {quest.file_path}
                                </div>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="w-full h-10 gap-2 border-warning/40 font-mono text-[10px] font-black uppercase tracking-widest text-warning hover:bg-warning/10"
                                >
                                    <a
                                        href={quest.sonar_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Fix on SonarQube <Send className="h-3 w-3" />
                                    </a>
                                </Button>
                            </div>
                        ) : (
                            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">No quest available.</div>
                        )}
                    </div> */}

                    {/* Onboarding Checklist */}
                    <div className="flex flex-1 flex-col rounded-2xl border border-border bg-card/30 p-5 backdrop-blur-md">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ScrollText className="h-5 w-5 text-primary" />
                                <span className="font-mono text-sm font-black uppercase tracking-widest text-foreground">Onboarding</span>
                            </div>
                            {!onboardingLoading && (
                                <span className="font-mono text-[10px] font-black text-primary">
                                    {checkedIds.size}/{onboarding.length} COMPLETE
                                </span>
                            )}
                        </div>
                        {onboardingLoading ? (
                            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground opacity-60">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading checklist…
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {onboarding.map((step) => {
                                    const done = checkedIds.has(step.id)
                                    return (
                                        <div
                                            key={step.id}
                                            onClick={() => toggleCheck(step.id)}
                                            className={`group relative cursor-pointer overflow-hidden rounded-xl border p-3.5 transition-all duration-300 ${done
                                                    ? "border-success/30 bg-success/5 opacity-80"
                                                    : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all duration-300 ${done
                                                            ? "border-success bg-success text-success-foreground"
                                                            : "border-muted-foreground/30 bg-background"
                                                        }`}
                                                >
                                                    {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                </div>
                                                <span
                                                    className={`font-mono text-xs font-bold leading-none ${done ? "text-success/70 line-through" : "text-foreground"
                                                        }`}
                                                >
                                                    {step.task}
                                                </span>
                                            </div>
                                            {!done && (
                                                <div className="mt-2.5 pl-8 font-mono text-[10px] leading-relaxed text-muted-foreground opacity-70 transition-all duration-300 group-hover:opacity-100">
                                                    {step.description}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* ── Keyframe styles ── */}
            <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(var(--primary), 0.2); border-radius: 4px; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
        </div>
    )
}
