"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

interface HeroProps {
    scrollProgress: number;
}

export const Hero = ({ scrollProgress }: HeroProps) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    const heroOpacity = Math.max(0, 1 - scrollProgress * 1.5);
    const heroTransform = `translateY(${-scrollProgress * 30}vh)`;

    return (
        <section
            className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
            style={{
                opacity: heroOpacity,
                transform: heroTransform,
                zIndex: 2,
            }}
        >
            <div className="max-w-5xl mx-auto text-center">
                {/* Title — KA-CHOW */}
                <div
                    className={`transition-all duration-1000 ease-out ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                >
                    <div className="relative mb-4">
                        <h1
                            className="text-7xl md:text-9xl font-bold text-transparent bg-clip-text tracking-tight leading-tight"
                            style={{
                                backgroundImage: "linear-gradient(to right, var(--foreground), var(--foreground), var(--primary))",
                                WebkitBackgroundClip: "text",
                            }}
                        >
                            KA-CHOW
                        </h1>
                        <div
                            className="absolute inset-0 blur-3xl -z-10"
                            style={{
                                background: "linear-gradient(to right, rgba(88,166,255,0.2), transparent, rgba(88,166,255,0.2))",
                            }}
                        />
                    </div>
                </div>

                {/* Subtitle */}
                <div
                    className={`transition-all duration-1000 ease-out ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                        transitionDelay: "200ms",
                    }}
                >
                    <h2
                        className="text-3xl md:text-5xl font-semibold bg-clip-text  mb-3 font-sans"
                        style={{
                            backgroundImage: "linear-gradient(to right, var(--foreground), var(--muted-foreground))",
                            WebkitBackgroundClip: "text",
                        }}
                    >
                        The Autonomous Engineering Brain
                    </h2>
                </div>

                {/* Description */}
                <div
                    className={`transition-all duration-1000 ease-out ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                        transitionDelay: "400ms",
                    }}
                >
                    <p
                        className="text-lg md:text-xl bg-clip-text mb-12"
                        style={{
                            backgroundImage: "linear-gradient(to right, var(--muted-foreground), #6b7280)",
                            WebkitBackgroundClip: "text",
                        }}
                    >
                        Understand your system like a Staff Engineer
                    </p>
                </div>

                {/* CTA Buttons */}
                <div
                    className={`transition-all duration-1000 ease-out ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{
                        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                        transitionDelay: "600ms",
                    }}
                >
                    <div className="flex flex-col md:flex-row gap-4 justify-center">
                        {/* Primary — Get Started */}
                        <button
                            onClick={() => router.push("/import-repository")}
                            onMouseEnter={() => setHoveredButton("primary")}
                            onMouseLeave={() => setHoveredButton(null)}
                            className="group relative px-8 py-4 text-white rounded-xl font-semibold text-lg
                         transition-all duration-300 ease-out
                         hover:scale-105 active:scale-95
                         inline-flex items-center gap-2 overflow-hidden"
                            style={{
                                background: "linear-gradient(135deg, var(--primary), #1f6feb)",
                                border: "1px solid rgba(88,166,255,0.5)",
                                boxShadow: hoveredButton === "primary"
                                    ? "0 0 40px rgba(88,166,255,0.5)"
                                    : "none",
                            }}
                        >
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                style={{
                                    background: "linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)",
                                    animation: hoveredButton === "primary" ? "shimmer 2s infinite" : "none",
                                }}
                            />
                            <span className="relative">Get Started</span>
                            <ArrowRight
                                className="w-5 h-5 relative transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110"
                            />
                        </button>

                        {/* Secondary — Learn More */}
                        <button
                            onClick={() => {
                                const el = document.getElementById("features-section");
                                el?.scrollIntoView({ behavior: "smooth" });
                            }}
                            onMouseEnter={() => setHoveredButton("secondary")}
                            onMouseLeave={() => setHoveredButton(null)}
                            className="group relative px-8 py-4 bg-transparent text-white rounded-xl font-semibold text-lg
                         transition-all duration-300 ease-out
                         hover:scale-105 active:scale-95
                         inline-flex items-center gap-2"
                            style={{
                                border: hoveredButton === "secondary"
                                    ? "1px solid var(--primary)"
                                    : "1px solid var(--border)",
                                boxShadow: hoveredButton === "secondary"
                                    ? "0 0 20px rgba(88,166,255,0.2)"
                                    : "none",
                            }}
                        >
                            <span className="relative">Learn More</span>
                            <svg
                                className="w-5 h-5 relative transition-all duration-300 group-hover:rotate-45"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Radial glow background */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(circle at 50% 50%, rgba(63, 185, 80, 0.08) 0%, transparent 70%)",
                    zIndex: -1,
                }}
            />

            <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
        </section>
    );
};
