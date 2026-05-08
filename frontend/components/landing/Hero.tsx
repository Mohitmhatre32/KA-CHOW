"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllRepos } from "@/lib/repo-store";
import { Marquee } from "./Marquee";

interface HeroProps {
    scrollProgress: number;
}

export const Hero = ({ scrollProgress }: HeroProps) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [hasRepos, setHasRepos] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), 100);
        setHasRepos(getAllRepos().length > 0);
        return () => clearTimeout(timer);
    }, []);

    const heroOpacity = Math.max(0, 1 - scrollProgress * 1.5);
    const heroTransform = `translateY(${-scrollProgress * 15}vh)`;

    return (
        <section
            className="relative min-h-screen flex flex-col items-center justify-center pt-24 overflow-hidden z-10 bg-background"
            style={{ opacity: heroOpacity, transform: heroTransform }}
        >
            {/* Massive Brutalist Background Typography */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full text-center pointer-events-none opacity-5">
                <h1 className="text-[20vw] font-black leading-none tracking-tighter mix-blend-overlay">KA-CHOW</h1>
            </div>

            <div className="w-full max-w-7xl mx-auto px-6 space-y-12 relative z-10">
                {/* Harsh Neo-Brutalist Block Header */}
                <div
                    className={`transition-all duration-700 ease-out flex flex-col items-center gap-6 ${isVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-12 opacity-0"
                        }`}
                >
                    <div className="bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-widest px-4 py-2 border-2 border-border shadow-[var(--shadow-brutal)] transform -skew-x-6">
                        <span className="flex items-center gap-2 skew-x-6">
                            <Zap className="h-4 w-4" />
                            v1.0.0 Neo-Alpha
                        </span>
                    </div>
                    
                    <h1 className="text-7xl md:text-[8rem] font-bold tracking-tighter leading-[0.85] text-center drop-shadow-[var(--shadow-brutal-secondary)]">
                        THE AUTONOMOUS<br/>
                        <span className="text-primary drop-shadow-[var(--shadow-brutal)]">ENGINEERING BRAIN</span>
                    </h1>
                </div>

                {/* Subtitle Box */}
                <div
                    className={`transition-all duration-700 delay-150 ease-out flex justify-center ${isVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-8 opacity-0"
                        }`}
                >
                    <div className="bg-card border-4 border-border p-6 shadow-[var(--shadow-brutal-sm)] max-w-3xl">
                        <p className="text-xl md:text-2xl font-medium text-foreground text-center uppercase tracking-tight">
                            Understand your system like a Staff Engineer. Intelligent repository analysis and collaboration powered by AI.
                        </p>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div
                    className={`transition-all duration-700 delay-300 ease-out flex flex-col md:flex-row gap-6 justify-center mt-12 ${isVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-8 opacity-0"
                        }`}
                >
                    {hasRepos ? (
                        <>
                            <Button size="lg" onClick={() => router.push("/repositories")}>
                                <LayoutGrid className="mr-2 h-5 w-5" /> YOUR REPOSITORIES
                            </Button>
                            <Button variant="secondary" size="lg" onClick={() => router.push("/import-repository")}>
                                IMPORT NEW REPO <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button size="lg" onClick={() => router.push("/import-repository")}>
                                GET STARTED <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                            <Button variant="secondary" size="lg" onClick={() => {
                                document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
                            }}>
                                LEARN MORE
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Brutalist Marquee Banner at bottom of hero */}
            <div className="absolute bottom-0 left-0 w-full rotate-2 origin-bottom-left -translate-y-12 z-20">
                <Marquee className="py-4 bg-primary text-primary-foreground border-y-4 border-border font-bold text-2xl tracking-widest uppercase">
                    <span className="flex items-center gap-8 mx-8">
                        <Zap className="h-6 w-6" /> NO MORE TECH DEBT
                        <Zap className="h-6 w-6" /> GRAPH BASED KNOWLEDGE
                        <Zap className="h-6 w-6" /> AUTO SELF HEALING
                        <Zap className="h-6 w-6" /> ARCHITECTURE VISUALIZATION
                    </span>
                </Marquee>
            </div>
            <div className="absolute bottom-0 left-0 w-full -rotate-2 origin-bottom-right -translate-y-12 z-10">
                <Marquee direction="right" className="py-4 bg-secondary text-secondary-foreground border-y-4 border-border font-bold text-2xl tracking-widest uppercase">
                    <span className="flex items-center gap-8 mx-8">
                        <Zap className="h-6 w-6" /> AI POWERED INSIGHTS
                        <Zap className="h-6 w-6" /> DETERMINISTIC AST PARSING
                        <Zap className="h-6 w-6" /> LOCAL VECTOR STORE
                        <Zap className="h-6 w-6" /> CONTINUOUS INGESTION
                    </span>
                </Marquee>
            </div>
        </section>
    );
};
