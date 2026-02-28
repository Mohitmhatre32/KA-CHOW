"use client"

import { useState, useEffect, useRef } from "react"
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

// ─── Commit Type Config ───────────────────────────────────────────────────────
const COMMIT_TYPE: Record<string, { color: string; bg: string; label: string }> = {
    feat: { color: "#a78bfa", bg: "rgba(167,139,250,0.15)", label: "feat" },
    fix: { color: "#f87171", bg: "rgba(248,113,113,0.15)", label: "fix" },
    chore: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", label: "chore" },
    docs: { color: "#38bdf8", bg: "rgba(56,189,248,0.15)", label: "docs" },
    refactor: { color: "#fb923c", bg: "rgba(251,146,60,0.15)", label: "refactor" },
    test: { color: "#4ade80", bg: "rgba(74,222,128,0.15)", label: "test" },
    other: { color: "#e2e8f0", bg: "rgba(226,232,240,0.10)", label: "other" },
}

const ROLES = ["Backend", "Frontend", "SRE"]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SonarBadge({ stats }: { stats: Record<string, unknown> }) {
    const gate = (stats.quality_gate as string) || "N/A"
    const isOk = gate === "OK" || gate === "PASSED"
    return (
        <span
            style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 99,
                background: isOk ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.18)",
                color: isOk ? "#4ade80" : "#f87171",
                border: `1px solid ${isOk ? "#4ade804d" : "#f871714d"}`,
                letterSpacing: "0.04em",
            }}
        >
            ⬤ {isOk ? "SONAR OK" : `SONAR ${gate}`}
        </span>
    )
}

