'use client';

/**
 * Coin3D — CSS-based 3D coin with front/back faces
 * Pure CSS, no Three.js needed. Lightweight for header/hero.
 */

interface Coin3DProps {
  size?: number; // px
  className?: string;
}

export default function Coin3D({ size = 36, className = '' }: Coin3DProps) {
  const halfThickness = size * 0.06;

  return (
    <div
      className={`coin3d coin-spin ${className}`}
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Front face */}
      <div
        className="coin3d-face coin3d-front"
        style={{
          backgroundImage: 'url(/coin-front.png)',
          transform: `translateZ(${halfThickness}px)`,
        }}
      />
      {/* Back face */}
      <div
        className="coin3d-face coin3d-back"
        style={{
          backgroundImage: 'url(/coin-back.png)',
          transform: `rotateY(180deg) translateZ(${halfThickness}px)`,
        }}
      />
      {/* Edge ring (simulates thickness) */}
      <div
        className="coin3d-edge"
        style={{
          boxShadow: `0 0 ${halfThickness}px rgba(212,175,55,0.4)`,
        }}
      />
    </div>
  );
}
