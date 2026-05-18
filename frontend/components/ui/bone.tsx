"use client"

/**
 * bone.tsx — Neo-Brutalist Skeleton System
 *
 * Built on top of boneyard-js (renderBones / computeLayout).
 * Exports:
 *   <Bone>               — atomic building block
 *   <SkeletonText>       — one or more text-line placeholders
 *   <SkeletonImage>      — image / avatar placeholder
 *   <SkeletonButton>     — button placeholder
 *   <SkeletonList>       — list of row placeholders
 *   <SkeletonCard>       — generic card layout
 *   <SkeletonRepoCard>   — matches the RepoCard layout exactly
 *   <SkeletonStats>      — stat pill row
 *   <SkeletonSidebar>    — sidebar agent tab list
 *   <SkeletonDashboardLoader> — full-screen initial load screen
 *
 * Neo-brutalism rules:
 *   • 2px solid border  (zinc-600 on dark bg)
 *   • 0px border-radius (sharp corners, always)
 *   • Hard offset shadow: 3–5px black
 *   • High contrast fill: zinc-800
 *   • Animation: fast "stamp" pulse — no shimmer, no soft easing
 */

import React from "react"
// Pull computeLayout from boneyard-js for advanced consumers
import { computeLayout } from "boneyard-js"

// ─── Design tokens ────────────────────────────────────────────────────────────
const BB = "#27272a"   // zinc-800 — bone fill
const BL = "#52525b"   // zinc-600 — bone border
const SH = "3px 3px 0 #000"  // hard shadow

// ─── Bone — atomic primitive ─────────────────────────────────────────────────
export interface BoneProps {
  width?: string | number
  height?: string | number
  className?: string
  style?: React.CSSProperties
  animate?: "stamp" | "tick" | "none"
  delay?: number
  rounded?: boolean
}

export function Bone({
  width = "100%",
  height = 14,
  className = "",
  style,
  animate = "stamp",
  delay = 0,
  rounded = false,
}: BoneProps) {
  const animClass = animate === "stamp" ? "bone-stamp" : animate === "tick" ? "bone-tick" : ""
  return (
    <div
      className={`${animClass} ${className}`}
      style={{
        display: "block",
        width,
        height,
        background: BB,
        border: `2px solid ${BL}`,
        borderRadius: rounded ? "9999px" : "0px",
        boxShadow: SH,
        animationDelay: `${delay}ms`,
        flexShrink: 0,
        ...style,
      }}
      aria-hidden="true"
    />
  )
}

// ─── SkeletonText ─────────────────────────────────────────────────────────────
export function SkeletonText({
  lines = 3,
  widths,
  height = 12,
  gap = 8,
  className = "",
}: {
  lines?: number
  widths?: (string | number)[]
  height?: number
  gap?: number
  className?: string
}) {
  const dw = ["100%", "85%", "60%", "75%", "90%", "50%"]
  return (
    <div className={`flex flex-col ${className}`} style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Bone key={i} height={height} width={widths?.[i] ?? dw[i % dw.length]} delay={i * 60} />
      ))}
    </div>
  )
}

// ─── SkeletonImage ────────────────────────────────────────────────────────────
export function SkeletonImage({
  width = "100%",
  height = 160,
  rounded = false,
  className = "",
}: {
  width?: string | number
  height?: string | number
  rounded?: boolean
  className?: string
}) {
  return <Bone width={width} height={height} rounded={rounded} className={className} />
}

// ─── SkeletonButton ───────────────────────────────────────────────────────────
export function SkeletonButton({
  width = 120,
  height = 36,
  className = "",
}: {
  width?: string | number
  height?: number
  className?: string
}) {
  return (
    <Bone
      width={width}
      height={height}
      className={className}
      style={{ border: `2px solid ${BL}`, boxShadow: "4px 4px 0 #000" }}
    />
  )
}

