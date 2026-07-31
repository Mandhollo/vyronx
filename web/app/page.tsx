'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import {
  Brain, Zap, Coins, Lock, TrendingUp, Shield, Rocket,
  ArrowRight, Check, Flame, Users, Globe, Target, Award, BarChart3
} from 'lucide-react';
import { useEffect, useState } from 'react';
import ParticleField from '@/components/fx/ParticleField';
import { useI18n } from '@/lib/i18n';

// ═══════════════════════════════════════════════════════════════
// Animation variants
// ═══════════════════════════════════════════════════════════════
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

// ═══════════════════════════════════════════════════════════════
// Data
// ═══════════════════════════════════════════════════════════════
const FEATURES = [
  { icon: Brain, title: 'AI Arbitrage Agents', description: 'AI-powered bots executing real-time cryptocurrency arbitrage, with all operations visible on-chain.' },
  { icon: TrendingUp, title: 'Multi-Tier Staking', description: '4 staking pools from 30 to 360 days with up to 15% monthly returns. Stake USDT, earn VYR.' },
  { icon: Flame, title: 'Buyback & Burn', description: 'Strategic token buybacks with a discount mechanism plus permanent burn to reduce supply.' },
  { icon: Target, title: 'Predictive Markets', description: 'On-chain prediction markets where users can forecast outcomes and earn rewards.' },
  { icon: Rocket, title: 'Launchpad', description: 'Launch platform for future governance tokens with community airdrop distribution.' },
  { icon: Shield, title: 'Secure & Transparent', description: 'Chainlink oracle price feeds, AI-powered arbitrage, and fully on-chain transactions.' },
];

const TOKENOMICS = [
  { label: 'Presale', percentage: 30, amount: '300M', color: 'from-gold-light to-gold' },
  { label: 'Liquidity Pool', percentage: 20, amount: '200M', color: 'from-amber-400 to-amber-600' },
  { label: 'Staking Pools', percentage: 50, amount: '500M', color: 'from-yellow-300 to-amber-500' },
];

const STAKING_POOLS = [
  { duration: '30 Days', daily: '0.11%', monthly: '~3.5%', lock: '30 days', tier: 'Starter' },
  { duration: '60 Days', daily: '0.23%', monthly: '~7%', lock: '60 days', tier: 'Growth' },
  { duration: '180 Days', daily: '0.33%', monthly: '~10%', lock: '180 days', tier: 'Pro' },
  { duration: '360 Days', daily: '0.50%', monthly: '~15%', lock: '360 days', tier: 'Elite' },
];

const ROADMAP = [
  { phase: 'Phase 1', title: 'Foundation', status: 'active', items: ['VYR token deploy', 'Presale launch', 'DEX liquidity pool', 'Web platform'] },
  { phase: 'Phase 2', title: 'Staking Ecosystem', status: 'upcoming', items: ['4 staking pools live', 'Admin panel', 'Accelerator (360d)', '11-level affiliate program'] },
  { phase: 'Phase 3', title: 'AI & Arbitrage', status: 'upcoming', items: ['AI arbitrage agents', 'Real-time operations dashboard'] },
  { phase: 'Phase 4', title: 'Buyback & Auction', status: 'upcoming', items: ['Buyback with discount', 'Penny auction system'] },
  { phase: 'Phase 5', title: 'Fund & Predictive', status: 'upcoming', items: ['Investment fund', 'Predictive market platform'] },
  { phase: 'Phase 6', title: 'Launchpad', status: 'upcoming', items: ['Governance token launchpad', 'Community airdrops'] },
];

const STATS = [
  { value: 1, suffix: 'B', label: 'Total Supply', key: 'stats.supply' },
  { value: 15, suffix: '%', label: 'Max Monthly APY', key: 'stats.apy' },
  { value: 4, suffix: '', label: 'Staking Pools', key: 'stats.pools' },
  { value: 11, suffix: '', label: 'Affiliate Levels', key: 'stats.levels' },
];

