import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ParticleSystemProps {
  scrollProgress: number; // 0 to 1
}

export const ParticleSystem = ({ scrollProgress }: ParticleSystemProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const scene = new THREE.Scene();

    /* -----------------------------
       1. CAMERA & RENDERER
    ----------------------------- */
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Adjusted Z position to make sure large icons fit
    camera.position.z = 70;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /* -----------------------------
       2. PARTICLE SETTINGS
    ----------------------------- */
    const isMobile = window.innerWidth < 768;
    // Icon Scale (Make them BIG)
    const iconSize = isMobile ? 35 : 60; 
    const particleCount = isMobile ? 2500 : 5500;

    /* -----------------------------
       3. GEOMETRY INIT
    ----------------------------- */
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Start with a random sphere distribution (prevents blank screen on load)
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 40 * Math.cbrt(Math.random()); 
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Default Color (White/Blue-ish)
      colors[i * 3] = 0.8;
      colors[i * 3 + 1] = 0.9;
      colors[i * 3 + 2] = 1.0;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    /* -----------------------------
       4. MATERIAL
    ----------------------------- */
    const texture = createSoftCircleTexture();
    const material = new THREE.PointsMaterial({
      size: 0.65,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    /* -----------------------------
       5. SHAPE DEFINITIONS (The Fix)
    ----------------------------- */
    
    // GITHUB ICON (Fixed rotation logic in helper)
    const githubPath = "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

    // CODE </> ICON (Fixed: Includes slash and corrected box)
    const codePath = "M24,10.93h-2.22v-1.12c0-3.6-2.92-6.53-6.51-6.53h-2.18v2.23h2.18c2.37,0,4.29,1.93,4.29,4.3v1.12h-2.22c-1.23,0-2.22,1-2.22,2.23v8.91c0,1.23,1,2.23,2.22,2.23h8.9c1.23,0,2.22-1,2.22-2.23v-8.91C26.22,11.93,25.23,10.93,24,10.93z M18.15,10.93h-8.9c-1.23,0-2.22,1-2.22,2.23v8.91c0,1.23,1,2.23,2.22,2.23h8.9c1.23,0,2.22-1,2.22-2.23v-8.91C20.37,11.93,19.38,10.93,18.15,10.93z M5.56,10.93H3.38v-1.12c0-2.37,1.92-4.3,4.29-4.3h2.18V3.28H7.67c-3.6,0-6.51,2.92-6.51,6.53v1.12H-1.07v2.23h2.23v1.12c0,3.6,2.92,6.53,6.51,6.53h2.18v-2.23H7.67c-2.37,0-4.29-1.93-4.29-4.3v-1.12h-2.22V10.93z"; 
    // ^ I replaced the path above with a more reliable block-style < > / shape to ensure visibility, 
    // but here is a cleaner manual construction for the specific </> look:
    const cleanCodePath = "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z M12.5 4 L15 4 L11.5 20 L9 20 Z";

    // EXECUTE ARROW (Triangle)
    const arrowPath = "M8 5v14l11-7z";

    // Generate Shapes
    const githubShape = getShapeFromSVG(githubPath, particleCount, iconSize);
    const codeShape = getShapeFromSVG(cleanCodePath, particleCount, iconSize);
    const arrowShape = getShapeFromSVG(arrowPath, particleCount, iconSize);

    const shapes = [githubShape, codeShape, arrowShape];

    /* -----------------------------
       6. ANIMATION LOGIC
    ----------------------------- */
    let currentIndex = 0;
    let morphProgress = 0;
    let holdTimer = 0;
    let isHolding = false;
    let time = 0;

    const mouse = { x: 0, y: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      time += 0.015;

      const posArray = geometry.attributes.position.array as Float32Array;
      const colorArray = geometry.attributes.color.array as Float32Array;
      const target = shapes[currentIndex];

      /* -- ANIMATION STATE MACHINE -- */
      if (!isHolding) {
        // MORPHING
        morphProgress += 0.008;
        const ease = 1 - Math.pow(1 - Math.min(morphProgress, 1), 3); // Cubic Ease Out

        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          // Interpolate
          posArray[ix] += (target[ix] - posArray[ix]) * 0.06;
          posArray[ix + 1] += (target[ix + 1] - posArray[ix + 1]) * 0.06;
          posArray[ix + 2] += (target[ix + 2] - posArray[ix + 2]) * 0.06;
          
          // Add noise during travel
          posArray[ix] += (Math.random() - 0.5) * 0.1;
        }

        if (morphProgress >= 1) {
          isHolding = true;
          holdTimer = 0;
        }

      } else {
        // HOLDING
        holdTimer += 0.016;
        
        // Gentle Float
        for (let i = 0; i < particleCount; i++) {
          const ix = i * 3;
          // Force back to shape if drifted
          posArray[ix] += (target[ix] - posArray[ix]) * 0.05;
          posArray[ix + 1] += (target[ix + 1] - posArray[ix + 1]) * 0.05;
          posArray[ix + 2] += (target[ix + 2] - posArray[ix + 2]) * 0.05;

          // Wiggle
          posArray[ix] += Math.sin(time + i) * 0.03;
        }

        if (holdTimer > 3) {
          isHolding = false;
          morphProgress = 0;
          currentIndex = (currentIndex + 1) % shapes.length;
          
          // Safety Check: Ensure currentIndex is valid
          if(currentIndex >= shapes.length || currentIndex < 0) currentIndex = 0;
        }
      }

      /* -- MOUSE REPULSION -- */
      const mx = mouse.x * 50;
      const my = mouse.y * 50;
      for(let i=0; i<particleCount; i++){
        const ix = i*3;
        const dx = posArray[ix] - mx;
        const dy = posArray[ix+1] - my;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < 25){
             const force = (25 - dist)/25;
             const ang = Math.atan2(dy,dx);
             posArray[ix] += Math.cos(ang) * force * 2;
             posArray[ix+1] += Math.sin(ang) * force * 2;
        }
      }

      /* -- SCROLL BEHAVIOR: Fade Out Quickly -- */
      const safeScroll = isNaN(scrollProgress) ? 0 : scrollProgress;

      // Fade out particles completely once scroll starts
      if (safeScroll > 0.1) {
        material.opacity = Math.max(0, 0.85 * (1 - safeScroll * 3));
        particles.visible = material.opacity > 0.01;
      } else {
        material.opacity = 0.85;
        particles.visible = true;
        // Only rotate when visible
        particles.rotation.y = Math.sin(time * 0.3) * 0.15;
      }

      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [scrollProgress]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
};

/* =========================================
   UTILITIES
   ========================================= */

function createSoftCircleTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  
  const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.4, "rgba(255, 255, 255, 0.5)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  return new THREE.CanvasTexture(canvas);
}

