"use client"

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Code2, Zap, Brain, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FeaturesProps {
    scrollProgress: number;
}

export const Features = ({ scrollProgress }: FeaturesProps) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);
    // Bug #3 fix: track whether the CTA button itself is visible, not a global scroll %
    const [ctaVisible, setCtaVisible] = useState(false);
    const ctaRef = useRef<HTMLDivElement>(null);
    const featuresRef = useRef<HTMLDivElement>(null);

    // Fade-in the whole section based on scroll progress (kept for the entrance animation)
    useEffect(() => {
        if (scrollProgress > 0.3) {
            setIsVisible(true);
        }
    }, [scrollProgress]);

    // Bug #3 fix: Use IntersectionObserver on the CTA container so the button
    // unlocks as soon as the user can actually see it, regardless of viewport height.
    useEffect(() => {
        const el = ctaRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setCtaVisible(true);
                }
            },
            {
                // Unlock when at least 40% of the CTA area is in the viewport
                threshold: 0.4,
            }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const opacity = scrollProgress > 0.3 ? Math.min(1, (scrollProgress - 0.3) / 0.3) : 0;
    const translateY = scrollProgress > 0.3 ? 0 : 50;

    const features = [
        {
            icon: Brain,
            title: "Autonomous Intelligence",
            description: "AI-powered analysis that understands your entire codebase architecture",
            gradient: "from-blue-500/20 to-cyan-500/20",
        },
        {
            icon: Code2,
            title: "Deep Code Insight",
            description: "Navigate complex systems with staff-level engineering comprehension",
            gradient: "from-purple-500/20 to-pink-500/20",
        },
        {
            icon: Zap,
            title: "Lightning Fast",
            description: "Instant analysis and recommendations powered by cutting-edge ML models",
            gradient: "from-yellow-500/20 to-orange-500/20",
        },
        {
            icon: Shield,
            title: "Enterprise Security",
            description: "Bank-level encryption and compliance for your most sensitive code",
            gradient: "from-emerald-500/20 to-teal-500/20",
        },
    ];

    return (
        <section
            id="features-section"
            ref={featuresRef}
            className="min-h-screen py-24 px-6 relative overflow-hidden bg-background"
            style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                transition: "opacity 400ms ease-out, transform 400ms ease-out",
            }}
        >
            <div className="max-w-7xl mx-auto relative z-10">
                {/* Section header */}
                <div className="text-center mb-24 space-y-6">
                    <div className="inline-block bg-secondary text-secondary-foreground border-4 border-border font-mono text-sm font-bold uppercase tracking-widest px-8 py-3 shadow-[var(--shadow-brutal-primary)] transform -rotate-2">
                        Features
                    </div>

                    <h2 className="text-6xl md:text-8xl tracking-tighter font-black text-foreground uppercase drop-shadow-[var(--shadow-brutal-secondary)]">
                        ENGINEERING<br/>INTELLIGENCE
                    </h2>
                    <div className="bg-card border-4 border-border p-4 shadow-[var(--shadow-brutal-sm)] max-w-2xl mx-auto transform translate-y-4 rotate-1">
                        <p className="text-xl font-medium text-foreground uppercase uppercase tracking-tight">
                            Transform how you understand and build software with AI-powered insights. Deeply integrated tools for the modern developer.
                        </p>
                    </div>
                </div>

                {/* Feature cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        const featureOpacity = isVisible
                            ? Math.min(1, Math.max(0, (scrollProgress - (0.4 + index * 0.05)) / 0.15))
                            : 0;

                        return (
                            <div
                                key={index}
                                onMouseEnter={() => setHoveredCard(index)}
                                onMouseLeave={() => setHoveredCard(null)}
                                className={`group relative p-8 border-4 transition-all duration-300
                                ${hoveredCard === index ? "bg-primary text-primary-foreground border-border shadow-none translate-y-[4px] translate-x-[4px]" : "bg-card text-card-foreground border-border shadow-[var(--shadow-brutal)]"}`}
                                style={{
                                    opacity: featureOpacity,
                                    transform: isVisible && hoveredCard !== index ? `translateY(0px)` : undefined,
                                    transitionDelay: `${index * 50}ms`,
                                }}
                            >
                                <div
                                    className={`relative w-16 h-16 border-2 flex items-center justify-center mb-6 transition-all duration-300
                                    ${hoveredCard === index ? "border-border bg-border" : "border-border bg-primary"}`}
                                >
                                    <Icon
                                        className="w-8 h-8 transition-transform duration-300 group-hover:scale-110"
                                        style={{ color: hoveredCard === index ? "var(--primary)" : "var(--primary-foreground)" }}
                                    />
                                </div>

                                <h3 className="text-3xl font-bold uppercase tracking-tight mb-4 border-b-4 border-transparent group-hover:border-border pb-2 inline-block">
                                    {feature.title}
                                </h3>

                                <p className="text-lg leading-snug font-medium opacity-90">
                                    {feature.description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom CTA — observed by IntersectionObserver, not global scroll % */}
                <div ref={ctaRef} className="text-center mt-24 flex flex-col items-center gap-4">
                    <Button
                        id="launch-now-btn"
                        size="lg"
                        variant="secondary"
                        className={`h-20 px-16 text-2xl font-black uppercase tracking-widest transition-all duration-500 border-4 border-border shadow-[var(--shadow-brutal-primary)] hover:bg-primary hover:text-primary-foreground
                        ${ctaVisible ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2 cursor-not-allowed"}`}
                        onClick={() => ctaVisible && router.push("/import-repository")}
                        aria-label={ctaVisible ? "Launch KA-CHOW" : "Scroll down to unlock"}
                        aria-disabled={!ctaVisible}
                    >
                        LAUNCH NOW
                        <ArrowRight className="ml-4 h-8 w-8" />
                    </Button>

                    {/* Scroll-to-unlock hint — only visible before CTA is in view */}
                    <div
                        className={`flex items-center gap-2 transition-all duration-500 ${ctaVisible ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                        aria-hidden={ctaVisible}
                    >
                        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                            ↓ Keep scrolling to unlock
                        </span>
                        <span
                            className="inline-block h-2 rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.round(Math.min(scrollProgress / 0.7, 1) * 64)}px`, minWidth: 8 }}
                        />
                    </div>
                </div>
            </div>

            {/* Background geometric forms */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 border-[16px] border-primary/20 rotate-45" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 border-[16px] border-secondary/20 rotate-12" />
                <div className="absolute top-1/2 right-1/3 w-80 h-80 border-[16px] border-accent/20 -rotate-12" />
            </div>
        </section>
    );
};
