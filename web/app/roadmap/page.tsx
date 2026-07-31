'use client';

import {
motion } from 'framer-motion';
import Link from 'next/link';
import {
  Check, Circle, ArrowRight, Rocket, Brain, TrendingUp,
  Coins, Target, Flame, Users, Lock, Shield, Zap
} from 'lucide-react';
import ParticleField from '@/components/fx/ParticleField';
import { useI18n } from '@/lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const PHASES = [
  {
    phase: 'Phase 1',
    title: 'Foundation',
    status: 'active',
    timeline: 'Q1 2026',
    icon: Rocket,
    items: [
      'VYR token deployment (BEP-20)',
      'Presale launch (2 phases, 30 days)',
      'DEX liquidity pool (PancakeSwap)',
      'Web platform (Home + Presale)',
      'Community channels setup',
    ],
  },
  {
    phase: 'Phase 2',
    title: 'Staking Ecosystem',
    status: 'upcoming',
    timeline: 'Q2 2026',
    icon: TrendingUp,
    items: [
      '4 staking pools live (30/60/180/360 days)',
      'Admin panel for rate management',
      'Chainlink oracle integration (USDT→VYR)',
      'Accelerator system (360-day pool)',
      '11-level affiliate program',
      'Investor dashboard',
    ],
  },
  {
    phase: 'Phase 3',
    title: 'AI & Arbitrage',
    status: 'upcoming',
    timeline: 'Q3 2026',
    icon: Brain,
    items: [
      'AI arbitrage agents deployment',
      'Real-time operations dashboard',
      'Performance metrics & analytics',
      'Profit distribution to stakers',
    ],
  },
  {
    phase: 'Phase 4',
    title: 'Buyback & Auction',
    status: 'upcoming',
    timeline: 'Q4 2026',
    icon: Flame,
    items: [
      'Strategic buyback with discount mechanism',
      'Penny auction system',
      'Supply reduction strategy',
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Fund & Predictive Markets',
    status: 'upcoming',
    timeline: 'Q1 2027',
    icon: Target,
    items: [
      'Investment fund launch',
      'On-chain predictive market platform',
      'Community prediction rewards',
    ],
  },
  {
    phase: 'Phase 6',
    title: 'Launchpad',
    status: 'upcoming',
    timeline: 'Q2 2027',
    icon: Coins,
    items: [
      'Governance token launchpad',
      'Community airdrop distribution',
      'Cross-project synergy integrations',
    ],
  },
];

export default function RoadmapPage() {
  const { t } = useI18n();
  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.span variants={fadeUp} className="inline-block px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full bg-gold/5 mb-4 neon-pulse">
            {t('rm.badge')}
          </motion.span>
          <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl lg:text-6xl font-black text-white">
            {t('rm.title')} <span className="text-gold-gradient">{t('rm.titleHighlight')}</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-4 text-lg text-beige-muted max-w-2xl mx-auto">
            {t('rm.subtitle')}
          </motion.p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="relative"
        >
          {/* Vertical line */}
          <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-gold via-gold/30 to-transparent -translate-x-px" />

          <div className="space-y-12">
            {PHASES.map((phase, idx) => (
              <motion.div
                key={phase.phase}
                variants={fadeUp}
                className={`relative flex items-start gap-6 sm:gap-8 ${
                  idx % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
                }`}
              >
                {/* Node */}
                <div className={`absolute left-6 sm:left-1/2 -translate-x-1/2 z-10 flex items-center justify-center h-12 w-12 rounded-full border-2 ${
                  phase.status === 'active'
                    ? 'border-gold bg-gold text-dark pulse-glow'
                    : 'border-dark-border bg-dark-card text-beige-muted'
                }`}>
                  <phase.icon className="h-5 w-5" />
                </div>

                {/* Card */}
                <div className={`ml-20 sm:ml-0 sm:w-1/2 ${idx % 2 === 0 ? 'sm:pr-16' : 'sm:pl-16'}`}>
                  <div className={`rounded-2xl border p-6 ${
                    phase.status === 'active'
                      ? 'border-gold/40 bg-gradient-to-br from-dark-card to-gold/5 glow-gold'
                      : 'border-dark-border bg-dark-card hover:border-gold/30 transition-colors'
                  }`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-gold">{t(`rm.${phase.phase.toLowerCase().replace(' ', '')}`)}</div>
                        <h3 className="text-xl font-bold text-white mt-1">{t(`rm.${phase.phase.toLowerCase().replace(' ', '')}Title`)}</h3>
                      </div>
                      {phase.status === 'active' ? (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-gold/20 text-gold border border-gold/30">{t('rm.inProgress')}</span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-dark-elevated text-beige-muted border border-dark-border">{phase.timeline}</span>
                      )}
                    </div>
                    <ul className="space-y-2">
                      {phase.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-beige">
                          <Check className="h-4 w-4 text-gold/60 shrink-0 mt-0.5" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-dark-card via-dark to-dark-elevated p-8 sm:p-12 text-center glow-gold">
            <div className="absolute inset-0 bg-dot-pattern opacity-30" />
            <div className="relative">
              <h2 className="text-3xl font-bold text-white">
                {t('rm.ctaTitle')} <span className="text-gold-gradient">{t('rm.ctaHighlight')}</span>
              </h2>
              <p className="mt-3 text-beige-muted max-w-xl mx-auto">
                {t('rm.ctaDesc')}
              </p>
              <Link
                href="/presale"
                className="mt-6 inline-flex items-center gap-2 px-8 py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 hover:scale-[1.02] transition-all"
              >
                Join Presale <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
