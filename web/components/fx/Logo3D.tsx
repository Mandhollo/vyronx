'use client';

import { useEffect, useRef } from 'react';
import ParticleField from '@/components/fx/ParticleField';

export default function Logo3D() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left - rect.width / 2) / rect.width) * 30;
      mouseY = ((e.clientY - rect.top - rect.height / 2) / rect.height) * 30;
    };

    const onLeave = () => { mouseX = 0; mouseY = 0; };

    const animate = () => {
      currentX += (mouseX - currentX) * 0.08;
      currentY += (mouseY - currentY) * 0.08;
      el.style.transform = `perspective(1000px) rotateY(${currentX}deg) rotateX(${-currentY}deg)`;
      raf = requestAnimationFrame(animate);
    };
    animate();

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ perspective: '1200px' }}>
      {/* Glow background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-gold/15 blur-[80px] animate-pulse" />
      </div>

      {/* Orbiting particles ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="border border-gold/10 rounded-full"
          style={{ width: '320px', height: '320px', animation: 'spin-slow 20s linear infinite' }}
        />
        <div
          className="absolute border border-gold/5 rounded-full"
          style={{ width: '420px', height: '420px', animation: 'spin-slow 30s linear infinite reverse' }}
        />
      </div>

      {/* 3D Logo container */}
      <div
        ref={ref}
        className="relative cursor-pointer"
        style={{ transformStyle: 'preserve-3d', transition: 'transform 0.1s ease-out' }}
      >
        {/* Reflection / shadow */}
        <div
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-40 h-8 rounded-full bg-gold/20 blur-xl"
          style={{ transform: 'translateZ(-50px)' }}
        />

        {/* The VX logo built with CSS */}
        <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
          {/* V letter - silver/metallic */}
          <div
            className="text-[100px] sm:text-[140px] font-black leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, #e8e8e8 0%, #a0a0a0 30%, #c0c0c0 50%, #707070 70%, #d0d0d0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(212,175,55,0.4))',
              transform: 'translateZ(30px)',
            }}
          >
            V
          </div>

          {/* X letter - gold, positioned to interlock with V */}
          <div
            className="absolute top-0 left-[60px] sm:left-[80px] text-[100px] sm:text-[140px] font-black leading-none select-none"
            style={{
              background: 'linear-gradient(135deg, #f4d03f 0%, #d4af37 30%, #ffd700 50%, #b8860b 70%, #f4d03f 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 25px rgba(212,175,55,0.6))',
              transform: 'translateZ(50px)',
            }}
          >
            X
          </div>

          {/* 3D depth layers for V (creates extrusion effect) */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={`v-${i}`}
              className="absolute top-0 left-0 text-[100px] sm:text-[140px] font-black leading-none select-none opacity-20"
              style={{
                color: '#444',
                transform: `translateZ(${30 - i * 8}px) translate(${i}px, ${i}px)`,
              }}
            >V</div>
          ))}

          {/* 3D depth layers for X */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={`x-${i}`}
              className="absolute top-0 left-[60px] sm:left-[80px] text-[100px] sm:text-[140px] font-black leading-none select-none opacity-15"
              style={{
                color: '#5a4a0a',
                transform: `translateZ(${50 - i * 8}px) translate(${i}px, ${i}px)`,
              }}
            >X</div>
          ))}
        </div>

        {/* VYRONX text below */}
        <div
          className="mt-2 text-center text-2xl sm:text-3xl font-black tracking-widest"
          style={{ transform: 'translateZ(20px)' }}
        >
          <span style={{
            background: 'linear-gradient(135deg, #d0d0d0, #909090)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>VYRON</span>
          <span style={{
            background: 'linear-gradient(135deg, #f4d03f, #d4af37)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>X</span>
        </div>
      </div>
    </div>
  );
}
