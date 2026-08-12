'use client';

import { useEffect, useRef } from 'react';

/**
 * NebulaScatter — Market visualization as glowing scatter plot.
 * Ported from the original arb dashboard.
 */
export default function NebulaScatter({
  items = [],
  opportunities = [],
  width = '100%',
  height = 280,
}: {
  items?: any[];
  opportunities?: any[];
  width?: string | number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef<{ nodes: any[]; edges: any[]; particles: any[] }>({
    nodes: [],
    edges: [],
    particles: [],
  });

  // Build node/edge graph from market data
  useEffect(() => {
    const nodes: any[] = [];
    const nodeMap: Record<string, any> = {};
    const colors: Record<string, string> = {
      binance: '#d4af37',
      bybit: '#f4d03f',
      okx: '#4ade80',
      kucoin: '#8b5cf6',
      pancakeswap: '#d4af37',
      pancakeswap_v2: '#d4af37',
      apeswap: '#a78bfa',
      baby_swap: '#fb923c',
      babyswap: '#fb923c',
    };

    items.forEach((item: any) => {
      if (!item || !item.exchange) return;
      if (!nodeMap[item.exchange]) {
        const angle = (Object.keys(nodeMap).length / 5) * Math.PI * 2;
        const radius = 0.3 + Math.random() * 0.2;
        nodeMap[item.exchange] = {
          id: item.exchange,
          x: 0.5 + Math.cos(angle) * radius,
          y: 0.5 + Math.sin(angle) * radius * 0.7,
          vx: (Math.random() - 0.5) * 0.0005,
          vy: (Math.random() - 0.5) * 0.0005,
          color: colors[item.exchange] || '#ffffff',
          size: 5,
          label: item.exchange.toUpperCase(),
          symbols: new Set<string>(),
        };
        nodes.push(nodeMap[item.exchange]);
      }
      nodeMap[item.exchange].symbols.add(item.symbol);
    });

    nodes.forEach((n) => {
      n.size = 4 + Math.min(n.symbols.size * 1.5, 10);
    });

    const edges = opportunities.slice(0, 20).map((opp: any) => ({
      from: opp.buy_exchange,
      to: opp.sell_exchange,
      profit: Number(opp.estimated_profit_usdt || 0),
    }));

    dataRef.current = { nodes, edges, particles: dataRef.current.particles };
  }, [items, opportunities]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    function resize() {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = typeof height === 'number' ? height : 280;
    }
    resize();
    window.addEventListener('resize', resize);

    // Background particles (stars)
    const particles: any[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        size: Math.random() * 1.2 + 0.3,
        color: ['#ff2d92', '#00d4ff', '#ffffff', '#ffcc00'][Math.floor(Math.random() * 4)],
        phase: Math.random() * Math.PI * 2,
      });
    }
    dataRef.current.particles = particles;

    let frame = 0;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Nebula gradient
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 1.5);
      grad.addColorStop(0, 'rgba(40, 10, 60, 0.08)');
      grad.addColorStop(0.5, 'rgba(20, 5, 30, 0.04)');
      grad.addColorStop(1, 'rgba(5, 0, 10, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      frame++;

      // Draw background particles
      for (let p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.phase += 0.02;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;

        const brightness = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(p.phase));
        ctx.globalAlpha = brightness;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, Math.max(0.3, p.size), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const { nodes, edges } = dataRef.current;
      if (nodes.length === 0) {
        ctx.fillStyle = '#555570';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AWAITING MARKET DATA...', w / 2, h / 2);
        raf = requestAnimationFrame(draw);
        return;
      }

      // Update node positions (gentle drift)
      for (let n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.vx += (0.5 - n.x) * 0.00002;
        n.vy += (0.5 - n.y) * 0.00002;
        n.vx *= 0.998;
        n.vy *= 0.998;
      }

      // Draw edges (opportunity connections)
      for (let edge of edges) {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) continue;

        const x1 = fromNode.x * w;
        const y1 = fromNode.y * h;
        const x2 = toNode.x * w;
        const y2 = toNode.y * h;

        const edgeColor = edge.profit > 0 ? '#00ff9d' : '#ff3366';
        ctx.strokeStyle = `${edgeColor}40`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Animated pulse traveling along edge
        const pulsePos = (frame % 120) / 120;
        const px = x1 + (x2 - x1) * pulsePos;
        const py = y1 + (y2 - y1) * pulsePos;
        ctx.fillStyle = edgeColor;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw nodes (exchanges)
      for (let n of nodes) {
        const x = n.x * w;
        const y = n.y * h;

        // Outer glow
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, n.size * 4);
        glowGrad.addColorStop(0, `${n.color}60`);
        glowGrad.addColorStop(0.4, `${n.color}20`);
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, n.size * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core circle
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(2, n.size), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Inner bright dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(1, n.size * 0.35), 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#aaaabb';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, x, y + n.size + 14);

        // Symbol count
        ctx.fillStyle = '#555570';
        ctx.font = '7px monospace';
        ctx.fillText(`${n.symbols.size} pairs`, x, y + n.size + 24);
      }

      raf = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [height]);

  return (
    <div style={{ width, height, position: 'relative' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}
