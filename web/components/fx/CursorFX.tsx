'use client';

import { useEffect, useState } from 'react';

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const current = window.scrollY;
      setProgress(total > 0 ? (current / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="scroll-progress" style={{ width: `${progress}%` }} />
  );
}

export function CustomCursor() {
  const [dotPos, setDotPos] = useState({ x: -100, y: -100 });
  const [ringPos, setRingPos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    let ringX = -100;
    let ringY = -100;
    let targetX = -100;
    let targetY = -100;
    let animId = 0;

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      setDotPos({ x: targetX, y: targetY });

      // Check if hovering interactive element
      const el = e.target as HTMLElement;
      const interactive = el.closest('a, button, input, [role="button"]');
      setIsHovering(!!interactive);
    };

    const animate = () => {
      // Smooth ring follow
      ringX += (targetX - ringX) * 0.15;
      ringY += (targetY - ringY) * 0.15;
      setRingPos({ x: ringX, y: ringY });
      animId = requestAnimationFrame(animate);
    };
    animate();

    window.addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <>
      <div
        className="cursor-dot"
        style={{
          transform: `translate(${dotPos.x - 4}px, ${dotPos.y - 4}px) scale(${isHovering ? 1.5 : 1})`,
        }}
      />
      <div
        className="cursor-ring"
        style={{
          transform: `translate(${ringPos.x - 16}px, ${ringPos.y - 16}px) scale(${isHovering ? 1.5 : 1})`,
          borderColor: isHovering ? 'rgba(212,175,55,0.8)' : 'rgba(212,175,55,0.4)',
        }}
      />
    </>
  );
}