// ═══════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════
function SectionWrapper({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`relative py-20 sm:py-28 ${className}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      className="text-center mb-16"
    >
      <motion.span variants={fadeUp} className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4">
        {eyebrow}
      </motion.span>
      <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p variants={fadeUp} className="mt-4 text-base sm:text-lg text-beige-muted max-w-2xl mx-auto">
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════Animated Counter
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let frame = 0;
    const totalFrames = 60;
    const tick = () => {
      frame++;
      if (frame < totalFrames) {
        if (frame < totalFrames - 15) {
          const random = Math.floor(Math.random() * Math.max(target * 1.5, 100));
          setDisplay(random.toLocaleString('en-US'));
        } else {
          const progress = (frame - (totalFrames - 15)) / 15;
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.floor(eased * target).toLocaleString('en-US'));
        }
        requestAnimationFrame(tick);
      } else {
        setDisplay(target.toLocaleString('en-US'));
      }
    };
    requestAnimationFrame(tick);
  }, [isInView, target]);

  return <span ref={ref}>{display}{suffix}</span>;
}

// ═══════════════════════════════════════════════════════════════
// SECTIONS
// ═══════════════════════════════════════════════════════════════

function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20 scanline-overlay">
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={50} />

      {/* Aurora blobs */}
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 400, height: 400, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '20%', right: '10%', width: 350, height: 350, background: '#3d4a2a', animationDelay: '5s' }} />

      {/* Tron grid floor */}
      <div className="grid-floor" />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center" style={{ zIndex: 2 }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} className="mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider text-gold border border-gold/30 rounded-full bg-gold/5 neon-pulse">
              <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
              {t('hero.badge')}
            </span>
          </motion.div>

          {/* Logo */}
          <motion.div variants={fadeUp} className="mb-8 relative">
            <div className="absolute inset-0 bg-gold/10 blur-[80px] rounded-full" />
            <img
              src="/vyronx-logo.png"
              alt="VyronX Logo"
              className="relative mx-auto w-40 h-40 sm:w-56 sm:h-56 lg:w-64 lg:h-64 object-contain spin-360"
              style={{ perspective: '800px' }}
            />
          </motion.div>

          {/* Tagline */}
          <motion.p variants={fadeUp} className="mt-8 text-xl sm:text-2xl lg:text-3xl font-light text-beige max-w-3xl">
            {t('hero.tagline')}{' '}
            <span className="text-gold font-medium glitch">{t('hero.tagline2')}</span>{' '}
            {t('hero.tagline3')}
          </motion.p>

          <motion.p variants={fadeUp} className="mt-4 text-sm sm:text-base text-beige-muted max-w-2xl">
            {t('hero.subtitle')}
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="mt-10 flex flex-col sm:flex-row gap-4">
            <Link
              href="/presale"
              className="magnetic-btn group inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-2xl hover:shadow-gold/40 transition-all"
            >
              {t('hero.cta1')}
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/whitepaper"
              className="magnetic-btn inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-xl border border-dark-border bg-dark-card/50 text-white hover:border-gold/50 hover:text-gold glow-border-hover transition-all"
            >
              {t('hero.cta2')}
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp} className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-12 w-full max-w-3xl">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-black text-gold-gradient">
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </div>
                <div className="mt-1 text-xs sm:text-sm text-beige-muted uppercase tracking-wider">{t(stat.key)}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const { t } = useI18n();
  return (
    <SectionWrapper className="relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <SectionTitle
        eyebrow={t('section.ecosystem')}
        title={t('section.ecosystem.title')}
        subtitle={t('section.ecosystem.desc')}
      />
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {FEATURES.map((feature) => (
          <motion.div
            key={feature.title}
            variants={fadeUp}
            className="group relative rounded-2xl glass-card p-6"
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div
                className="group/icon mb-4 inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gold/10 border border-gold/20 group-hover:bg-gold/20 transition-all group-hover:shadow-lg group-hover:shadow-gold/30 float"
                style={{ transformStyle: 'preserve-3d', perspective: '400px' }}
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width - 0.5;
                  const y = (e.clientY - rect.top) / rect.height - 0.5;
                  el.style.transform = `perspective(400px) rotateX(${-y * 25}deg) rotateY(${x * 25}deg) scale(1.15)`;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
              >
                <feature.icon className="h-7 w-7 text-gold" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-beige-muted leading-relaxed">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </SectionWrapper>
  );
}

function TokenomicsSection() {
  const { t } = useI18n();
  return (
    <SectionWrapper className="relative">
      <SectionTitle
        eyebrow={t('section.tokenomics')}
        title={t('section.tokenomics.title')}
        subtitle={t('section.tokenomics.desc')}
      />

      {/* Supply visual */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="mb-12"
      >
        <div className="rounded-2xl border border-dark-border bg-dark-card p-8 neon-pulse">
          <div className="text-center mb-8">
            <div className="text-5xl sm:text-6xl font-black text-gold-gradient">
              <AnimatedCounter target={1000000000} suffix="" />
            </div>
            <div className="mt-2 text-sm text-beige-muted uppercase tracking-widest">$VYR {t('stats.supply')}</div>
          </div>
          {/* Bar with glow + sweep */}
          <div className="relative flex h-5 rounded-full overflow-hidden sweep-light">
            {TOKENOMICS.map((item) => (
              <div
                key={item.label}
                className={`bg-gradient-to-r ${item.color} transition-all duration-1000`}
                style={{ width: `${item.percentage}%` }}
                title={`${item.label}: ${item.percentage}%`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs">
            {TOKENOMICS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded bg-gradient-to-r ${item.color}`} />
                <span className="text-beige">{item.label}</span>
                <span className="text-beige-muted">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Cards */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-6"
      >
        {TOKENOMICS.map((item) => (
          <motion.div
            key={item.label}
            variants={fadeUp}
            className="group relative rounded-2xl glass-card p-6 text-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className={`relative text-4xl font-black bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
              <AnimatedCounter target={item.percentage} suffix="%" />
            </div>
            <div className="relative mt-2 text-lg font-bold text-white">{item.label}</div>
            <div className="relative mt-1 text-sm text-beige-muted">{item.amount} $VYR</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Fee structure */}
      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <motion.div variants={fadeUp} className="rounded-2xl border border-green-moss/30 bg-green-moss-dark/20 p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="h-5 w-5 text-gold rotate-180" />
            <h3 className="text-lg font-bold text-white">Buy Tax — 8%</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Check className="h-4 w-4 text-gold" /> Rewards (Holder Staking)</span><span className="text-gold font-bold">4%</span></li>
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Check className="h-4 w-4 text-gold" /> Auto Liquidity</span><span className="text-gold font-bold">2%</span></li>
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Check className="h-4 w-4 text-gold" /> Burn (Permanent)</span><span className="text-gold font-bold">2%</span></li>
          </ul>
        </motion.div>

        <motion.div variants={fadeUp} className="rounded-2xl border border-dark-border bg-dark-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="h-5 w-5 text-gold" />
            <h3 className="text-lg font-bold text-white">Sell Tax — 8% (in BNB)</h3>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Users className="h-4 w-4 text-gold" /> Collaborators</span><span className="text-gold font-bold">2%</span></li>
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Users className="h-4 w-4 text-gold" /> Infrastructure</span><span className="text-gold font-bold">2%</span></li>
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Users className="h-4 w-4 text-gold" /> Development</span><span className="text-gold font-bold">2%</span></li>
            <li className="flex items-center justify-between"><span className="text-beige flex items-center gap-2"><Users className="h-4 w-4 text-gold" /> Marketing</span><span className="text-gold font-bold">2%</span></li>
          </ul>
        </motion.div>
      </motion.div>
    </SectionWrapper>
  );
}

function StakingPreviewSection() {
  const { t } = useI18n();
  return (
    <SectionWrapper className="relative">
      <SectionTitle
        eyebrow={t('section.staking')}
        title={t('section.staking.title')}
        subtitle={t('section.staking.desc')}
      />

      <motion.div
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {STAKING_POOLS.map((pool, idx) => (
          <motion.div
            key={pool.duration}
            variants={fadeUp}
            className={`relative rounded-2xl border p-6 hover:translate-y-[-4px] transition-all ${
              pool.tier === 'Elite'
                ? 'border-gold/50 bg-gradient-to-b from-dark-card to-gold/5 glow-gold'
                : 'border-dark-border bg-dark-card hover:border-gold/30'
            }`}
          >
            {pool.tier === 'Elite' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-gold-light to-gold-dark text-dark">
                ⭐ Best Rate
              </div>
            )}
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-beige-muted mb-1">{pool.tier}</div>
              <div className="text-2xl font-bold text-white">{pool.duration}</div>
            </div>
            <div className="my-6 text-center">
              <div className="text-4xl font-black text-gold-gradient">{pool.monthly}</div>
              <div className="text-xs text-beige-muted mt-1">Monthly Return</div>
            </div>
            <div className="space-y-2 text-sm border-t border-dark-border pt-4">
              <div className="flex justify-between"><span className="text-beige-muted">Daily Rate</span><span className="text-beige font-medium">{pool.daily}</span></div>
              <div className="flex justify-between"><span className="text-beige-muted">Lock Period</span><span className="text-beige font-medium">{pool.lock}</span></div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="mt-10 text-center">
        <Link href="/staking" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl border border-gold/30 bg-gold/5 text-gold hover:bg-gold/10 transition-colors">
          View Staking Details <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </SectionWrapper>
  );
}

function RoadmapSection() {
  const { t } = useI18n();
  return (
    <SectionWrapper className="relative">
      <SectionTitle
        eyebrow={t('section.roadmap')}
        title={t('section.roadmap.title')}
        subtitle={t('section.roadmap.desc')}
      />

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold/50 via-gold/20 to-transparent" />

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="space-y-8"
        >
          {ROADMAP.map((phase, idx) => (
            <motion.div
              key={phase.phase}
              variants={fadeUp}
              className={`relative flex items-start gap-6 ${
                idx % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
              }`}
            >
              {/* Dot */}
              <div className={`absolute left-4 sm:left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-8 w-8 rounded-full border-2 ${
                phase.status === 'active'
                  ? 'border-gold bg-gold text-dark pulse-glow'
                  : 'border-dark-border bg-dark-card text-beige-muted'
              }`}>
                {idx + 1}
              </div>

              {/* Card */}
              <div className={`ml-12 sm:ml-0 sm:w-1/2 ${idx % 2 === 0 ? 'sm:pr-12' : 'sm:pl-12'}`}>
                <div className="rounded-2xl border border-dark-border bg-dark-card p-5 hover:border-gold/30 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-gold">{phase.phase}</span>
                    {phase.status === 'active' && (
                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-gold/20 text-gold border border-gold/30">In Progress</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{phase.title}</h3>
                  <ul className="space-y-1.5">
                    {phase.items.map((item) => (
                      <li key={item} className="text-sm text-beige-muted flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-gold/60 shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

function CTASection() {
  const { t } = useI18n();
  return (
    <SectionWrapper>
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-dark-card via-dark to-dark-elevated p-8 sm:p-12 lg:p-16 text-center glow-gold-strong"
      >
        <div className="absolute inset-0 bg-dot-pattern opacity-30" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-64 bg-gold/20 blur-[100px]" />
        <div className="relative">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white">
            {t('cta.title').split('VyronX')[0]}<span className="text-gold-gradient">VyronX</span>{t('cta.title').includes('?') ? '?' : ''}
          </h2>
          <p className="mt-4 text-lg text-beige-muted max-w-2xl mx-auto">
            {t('hero.subtitle')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/presale"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-2xl hover:shadow-gold/40 hover:scale-[1.02] transition-all"
            >
              {t('hero.cta1')}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="mailto:contato@vyronx.io"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-xl border border-dark-border bg-dark-card/50 text-white hover:border-gold/50 hover:text-gold transition-all"
            >
              {t('cta.contact')}
            </a>
          </div>
        </div>
      </motion.div>
    </SectionWrapper>
  );
}

// ═════════════════Sell Tax cards had some className typos in original. Cleanup is below
// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════ wallets — extra components from spec for later use
// ═════════════ page.tsx


export default function Home() {
  const { t } = useI18n();
  return (
    <>
      <Hero />
      <FeaturesSection />
      <TokenomicsSection />
      <StakingPreviewSection />
      <RoadmapSection />
      <CTASection />
    </>
  );
}
