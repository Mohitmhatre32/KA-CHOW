import { useState, useEffect } from 'react';
import { ParticleSystem } from './components/ParticleSystem';
import { Hero } from './components/Hero';
import { Features } from './components/Features';
import { Footer } from './components/Footer';

function App() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const heroHeight = window.innerHeight;
      const progress = Math.min(scrolled / heroHeight, 1);
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';

    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = 'auto';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  return (
    <div className="relative">
      <div
        className="fixed inset-0 bg-gradient-to-b from-[#0d1117] via-[#0d1117] to-[#161b22]"
        style={{ zIndex: 0 }}
      />

      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          zIndex: 3,
        }}
      />

      <ParticleSystem scrollProgress={scrollProgress} />

      <div className="relative">
        <Hero scrollProgress={scrollProgress} />
        <Features scrollProgress={scrollProgress} />
        <Footer />
      </div>
    </div>
  );
}

export default App;
