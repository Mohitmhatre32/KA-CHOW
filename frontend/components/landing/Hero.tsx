"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAllRepos } from "@/lib/repo-store";

interface HeroProps {
    scrollProgress: number;
}

export const Hero = ({ scrollProgress }: HeroProps) => {
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);
    const [hoveredButton, setHoveredButton] = useState<string | null>(null);
    const [hasRepos, setHasRepos] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 300);
        setHasRepos(getAllRepos().length > 0);

        return () => clearTimeout(timer);
    }, []);

    const heroOpacity = Math.max(0, 1 - scrollProgress * 1.5);
    const heroTransform = `translateY(${-scrollProgress * 30}vh)`;

    return (
        <section
            className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden z-10"
            style={{
                opacity: heroOpacity,
                transform: heroTransform,
            }}
        >
            <div className="max-w-5xl mx-auto text-center space-y-8">
                {/* Title — KA-CHOW */}
                <div
                    className={`transition-all duration-1000 ease-out space-y-4 ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                >
                    <div className="flex justify-center">
                        <span className="badge">
                            <Zap className="mr-1 h-3 w-3 text-primary" />
                            v1.0.0 Alpha
                        </span>
                    </div>
                    
                    <h1 className="text-6xl md:text-8xl tracking-tighter">
                        KA-CHOW
                    </h1>
                </div>

                {/* Subtitle */}
                <div
                    className={`transition-all duration-1000 ease-out ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{ transitionDelay: "200ms" }}
                >
                    <h2 className="text-2xl md:text-4xl text-muted-foreground font-normal">
                        The Autonomous Engineering Brain
                    </h2>
                </div>

                {/* Description */}
                <div
                    className={`transition-all duration-1000 ease-out ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{ transitionDelay: "400ms" }}
                >
                    <p className="text-lg text-muted-foreground/80 max-w-2xl mx-auto">
                        Understand your system like a Staff Engineer. Intelligent repository analysis and collaboration powered by AI.
                    </p>
                </div>

                {/* CTA Buttons */}
                <div
                    className={`transition-all duration-1000 ease-out flex flex-col md:flex-row gap-4 justify-center ${isVisible
                        ? "opacity-100 scale-100 blur-0"
                        : "opacity-0 scale-85 blur-md"
                        }`}
                    style={{ transitionDelay: "600ms" }}
                >
                    {hasRepos ? (
                        <><Button
                            size="lg"
                            onClick={() => router.push("/repositories")}
                            className="h-12 px-8 text-md font-semibold"
                        >
                            <LayoutGrid className="mr-2 h-5 w-5" />
                            Your Repositories
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => router.push("/import-repository")}
                            className="h-12 px-8 text-md"
                        >
                            Import New Repo
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button></>
                    ) : (
                        <><Button
                            size="lg"
                            onClick={() => router.push("/import-repository")}
                            className="h-12 px-8 text-md font-semibold"
                        >
                            Get Started
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-12 px-8 text-md"
                            onClick={() => {
                                const el = document.getElementById("features-section");
                                el?.scrollIntoView({ behavior: "smooth" });
                            }}
                        >
                            Learn More
                        </Button></>
                    )}
                </div>
            </div>

            {/* Radial glow background - Standardized opacity */}
            <div className="absolute inset-0 pointer-events-none -z-10 opacity-20 bg-[radial-gradient(circle_at_50%_50%,rgba(88,166,255,0.1),transparent_70%)]" />

            <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
        </section>
    );
};
