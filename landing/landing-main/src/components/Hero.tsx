import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroProps {
  scrollProgress: number;
}

export const Hero = ({ scrollProgress }: HeroProps) => {
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
        <div
          className={`transition-all duration-1000 ease-out ${
            isVisible
              ? 'opacity-100 scale-100 blur-0'
              : 'opacity-0 scale-85 blur-md'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div className="relative mb-4">
            <h1 className="text-7xl md:text-9xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-[#3fb950] tracking-tight leading-tight">
              KA-CHOW
            </h1>
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#3fb950]/20 via-transparent to-[#3fb950]/20 blur-3xl -z-10"
            />
          </div>
        </div>

        <div
          className={`transition-all duration-1000 ease-out delay-200 ${
            isVisible
              ? 'opacity-100 scale-100 blur-0'
              : 'opacity-0 scale-85 blur-md'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '200ms',
          }}
        >
          <h2 className="text-3xl md:text-5xl font-semibold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent mb-3">
            The Autonomous Engineering Brain
          </h2>
        </div>

        <div
          className={`transition-all duration-1000 ease-out delay-400 ${
            isVisible
              ? 'opacity-100 scale-100 blur-0'
              : 'opacity-0 scale-85 blur-md'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '400ms',
          }}
        >
          <p className="text-lg md:text-xl bg-gradient-to-r from-gray-400 to-gray-500 bg-clip-text text-transparent mb-12">
            Understand your system like a Staff Engineer
          </p>
        </div>

        <div
          className={`transition-all duration-1000 ease-out delay-600 ${
            isVisible
              ? 'opacity-100 scale-100 blur-0'
              : 'opacity-0 scale-85 blur-md'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            transitionDelay: '600ms',
          }}
        >
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onMouseEnter={() => setHoveredButton('primary')}
              onMouseLeave={() => setHoveredButton(null)}
              className="group relative px-8 py-4 bg-gradient-to-br from-[#3fb950] to-[#2fa940] text-white rounded-xl font-semibold text-lg
                         border border-[#3fb950]/50
                         transition-all duration-300 ease-out
                         hover:shadow-[0_0_40px_rgba(63,185,80,0.5)]
                         hover:scale-105 active:scale-95
                         inline-flex items-center gap-2 overflow-hidden"
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-[#3fb950]/0 via-white/10 to-[#3fb950]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  animation: hoveredButton === 'primary' ? 'shimmer 2s infinite' : 'none',
                }}
              />
              <span className="relative">Get Started</span>
              <ArrowRight
                className="w-5 h-5 relative transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110"
              />
            </button>

            <button
              onMouseEnter={() => setHoveredButton('secondary')}
              onMouseLeave={() => setHoveredButton(null)}
              className="group relative px-8 py-4 bg-transparent text-white rounded-xl font-semibold text-lg
                         border border-gray-600 hover:border-[#3fb950]
                         transition-all duration-300 ease-out
                         hover:shadow-[0_0_20px_rgba(63,185,80,0.2)]
                         hover:scale-105 active:scale-95
                         inline-flex items-center gap-2"
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

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(63, 185, 80, 0.08) 0%, transparent 70%)',
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