function ChatMessage({ role, content }: { role: "user" | "ai"; content: string }) {
    const isUser = role === "user"
    return (
        <div
            style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                marginBottom: 12,
            }}
        >
            {!isUser && (
                <div
                    style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--primary), var(--accent))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, marginRight: 8, flexShrink: 0, marginTop: 2,
                    }}
                >
                    🤖
                </div>
            )}
            <div
                style={{
                    maxWidth: "82%",
                    padding: "10px 14px",
                    borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
                    background: isUser
                        ? "linear-gradient(135deg, var(--primary), var(--accent))"
                        : "var(--card)",
                    border: isUser ? "none" : "1px solid var(--border)",
                    color: "var(--foreground)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                }}
            >
                {content}
            </div>
        </div>
    )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function MentorDashboard() {
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
        background: "var(--card)",
        backdropFilter: "blur(18px)",
        border: "1px solid var(--border)",
        borderRadius: 16,
    }
    const neonBorder: React.CSSProperties = {
        border: "1px solid var(--border)",
        boxShadow: "0 0 18px rgba(88,166,255,0.05)",
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--background)",
                fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
                color: "var(--foreground)",
                padding: "24px",
                boxSizing: "border-box",
            }}
        >
            {/* ── Header ── */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: "linear-gradient(135deg, var(--primary), var(--accent))",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 20, boxShadow: "0 0 20px rgba(88,166,255,0.2)",
                        }}
                    >
                        🧠
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                            DevInsight UI{" "}
                            <span style={{ background: "linear-gradient(90deg, var(--primary), var(--accent))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                Mentor
                            </span>
                        </h1>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted-foreground)" }}>
                            AI-Powered Developer Onboarding &amp; Code Intelligence
                        </p>
                    </div>

                    {/* Role selector in header */}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                        {ROLES.map((r) => (
                            <button
                                key={r}
                                onClick={() => setRole(r)}
                                style={{
                                    padding: "6px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                                    cursor: "pointer", transition: "all 0.2s",
                                    background: role === r ? "var(--primary)" : "var(--card)",
                                    border: role === r ? "1px solid var(--primary)" : "1px solid var(--border)",
                                    color: role === r ? "var(--primary-foreground)" : "var(--muted-foreground)",
                                    boxShadow: role === r ? "0 0 14px rgba(88,166,255,0.25)" : "none",
                                }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main Grid (Chat | Quest + Onboarding) ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 20 }}>

                {/* ── LEFT: Chat ── */}
                <div style={{ ...glass, ...neonBorder, display: "flex", flexDirection: "column", height: 560 }}>
                    {/* Chat header */}
                    <div
                        style={{
                            padding: "14px 18px", borderBottom: "1px solid var(--border)",
                            display: "flex", alignItems: "center", gap: 10,
                        }}
                    >
                        <div
                            style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: "var(--success)",
                                boxShadow: "0 0 8px var(--success)",
                                animation: "pulse 2s infinite",
                            }}
                        />
                        <span style={{ fontWeight: 700, fontSize: 14 }}>Mentor AI</span>
                        <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>· {role} Mode</span>
                        <div style={{ marginLeft: "auto" }}>
                            <SonarBadge stats={sonarStats} />
                        </div>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
                        {messages.map((m, i) => (
                            <ChatMessage key={i} role={m.role} content={m.content} />
                        ))}
                        {isChatLoading && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted-foreground)", fontSize: 13 }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                    {[0, 1, 2].map((i) => (
                                        <div
                                            key={i}
                                            style={{
                                                width: 6, height: 6, borderRadius: "50%",
                                                background: "var(--primary)",
                                                animation: `bounce 1.2s ${i * 0.2}s infinite`,
                                            }}
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
                        style={{
                            padding: "12px 16px", borderTop: "1px solid var(--border)",
                            display: "flex", gap: 10,
                        }}
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                            placeholder="Ask about architecture, patterns, bugs…"
                            style={{
                                flex: 1, padding: "10px 14px", borderRadius: 10,
                                background: "var(--input)",
                                border: "1px solid var(--border)",
                                color: "var(--foreground)", fontSize: 13, outline: "none",
                            }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!input.trim() || isChatLoading}
                            style={{
                                padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13,
                                background: input.trim() && !isChatLoading
                                    ? "var(--primary)"
                                    : "var(--card)",
                                border: "none", color: "var(--primary-foreground)", cursor: "pointer",
                                transition: "all 0.2s",
                                boxShadow: input.trim() && !isChatLoading ? "0 0 14px rgba(88,166,255,0.4)" : "none",
                            }}
                        >
                            ➤
                        </button>
                    </div>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Quest Card */}
                    <div
                        style={{
                            ...glass,
                            border: "1px solid rgba(251,146,60,0.3)",
                            boxShadow: "0 0 20px rgba(251,146,60,0.08)",
                            padding: "18px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                            <span style={{ fontSize: 18 }}>⚔️</span>
                            <span style={{ fontWeight: 800, fontSize: 14 }}>Daily Quest</span>
                            {quest && (
                                <span
                                    style={{
                                        marginLeft: "auto", padding: "3px 10px", borderRadius: 99, fontSize: 11,
                                        fontWeight: 700, background: "rgba(251,146,60,0.15)",
                                        border: "1px solid rgba(251,146,60,0.35)", color: "#fb923c",
                                    }}
                                >
                                    +{quest.xp_reward} XP
                                </span>
                            )}
                        </div>

                        {questLoading ? (
                            <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>⏳ Fetching quest from SonarQube…</div>
                        ) : quest ? (
                            <>
                                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: "var(--warning)" }}>
                                    {quest.title}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 10, lineHeight: 1.6 }}>
                                    {quest.issue_description}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11, color: "var(--muted-foreground)", padding: "5px 10px",
                                        background: "var(--input)", borderRadius: 6, marginBottom: 12,
                                        fontFamily: "monospace",
                                    }}
                                >
                                    📁 {quest.file_path}
                                </div>
                                <a
                                    href={quest.sonar_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                                        background: "linear-gradient(135deg,#f97316,#dc2626)",
                                        color: "#fff", textDecoration: "none",
                                        boxShadow: "0 0 14px rgba(249,115,22,0.3)",
                                    }}
                                >
                                    Fix on SonarQube ↗
                                </a>
                            </>
                        ) : (
                            <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>No quest available.</div>
                        )}
                    </div>

                    {/* Onboarding Checklist */}
                    <div style={{ ...glass, ...neonBorder, padding: 18, flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                            <span>📋</span> Onboarding — {role}
                            {!onboardingLoading && (
                                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>
                                    {checkedIds.size}/{onboarding.length} done
                                </span>
                            )}
                        </div>
                        {onboardingLoading ? (
                            <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Loading checklist…</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {onboarding.map((step) => {
                                    const done = checkedIds.has(step.id)
                                    return (
                                        <div
                                            key={step.id}
                                            onClick={() => toggleCheck(step.id)}
                                            style={{
                                                padding: "10px 12px", borderRadius: 10,
                                                background: done ? "rgba(88,166,255,0.1)" : "var(--card)",
                                                border: done ? "1px solid rgba(88,166,255,0.3)" : "1px solid var(--border)",
                                                cursor: "pointer", transition: "all 0.2s",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div
                                                    style={{
                                                        width: 16, height: 16, borderRadius: 4,
                                                        border: done ? "none" : "1px solid var(--border)",
                                                        background: done ? "var(--primary)" : "transparent",
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        fontSize: 10, flexShrink: 0,
                                                    }}
                                                >
                                                    {done && "✓"}
                                                </div>
                                                <span
                                                    style={{
                                                        fontSize: 13, fontWeight: 600,
                                                        color: done ? "var(--primary)" : "var(--foreground)",
                                                        textDecoration: done ? "line-through" : "none",
                                                    }}
                                                >
                                                    {step.task}
                                                </span>
                                            </div>
                                            {!done && (
                                                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginLeft: 24, marginTop: 4, lineHeight: 1.5 }}>
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

            {/* ── BOTTOM: Architecture Timeline ── */}
            <div style={{ ...glass, ...neonBorder, padding: "18px 20px" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🕰️</span> Architecture Time Machine
                    <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted-foreground)", marginLeft: 6 }}>Last 15 commits</span>
                    {selectedCommit && (
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted-foreground)" }}>
                            <span style={{ fontFamily: "monospace", color: "var(--primary)" }}>{selectedCommit.sha}</span>
                            {" · "}
                            {selectedCommit.date}
                            {" · "}
                            <span style={{ color: "var(--muted-foreground)" }}>{selectedCommit.author}</span>
                        </div>
                    )}
                </div>

                {/* Selected commit banner */}
                {selectedCommit && (
                    <div
                        style={{
                            padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                            background: "rgba(88,166,255,0.08)", border: "1px solid rgba(88,166,255,0.2)",
                            fontSize: 13, color: "var(--foreground)",
                        }}
                    >
                        💬 {selectedCommit.message}
                    </div>
                )}

                {/* Horizontal commit strip */}
                {timelineLoading ? (
                    <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>⏳ Loading timeline…</div>
                ) : (
                    <div
                        style={{
                            display: "flex", gap: 10, overflowX: "auto",
                            paddingBottom: 8,
                            scrollbarWidth: "thin",
                            scrollbarColor: "var(--primary) transparent",
                        }}
                    >
                        {timeline.map((evt, idx) => {
                            const cfg = COMMIT_TYPE[evt.type] ?? COMMIT_TYPE.other
                            const isActive = selectedCommit?.sha === evt.sha
                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedCommit(evt)}
                                    style={{
                                        flexShrink: 0, width: 170, padding: "10px 12px", borderRadius: 12,
                                        cursor: "pointer", transition: "all 0.2s",
                                        background: isActive ? `${cfg.bg}` : "rgba(255,255,255,0.03)",
                                        border: isActive ? `1px solid ${cfg.color}60` : "1px solid rgba(255,255,255,0.06)",
                                        boxShadow: isActive ? `0 0 14px ${cfg.color}30` : "none",
                                    }}
                                >
                                    {/* Type badge */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                                        <span
                                            style={{
                                                fontSize: 10, fontWeight: 700, padding: "2px 7px",
                                                borderRadius: 99, background: cfg.bg,
                                                border: `1px solid ${cfg.color}50`, color: cfg.color,
                                                letterSpacing: "0.05em",
                                            }}
                                        >
                                            {cfg.label}
                                        </span>
                                        <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)" }}>
                                            {evt.sha}
                                        </span>
                                    </div>

                                    {/* Message */}
                                    <div
                                        style={{
                                            fontSize: 11, color: "var(--foreground)", lineHeight: 1.4,
                                            overflow: "hidden", display: "-webkit-box",
                                            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                            marginBottom: 6,
                                        }}
                                    >
                                        {evt.message}
                                    </div>

                                    {/* Meta */}
                                    <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{evt.date}</div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Keyframe styles ── */}
            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(88,166,255,0.4); border-radius: 4px; }
        input::placeholder { color: var(--muted-foreground); }
      `}</style>
        </div>
    )
}
