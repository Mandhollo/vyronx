'use client';

import { useEffect, useRef, useCallback } from 'react';

// Global callback that lets any component trigger confetti
let fireConfettiFn: (() => void) | null = null;

export function triggerCoinConfetti() {
  if (fireConfettiFn) fireConfettiFn();
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  size: number;
  life: number;
  maxLife: number;
  flip: number;
  vflip: number;
}

export default function CoinConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const imgLoadedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Preload coin image
    const img = new Image();
    img.onload = () => { imgLoadedRef.current = true; };
    img.src = '/vyronx-coin-logo.png';
    imgRef.current = img;

    const burst = () => {
      if (!canvas) return;
      const count = 80; // number of coins
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.4; // slightly above center
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 6 + Math.random() * 10;
        particlesRef.current.push({
          x: cx + (Math.random() - 0.5) * 200,
          y: cy,
          vx: Math.cos(angle) * speed * (0.5 + Math.random()),
          vy: Math.sin(angle) * speed - 8 - Math.random() * 6,
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          size: 18 + Math.random() * 22,
          life: 0,
          maxLife: 120 + Math.random() * 80,
          flip: 0,
          vflip: 0.05 + Math.random() * 0.1,
        });
      }
    };

    // Register global trigger
    fireConfettiFn = burst;

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      const gravity = 0.35;

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.vy += gravity;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.flip += p.vflip;

        const fade = Math.max(0, 1 - p.life / p.maxLife);

        if (p.life >= p.maxLife || p.y > canvas.height + 60) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        // Simulate 3D flip by scaling horizontally
        const scaleX = Math.cos(p.flip);
        ctx.globalAlpha = fade;
        const drawSize = p.size;

        if (imgLoadedRef.current && imgRef.current && Math.abs(scaleX) > 0.1) {
          ctx.scale(Math.abs(scaleX), 1);
          try {
            ctx.drawImage(imgRef.current, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
          } catch {}
        } else if (imgLoadedRef.current && imgRef.current) {
          // Edge flip — thin gold line
          ctx.fillStyle = '#D4AF37';
          ctx.fillRect(-2, -drawSize / 2, 4, drawSize);
        } else {
          // Fallback gold circle
          ctx.fillStyle = '#D4AF37';
          ctx.beginPath();
          ctx.arc(0, 0, drawSize / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (particles.length > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Keep loop alive only when particles exist
      }
    };

    // Start animation loop — always running but only draws when particles exist
    let lastTime = 0;
    const loop = (time: number) => {
      if (particlesRef.current.length > 0) {
        animate();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
      fireConfettiFn = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ zIndex: 9999 }}
    />
  );
}
