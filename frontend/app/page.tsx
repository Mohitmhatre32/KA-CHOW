"use client"

import { useState, useEffect } from "react"
import { ParticleSystem } from "@/components/landing/ParticleSystem"
import { Hero } from "@/components/landing/Hero"
import { Features } from "@/components/landing/Features"
import { Footer } from "@/components/landing/Footer"

export default function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY
      const heroHeight = window.innerHeight
      const progress = Math.min(scrolled / heroHeight, 1)
      setScrollProgress(progress)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth"

    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.style.overflow = "hidden"
      } else {
        document.body.style.overflow = "auto"
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.documentElement.style.scrollBehavior = ""
    }
  }, [])

  return (
    <div className="relative">
      {/* Fixed gradient background */}
      <div
        className="fixed inset-0"
        style={{
          background: "linear-gradient(to bottom, var(--background), var(--background), #161b22)",
          zIndex: 0,
        }}
      />

      {/* Subtle noise overlay */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          zIndex: 3,
        }}
      />

      {/* Particle system */}
      <ParticleSystem scrollProgress={scrollProgress} />

      {/* Page sections */}
      <div className="relative">
        <Hero scrollProgress={scrollProgress} />
        <Features scrollProgress={scrollProgress} />
        <Footer />
      </div>
    </div>
  )
}