// ─── SkeletonList ─────────────────────────────────────────────────────────────
export function SkeletonList({
  rows = 5,
  showAvatar = false,
  className = "",
}: {
  rows?: number
  showAvatar?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-2"
          style={{ border: `2px solid ${BL}`, boxShadow: "2px 2px 0 #000", background: "#18181b" }}
        >
          {showAvatar && <Bone width={32} height={32} delay={i * 50} />}
          <div className="flex flex-1 flex-col gap-1.5">
            <Bone height={11} width={`${55 + (i % 3) * 15}%`} delay={i * 50} />
            <Bone height={9}  width={`${40 + (i % 4) * 10}%`} delay={i * 50 + 30} />
          </div>
          <Bone width={48} height={24} delay={i * 50 + 60} />
        </div>
      ))}
    </div>
  )
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────
export function SkeletonCard({
  showImage = false,
  imageHeight = 140,
  lines = 3,
  showButton = true,
  className = "",
}: {
  showImage?: boolean
  imageHeight?: number
  lines?: number
  showButton?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-col gap-4 p-5 ${className}`}
      style={{ border: `2px solid ${BL}`, boxShadow: "4px 4px 0 #000", background: "#18181b", borderRadius: 0 }}
      aria-hidden="true"
    >
      {showImage && <SkeletonImage height={imageHeight} />}
      <div className="flex items-center gap-3">
        <Bone width={36} height={36} />
        <div className="flex flex-1 flex-col gap-1.5">
          <Bone height={12} width="60%" />
          <Bone height={9}  width="80%" delay={40} />
        </div>
      </div>
      <SkeletonText lines={lines} />
      <Bone height={4} width="100%" delay={80} style={{ boxShadow: "2px 2px 0 #000" }} />
      {showButton && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Bone width={56} height={20} delay={100} />
            <Bone width={56} height={20} delay={130} />
          </div>
          <SkeletonButton width={90} height={28} />
        </div>
      )}
    </div>
  )
}

// ─── SkeletonRepoCard — pixel-matched to the real RepoCard layout ─────────────
export function SkeletonRepoCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="flex flex-col gap-4 p-5"
      style={{
        border: `2px solid ${BL}`,
        boxShadow: "4px 4px 0 #000",
        background: "#18181b",
        borderRadius: 0,
        minHeight: 160,
      }}
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Bone width={36} height={36} delay={delay} />
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <Bone height={13} width="65%" delay={delay + 40} />
            <Bone height={9}  width="85%" delay={delay + 70} />
          </div>
        </div>
        <Bone width={28} height={28} delay={delay + 90} style={{ opacity: 0.35 }} />
      </div>
      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Bone width={8}  height={8}  rounded delay={delay + 100} />
          <Bone width={68} height={9}  delay={delay + 110} />
        </div>
        <div className="flex items-center gap-1.5">
          <Bone width={12} height={9}  delay={delay + 120} />
          <Bone width={48} height={9}  delay={delay + 130} />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <Bone width={12} height={9}  delay={delay + 140} />
          <Bone width={40} height={9}  delay={delay + 150} />
        </div>
      </div>
      {/* Health bar */}
      <Bone height={4} width="100%" delay={delay + 160} style={{ boxShadow: "2px 2px 0 #000" }} />
      {/* CTA */}
      <div className="flex justify-end">
        <Bone width={110} height={11} delay={delay + 180} />
      </div>
    </div>
  )
}

// ─── SkeletonStats ────────────────────────────────────────────────────────────
export function SkeletonStats({ count = 4, className = "" }: { count?: number; className?: string }) {
  const ws = [72, 88, 64, 96, 80]
  return (
    <div className={`flex flex-wrap gap-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} width={ws[i % ws.length]} height={26} delay={i * 60}
          style={{ boxShadow: "2px 2px 0 #000" }} />
      ))}
    </div>
  )
}

// ─── SkeletonSidebar ──────────────────────────────────────────────────────────
export function SkeletonSidebar({ tabs = 5 }: { tabs?: number }) {
  return (
    <div className="flex flex-col gap-1 p-2" aria-hidden="true">
      {Array.from({ length: tabs }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 py-2"
          style={{ border: `2px solid ${BL}`, boxShadow: "2px 2px 0 #000", background: "#18181b" }}>
          <Bone width={24} height={24} delay={i * 60} />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bone height={10} width={`${50 + (i % 3) * 15}%`} delay={i * 60 + 30} />
            <Bone height={8}  width={`${40 + (i % 4) * 12}%`} delay={i * 60 + 50} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SkeletonDashboardLoader — full-screen initial load ───────────────────────
export function SkeletonDashboardLoader() {
  return (
    <div className="flex h-screen flex-col bg-[#09090b]" role="status" aria-label="Loading dashboard">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4"
        style={{ borderBottom: `2px solid ${BL}` }}>
        <div className="flex items-center gap-4">
          <Bone width={32} height={32} />
          <Bone width={80} height={14} delay={40} />
          <Bone width={1}  height={24} style={{ opacity: 0.3 }} />
          <Bone width={220} height={32} delay={60} />
          <Bone width={80}  height={32} delay={80} />
          <Bone width={90}  height={14} delay={100} />
        </div>
        <div className="flex items-center gap-2">
          <Bone width={32} height={32} delay={120} />
          <Bone width={80} height={32} delay={140} />
          <Bone width={80} height={32} delay={160} />
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex w-[18%] min-w-[180px] flex-col" style={{ borderRight: `2px solid ${BL}` }}>
          <div className="flex h-10 items-center px-4" style={{ borderBottom: `2px solid ${BL}` }}>
            <Bone width="60%" height={10} />
          </div>
          <SkeletonSidebar tabs={5} />
        </div>
        {/* Canvas */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-6">
            <div className="bone-stamp flex items-center justify-center"
              style={{ width: 72, height: 72, background: BB, border: `3px solid ${BL}`, boxShadow: "5px 5px 0 #000" }}>
              <span style={{ fontSize: 32 }}>⚡</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Bone width={180} height={14} />
              <Bone width={120} height={10} delay={80} />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bone-tick"
                  style={{ width: 10, height: 10, background: BL, border: `2px solid ${BL}`, borderRadius: 0, animationDelay: `${i * 140}ms` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Re-export boneyard-js utility for advanced consumers
export { computeLayout }
