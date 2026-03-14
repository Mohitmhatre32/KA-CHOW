"use client"

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Code2, Zap, Brain, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FeaturesProps {
    scrollProgress: number;
}

export const Features = ({ scrollProgress }: FeaturesProps) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);
    const featuresRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollProgress > 0.3) {
            setIsVisible(true);
        }
    }, [scrollProgress]);

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
                <div className="text-center mb-16 space-y-4">
                    <div className="flex justify-center">
                        <span className="badge">
                            Features
                        </span>
                    </div>

                    <h2 className="text-4xl md:text-5xl tracking-tight font-medium text-foreground">
                        Engineering Intelligence
                    </h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Transform how you understand and build software with AI-powered insights. Deeply integrated tools for the modern developer.
                    </p>
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
                                className={`group relative rounded-xl p-8 border bg-card/50 transition-all duration-400
                                ${hoveredCard === index ? "border-primary/50 bg-primary/[0.02]" : "border-border"}`}
                                style={{
                                    opacity: featureOpacity,
                                    transform: `translateY(${(1 - featureOpacity) * 20}px)`,
                                    transitionDelay: `${index * 100}ms`,
                                }}
                            >
                                <div
                                    className={`relative w-12 h-12 rounded-lg border flex items-center justify-center mb-6 transition-all duration-300
                                    ${hoveredCard === index ? "border-primary bg-primary/20" : "border-border bg-muted/30"}`}
                                >
                                    <Icon
                                        className="w-7 h-7 transition-transform duration-300 group-hover:scale-125"
                                        style={{ color: "var(--primary)" }}
                                    />
                                </div>

                                <h3
                                    className="text-2xl font-semibold mb-3 transition-all duration-300"
                                    style={{ color: hoveredCard === index ? "var(--primary)" : "var(--foreground)" }}
                                >
                                    {feature.title}
                                </h3>

                                <p className="leading-relaxed transition-colors duration-300"
                                    style={{ color: hoveredCard === index ? "var(--secondary-foreground)" : "var(--muted-foreground)" }}
                                >
                                    {feature.description}
                                </p>

                                <div className="mt-6 pt-6 border-t opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ borderColor: "rgba(255,255,255,0.08)" }}
                                >
                                    <span
                                        className="inline-flex items-center gap-2 font-medium hover:gap-3 transition-all duration-300 cursor-pointer"
                                        style={{ color: "var(--primary)" }}
                                    >
                                        Learn more
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom CTA */}
                <div className="text-center">
                    <Button
                        size="lg"
                        className={`h-14 px-10 text-lg transition-all duration-500
                        ${scrollProgress > 0.7 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                        onClick={() => router.push("/import-repository")}
                        style={{ pointerEvents: scrollProgress > 0.7 ? "auto" : "none" }}
                    >
                        Launch Now
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Background glow orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[150px] opacity-5 animate-pulse"
                    style={{ background: "var(--primary)" }}
                />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[150px] opacity-5 animate-pulse"
                    style={{ background: "var(--primary)", animationDelay: "1s" }}
                />
                <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-[0.03]" />
            </div>
        </section>
    );
};