/**
 * ROBUST SHAPE GENERATOR
 * Scans a 2D canvas to find pixels and maps them to 3D points.
 * Includes a fallback to prevent blank screens.
 */
function getShapeFromSVG(pathD: string, count: number, scale: number) {
  const points = new Float32Array(count * 3);
  
  // 1. Setup Scanning Grid (High Res for smooth shapes)
  const size = 200; 
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // 2. Center and Scale the SVG Path
  // We assume standard SVG icons are usually 0-24 viewbox.
  // We scale this up to fit our 200x200 grid.
  ctx.translate(size/2, size/2); 
  ctx.scale(7, 7); // Scale factor for 24px -> ~168px
  ctx.translate(-12, -12); // Center the 24x24 box

  ctx.fillStyle = "white";
  const p = new Path2D(pathD);
  ctx.fill(p);

  // 3. Scan Pixels
  const imgData = ctx.getImageData(0, 0, size, size);
  const validPixels: {x:number, y:number}[] = [];

  for(let y=0; y<size; y++){
    for(let x=0; x<size; x++){
       const index = (y*size + x)*4;
       // Check Alpha channel
       if(imgData.data[index+3] > 100) {
         // Map x,y to -1 to 1 range
         // INVERT Y here because 3D Y is up, Canvas Y is down
         validPixels.push({
           x: (x/size)*2 - 1,
           y: -((y/size)*2 - 1)
         });
       }
    }
  }

  // 4. FALLBACK: If path is invalid or empty, return a Sphere instead of crashing/blank
  if (validPixels.length < 50) {
    console.warn("SVG Path scan failed or was empty, using fallback sphere.");
    for(let i=0; i<count; i++){
       const theta = Math.random() * Math.PI * 2;
       const phi = Math.acos(Math.random() * 2 - 1);
       points[i*3] = scale * Math.sin(phi) * Math.cos(theta);
       points[i*3+1] = scale * Math.sin(phi) * Math.sin(theta);
       points[i*3+2] = scale * Math.cos(phi);
    }
    return points;
  }

  // 5. Populate Points
  for (let i = 0; i < count; i++) {
    const pixel = validPixels[Math.floor(Math.random() * validPixels.length)];
    
    points[i * 3] = pixel.x * scale;
    points[i * 3 + 1] = pixel.y * scale;
    // Add volume (thickness) to the 2D shape
    points[i * 3 + 2] = (Math.random() - 0.5) * (scale * 0.15); 
  }

  return points;
}