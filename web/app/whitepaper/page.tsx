'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  FileText, Check, Shield, Brain, Coins, TrendingUp,
  Flame, Target, Rocket, Users, Clock, ArrowRight, Download
} from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'token', label: 'Token' },
  { id: 'tokenomics', label: 'Tokenomics' },
  { id: 'fees', label: 'Fee Mechanism' },
  { id: 'staking', label: 'Staking' },
  { id: 'accelerator', label: 'Accelerator' },
  { id: 'affiliates', label: 'Affiliates' },
  { id: 'presale', label: 'Presale' },
  { id: 'ecosystem', label: 'Ecosystem' },
  { id: 'security', label: 'Security' },
  { id: 'disclaimer', label: 'Disclaimer' },
];

export default function WhitepaperPage() {
  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar TOC */}
          <aside className="lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
              <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">Contents</h3>
              <nav className="space-y-1">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block px-3 py-2 text-sm text-beige hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 max-w-4xl">
            {/* Header */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="mb-12"
            >
              <motion.div variants={fadeUp} className="flex items-center gap-3 mb-4">
                <FileText className="h-8 w-8 text-gold" />
                <span className="text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full px-3 py-1 bg-gold/5">Whitepaper v1.0</span>
              </motion.div>
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-black text-white">
                <span className="text-white">Vyron</span><span className="text-gold-gradient">X</span> Whitepaper
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-beige-muted">
                A comprehensive technical document covering the architecture, tokenomics, and vision of the VyronX DeFi ecosystem.
              </motion.p>
            </motion.div>

            {/* Sections */}
            <motion.article
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="space-y-12"
            >
              {/* Overview */}
              <motion.section variants={fadeUp} id="overview" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">1. Overview</h2>
                <p className="text-beige leading-relaxed mb-4">
                  <span className="text-gold font-bold">VyronX ($VYR)</span> is a DeFi ecosystem built on the BNB Smart Chain (BEP-20) that combines artificial intelligence, innovative staking mechanisms, and a transparent value-distribution model. The platform enables investors to participate in staking pools with differentiated returns, benefit from an 11-level affiliate system with residual commissions, and access a growing ecosystem of utilities including AI-powered arbitrage, strategic buybacks, predictive markets, and a launchpad for future governance tokens.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="rounded-xl bg-dark-card border border-dark-border p-4">
                    <div className="text-xs font-bold text-gold uppercase tracking-wider mb-1">Vision</div>
                    <p className="text-sm text-beige">Become a leading DeFi platform where cutting-edge technology meets innovative financial mechanisms.</p>
                  </div>
                  <div className="rounded-xl bg-dark-card border border-dark-border p-4">
                    <div className="text-xs font-bold text-gold uppercase tracking-wider mb-1">Mission</div>
                    <p className="text-sm text-beige">Democratize access to sophisticated decentralized financial instruments through an intuitive, transparent platform.</p>
                  </div>
                </div>
              </motion.section>

              {/* Token */}
              <motion.section variants={fadeUp} id="token" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">2. Token Specifications</h2>
                <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {[
                        ['Name', 'VyronX'],
                        ['Symbol / Ticker', 'VYR'],
                        ['Standard', 'BEP-20'],
                        ['Network', 'BNB Smart Chain'],
                        ['Total Supply', '1,000,000,000 VYR (1 Billion)'],
                        ['Decimals', '18'],
                      ].map(([key, val]) => (
                        <tr key={key} className="border-b border-dark-border/50 last:border-0">
                          <td className="px-6 py-3 text-sm font-medium text-beige-muted w-1/3">{key}</td>
                          <td className="px-6 py-3 text-sm font-bold text-white">{val}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>

              {/* Tokenomics */}
              <motion.section variants={fadeUp} id="tokenomics" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">3. Tokenomics</h2>
                <p className="text-beige leading-relaxed mb-6">
                  The total supply of 1 billion VYR is distributed across three key allocations:
                </p>
                <div className="space-y-4">
                  {[
                    { label: 'Presale', percent: 30, amount: '300,000,000 VYR', desc: 'Initial community distribution and fundraising' },
                    { label: 'Liquidity Pool', percent: 20, amount: '200,000,000 VYR', desc: 'DEX liquidity for trading stability' },
                    { label: 'Staking Rewards', percent: 50, amount: '500,000,000 VYR', desc: 'Reserve funding all staking pool rewards' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-dark-border bg-dark-card p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-base font-bold text-white">{item.label}</span>
                        <span className="text-2xl font-black text-gold-gradient">{item.percent}%</span>
                      </div>
                      <div className="text-sm text-beige-muted mb-3">{item.desc}</div>
                      <div className="text-xs font-mono text-gold">{item.amount}</div>
                      <div className="mt-2 h-1.5 rounded-full bg-dark-border overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-gold-light to-gold-dark" style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>

              {/* Fees */}
              <motion.section variants={fadeUp} id="fees" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">4. Fee Mechanism</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-green-moss/30 bg-green-moss-dark/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Buy Tax — 8%</h3>
                    <ul className="space-y-3">
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Holder Rewards (Staking)</span><span className="text-gold font-bold">4%</span></li>
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Auto-Liquidity</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center"><span className="text-beige">Burn (Permanent)</span><span className="text-gold font-bold">2%</span></li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-dark-border bg-dark-card p-6">
                    <h3 className="text-lg font-bold text-white mb-4">Sell Tax — 8% (in BNB)</h3>
                    <ul className="space-y-3">
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Project Wallet 1</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Project Wallet 2</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Project Wallet 3</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center"><span className="text-beige">Project Wallet 4</span><span className="text-gold font-bold">2%</span></li>
                    </ul>
                    <p className="mt-4 text-xs text-beige-muted">Sell tax is automatically converted to BNB via in-contract swap.</p>
                  </div>
                </div>
              </motion.section>

              {/* Staking */}
              <motion.section variants={fadeUp} id="staking" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">5. Staking Pools</h2>
                <p className="text-beige leading-relaxed mb-6">
                  Four pools with escalating returns. Investors deposit <span className="text-gold font-bold">USDT</span> and receive <span className="text-gold font-bold">VYR</span> upon withdrawal at market price via Chainlink oracle.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-dark-border bg-dark-card">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Pool</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Daily</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Monthly</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Starter', '30 days', '0.11%', '~3.5%'],
                        ['Growth', '60 days', '0.23%', '~7%'],
                        ['Pro', '180 days', '0.33%', '~10%'],
                        ['Elite', '360 days', '0.50%', '~15%'],
                      ].map(([tier, dur, daily, monthly]) => (
                        <tr key={tier} className="border-b border-dark-border/50 last:border-0">
                          <td className="px-4 py-3 text-sm font-bold text-white">{tier}</td>
                          <td className="px-4 py-3 text-sm text-beige">{dur}</td>
                          <td className="px-4 py-3 text-sm text-beige">{daily}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gold">{monthly}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>

              {/* Accelerator */}
              <motion.section variants={fadeUp} id="accelerator" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">6. The Accelerator (360-Day Pool)</h2>
                <p className="text-beige leading-relaxed mb-4">
                  Exclusive to the 360-day pool. Each referral&apos;s deposit adds <span className="text-gold font-bold">10% of their amount</span> to your accelerator. When accumulated referrals reach <span className="text-gold font-bold">100% of your stake</span>, you unlock early withdrawal of your earnings.
                </p>
                <div className="rounded-xl bg-dark-card border border-dark-border p-5">
                  <div className="text-sm font-bold text-gold mb-3">Example: Your stake = $100</div>
                  <div className="space-y-2">
                    {[
                      ['Referral deposits $200', '+$20 (10%)', '20%'],
                      ['Referral deposits $500', '+$50 (10%)', '70%'],
                      ['Referral deposits $300', '+$30 (10%)', '100% ✓'],
                    ].map(([action, gain, total]) => (
                      <div key={action} className="flex items-center gap-4 text-sm">
                        <span className="text-beige-muted flex-1">{action}</span>
                        <span className="text-gold w-28">{gain}</span>
                        <span className="text-white font-bold w-16 text-right">{total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* Affiliates */}
              <motion.section variants={fadeUp} id="affiliates" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">7. Affiliate Program (11 Levels)</h2>
                <p className="text-beige leading-relaxed mb-4">
                  Residual commissions on <span className="text-gold font-bold">profit</span> (never principal) from your 360-day pool network.
                </p>
                <div className="overflow-x-auto rounded-2xl border border-dark-border bg-dark-card mb-4">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Commission</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Min Stake</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Direct Refs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['1', '7%', '$100', '—'],
                        ['2', '6%', '$200', '2'],
                        ['3', '5%', '$300', '3'],
                        ['4', '4%', '$400', '4'],
                        ['5', '3%', '$500', '5'],
                        ['6', '2%', '$600', '6'],
                        ['7', '2%', '$700', '7'],
                        ['8', '2%', '$800', '8'],
                        ['9', '2%', '$900', '9'],
                        ['10', '2%', '$1,000', '10'],
                        ['11', '7%', '$1,100', '11'],
                      ].map(([lvl, comm, stake, refs]) => (
                        <tr key={lvl} className="border-b border-dark-border/50 last:border-0 hover:bg-gold/5">
                          <td className="px-4 py-2 text-sm font-bold text-white">Lv {lvl}</td>
                          <td className="px-4 py-2 text-sm font-bold text-gold">{comm}</td>
                          <td className="px-4 py-2 text-sm text-beige">{stake}</td>
                          <td className="px-4 py-2 text-sm text-beige">{refs} × $100</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>

              {/* Presale */}
              <motion.section variants={fadeUp} id="presale" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">8. Presale & Distribution</h2>
                <p className="text-beige leading-relaxed mb-6">
                  Presale funds are distributed automatically every <span className="text-gold font-bold">48 hours</span> to designated wallets, fully on-chain and transparent.
                </p>
                <div className="space-y-3">
                  {[
                    ['Marketing', '10%'],
                    ['Initial LP', '15%'],
                    ['Buyback Reserve', '15%'],
                    ['Tech Infrastructure', '20%'],
                    ['Development (4 wallets × 10%)', '40%'],
                  ].map(([label, pct]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg bg-dark-card border border-dark-border px-5 py-3">
                      <span className="text-sm text-beige">{label}</span>
                      <span className="text-sm font-bold text-gold">{pct}</span>
                    </div>
                  ))}
                </div>
              </motion.section>

              {/* Ecosystem */}
              <motion.section variants={fadeUp} id="ecosystem" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">9. Ecosystem & Utilities</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: Brain, title: 'AI Arbitrage Agents', desc: 'Real-time crypto arbitrage visible on-chain' },
                    { icon: TrendingUp, title: 'Network Fees', desc: 'Revenue from ecosystem operations' },
                    { icon: Flame, title: 'Buyback with Discount', desc: 'Strategic VYR repurchase mechanism' },
                    { icon: Target, title: 'Penny Auction', desc: 'Competitive bidding for tokens' },
                    { icon: Coins, title: 'Investment Fund', desc: 'Diversified portfolio generating yield' },
                    { icon: Target, title: 'Predictive Markets', desc: 'On-chain prediction platform' },
                    { icon: Rocket, title: 'Launchpad', desc: 'Future governance token launches + airdrops' },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-3 rounded-xl border border-dark-border bg-dark-card p-4">
                      <item.icon className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-white">{item.title}</div>
                        <div className="text-xs text-beige-muted mt-1">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>

              {/* Security */}
              <motion.section variants={fadeUp} id="security" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">10. Security</h2>
                <ul className="space-y-3">
                  {[
                    'Smart contract audit before mainnet deployment',
                    'Chainlink Price Feed oracle for reliable, manipulation-resistant pricing',
                    'Automatic on-chain fund distribution eliminates centralized custody risk',
                    'Progressive qualification system in affiliate program prevents abuse',
                    'Timelock and multi-sig on admin functions',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-beige">
                      <Shield className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.section>

              {/* Disclaimer */}
              <motion.section variants={fadeUp} id="disclaimer" className="scroll-mt-24">
                <div className="rounded-2xl border border-dark-border bg-dark-card/50 p-6">
                  <h2 className="text-xl font-bold text-white mb-3">Disclaimer</h2>
                  <p className="text-sm text-beige-muted leading-relaxed">
                    This whitepaper is for informational purposes only and does not constitute financial, legal, or tax advice. Participation in DeFi projects involves inherent risks. Investors should conduct their own research (DYOR) before making any investment decisions. Fees, returns, and mechanisms described may be adjusted by the team as market conditions and ecosystem needs evolve. $VYR tokens do not represent equity, debt, or any form of ownership in the developer entity.
                  </p>
                </div>
              </motion.section>
            </motion.article>

            {/* CTA */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4">
              <Link href="/presale" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-xl bg-gradient-to-r from-gold-light to-gold-dark text-dark hover:shadow-lg hover:shadow-gold/40 transition-all">
                Join Presale <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/staking" className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-xl border border-dark-border bg-dark-card text-white hover:border-gold/50 hover:text-gold transition-all">
                View Staking Pools
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
