"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    Bell,
    BellOff,
    X,
    CheckCheck,
    Trash2,
    ShieldAlert,
    Info,
    AlertTriangle,
    CheckCircle,
} from "lucide-react"
import { getAlerts, markAlertRead, markAllAlertsRead, clearAlerts, type Alert } from "@/lib/api"

// ── Severity config ────────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
    critical: {
        icon: ShieldAlert,
        dot: "bg-destructive",
        border: "border-destructive/30",
        bg: "bg-destructive/10",
        text: "text-destructive",
        badge: "bg-destructive/15 text-destructive border-destructive/30",
        label: "CRITICAL",
    },
    warning: {
        icon: AlertTriangle,
        dot: "bg-warning",
        border: "border-warning/30",
        bg: "bg-warning/10",
        text: "text-warning",
        badge: "bg-warning/15 text-warning border-warning/30",
        label: "WARNING",
    },
    success: {
        icon: CheckCircle,
        dot: "bg-success",
        border: "border-success/30",
        bg: "bg-success/10",
        text: "text-success",
        badge: "bg-success/15 text-success border-success/30",
        label: "SUCCESS",
    },
    info: {
        icon: Info,
        dot: "bg-primary",
        border: "border-primary/30",
        bg: "bg-primary/10",
        text: "text-primary",
        badge: "bg-primary/15 text-primary border-primary/30",
        label: "INFO",
    },
} as const

export function AlertsInbox() {
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [open, setOpen] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // ── Poll alerts every 5 seconds ──────────────────────────────────────────────
    const fetchAlerts = useCallback(async () => {
        try {
            const data = await getAlerts()
            setAlerts(data)
        } catch {
            // backend might not be up — silently ignore
        }
    }, [])

    useEffect(() => {
        fetchAlerts()
        intervalRef.current = setInterval(fetchAlerts, 5000)
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [fetchAlerts])

    // ── Close panel on outside click ──────────────────────────────────────────────
    useEffect(() => {
        if (!open) return
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [open])

    const unreadCount = alerts.filter((a) => !a.read).length

    const handleMarkRead = async (id: number) => {
        await markAlertRead(id)
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)))
    }

    const handleMarkAllRead = async () => {
        await markAllAlertsRead()
        setAlerts((prev) => prev.map((a) => ({ ...a, read: true })))
    }

    const handleClear = async () => {
        await clearAlerts()
        setAlerts([])
    }

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                onClick={() => setOpen((o) => !o)}
                title="Alerts Inbox"
                className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-all duration-200 ${open
                        ? "bg-destructive/15 text-destructive border border-destructive/30"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
            >
                {unreadCount > 0 ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 opacity-50" />}
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 font-mono text-[9px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div
                    className="absolute right-0 top-10 z-50 flex w-[380px] max-h-[520px] flex-col overflow-hidden rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono text-[10px] font-black uppercase tracking-widest text-foreground">Alerts Inbox</span>
                            {unreadCount > 0 && (
                                <span className="rounded-full border border-destructive/30 bg-destructive/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-destructive">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {alerts.length > 0 && (
                                <>
                                    <button
                                        onClick={handleMarkAllRead}
                                        title="Mark all as read"
                                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                                    >
                                        <CheckCheck className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        onClick={handleClear}
                                        title="Clear all"
                                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Alert list */}
                    <div className="flex-1 overflow-y-auto">
                        {alerts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                                <BellOff className="h-8 w-8 text-muted-foreground/30" />
                                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">No alerts yet</p>
                                <p className="max-w-[200px] font-mono text-[9px] leading-relaxed text-muted-foreground/40">
                                    Guardian and Librarian will push alerts here during scans
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border/40">
                                {alerts.map((alert) => {
                                    const cfg = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.info
                                    const Icon = cfg.icon
                                    return (
                                        <div
                                            key={alert.id}
                                            onClick={() => handleMarkRead(alert.id)}
                                            className={`group relative cursor-pointer px-4 py-3 transition-all duration-150 ${alert.read ? "opacity-50" : "hover:bg-zinc-800/30"
                                                }`}
                                        >
                                            {/* Unread indicator */}
                                            {!alert.read && (
                                                <span className={`absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                            )}

                                            <div className="flex items-start gap-3 pl-2">
                                                <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${cfg.border} ${cfg.bg}`}>
                                                    <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate font-mono text-[11px] font-bold text-foreground">
                                                            {alert.title}
                                                        </p>
                                                        <span className={`shrink-0 rounded border px-1 py-0.5 font-mono text-[8px] font-black uppercase ${cfg.badge}`}>
                                                            {cfg.label}
                                                        </span>
                                                    </div>
                                                    <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-muted-foreground/70">
                                                        {alert.message}
                                                    </p>
                                                    <p className="mt-1 font-mono text-[8px] text-muted-foreground/30">
                                                        {alert.timestamp}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    {alerts.length > 0 && (
                        <div className="shrink-0 border-t border-border/60 px-4 py-2 text-center">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                                Click an alert to mark as read · Auto-refreshes every 5s
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
