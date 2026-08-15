'use client';

import {
motion } from 'framer-motion';
import Link from 'next/link';
import {
  FileText, Check, Shield, Brain, Coins, TrendingUp,
  Flame, Target, Rocket, Users, Clock, ArrowRight, Download
} from 'lucide-react';
import ParticleField from '@/components/fx/ParticleField';
import { useI18n } from '@/lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const SECTIONS = [
  { id: 'overview', labelKey: 'wp.overview' },
  { id: 'token', labelKey: 'wp.token' },
  { id: 'tokenomics', labelKey: 'wp.tokenomics' },
  { id: 'fees', labelKey: 'wp.fees' },
  { id: 'staking', labelKey: 'wp.staking' },
  { id: 'accelerator', labelKey: 'wp.accelerator' },
  { id: 'affiliates', labelKey: 'wp.affiliates' },
  { id: 'presale', labelKey: 'wp.presale' },
  { id: 'ecosystem', labelKey: 'wp.ecosystem' },
  { id: 'security', labelKey: 'wp.security' },
  { id: 'disclaimer', labelKey: 'wp.disclaimer' },
];

export default function WhitepaperPage() {
  const { t } = useI18n();
  return (
    <div className="relative min-h-screen pt-24 pb-20">
      <div className="absolute inset-0 bg-grid-pattern" />
      <ParticleField count={30} />
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: 300, height: 300, background: '#d4af37' }} />
      <div className="aurora-blob" style={{ bottom: '15%', right: '10%', width: 250, height: 250, background: '#3d4a2a', animationDelay: '7s' }} />
      <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar TOC */}
          <aside className="lg:w-64 shrink-0 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-dark-border bg-dark-card p-5">
              <h3 className="text-sm font-bold text-gold uppercase tracking-wider mb-4">{t('wp.contents')}</h3>
              <nav className="space-y-1">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="block px-3 py-2 text-sm text-beige hover:text-gold hover:bg-gold/5 rounded-lg transition-colors"
                  >
                    {t(section.labelKey)}
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
                <span className="text-xs font-bold uppercase tracking-widest text-gold border border-gold/30 rounded-full px-3 py-1 bg-gold/5">{t('wp.badge')}</span>
              </motion.div>
              <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl font-black text-white">
                <span className="text-white">Vyron</span><span className="text-gold-gradient">X</span> Whitepaper
              </motion.h1>
              <motion.p variants={fadeUp} className="mt-4 text-lg text-beige-muted">
                {t('wp.subtitle')}
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
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.overview')}</h2>
                <p className="text-beige leading-relaxed mb-4">
                  <span className="text-gold font-bold">VyronX ($VYR)</span> is a DeFi ecosystem built on the BNB Smart Chain (BEP-20) that combines artificial intelligence, innovative staking mechanisms, and a transparent value-distribution model. The platform enables investors to participate in staking pools with differentiated returns, benefit from an 11-level affiliate system with residual commissions, and access a growing ecosystem of utilities including AI-powered arbitrage, strategic buybacks, predictive markets, and a launchpad for future governance tokens.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="rounded-xl bg-dark-card border border-dark-border p-4">
                    <div className="text-xs font-bold text-gold uppercase tracking-wider mb-1">{t('wp.vision')}</div>
                    <p className="text-sm text-beige">{t('wp.vision.desc')}</p>
                  </div>
                  <div className="rounded-xl bg-dark-card border border-dark-border p-4">
                    <div className="text-xs font-bold text-gold uppercase tracking-wider mb-1">{t('wp.mission')}</div>
                    <p className="text-sm text-beige">{t('wp.mission.desc')}</p>
                  </div>
                </div>
              </motion.section>

              {/* Token */}
              <motion.section variants={fadeUp} id="token" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.token')}</h2>
                <div className="rounded-2xl border border-dark-border bg-dark-card overflow-hidden">
                  <table className="w-full">
                    <tbody>
                      {[
                        [t('wp.tName'), 'VyronX'],
                        [t('wp.tSymbol'), 'VYR'],
                        [t('wp.tStandard'), 'BEP-20'],
                        [t('wp.tNetwork'), 'BNB Smart Chain'],
                        [t('wp.tSupply'), '1,000,000,000 VYR (1 Billion)'],
                        [t('wp.tDecimals'), '18'],
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
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.tokenomics')}</h2>
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
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.fees')}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-green-moss/30 bg-green-moss-dark/20 p-6">
                    <h3 className="text-lg font-bold text-white mb-4">{t('wp.buyTax')}</h3>
                    <ul className="space-y-3">
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Holder Rewards (Staking)</span><span className="text-gold font-bold">4%</span></li>
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Auto-Liquidity</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center"><span className="text-beige">Burn (Permanent)</span><span className="text-gold font-bold">2%</span></li>
                    </ul>
                  </div>
                  <div className="rounded-2xl glass-card p-6">
                    <h3 className="text-lg font-bold text-white mb-4">{t('wp.sellTax')}</h3>
                    <ul className="space-y-3">
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Collaborators</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Infrastructure</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center pb-2 border-b border-dark-border/50"><span className="text-beige">Development</span><span className="text-gold font-bold">2%</span></li>
                      <li className="flex justify-between items-center"><span className="text-beige">Marketing</span><span className="text-gold font-bold">2%</span></li>
                    </ul>
                    <p className="mt-4 text-xs text-beige-muted">Sell tax is automatically converted to BNB via in-contract swap.</p>
                  </div>
                </div>
              </motion.section>

              {/* Staking */}
              <motion.section variants={fadeUp} id="staking" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.staking')}</h2>
                <p className="text-beige leading-relaxed mb-6">
                  Four pools with escalating returns. Investors deposit <span className="text-gold font-bold">USDT</span> and receive <span className="text-gold font-bold">VYR</span> at market price via Chainlink oracle.
                </p>
                <div className="rounded-xl bg-dark-card border border-gold/30 p-5 mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gold font-bold mb-1">Daily Earnings</div>
                      <div className="text-beige-muted">Withdraw daily earnings in VYR anytime (min $10). Only 4% withdrawal fee.</div>
                    </div>
                    <div>
                      <div className="text-gold font-bold mb-1">Principal Lock</div>
                      <div className="text-beige-muted">Principal is locked until pool ends, then converted to VYR (4% fee).</div>
                    </div>
                    <div>
                      <div className="text-gold font-bold mb-1">12h Grace Period</div>
                      <div className="text-beige-muted">Pool 360 accelerator: re-stake within 12h to claim pending commissions.</div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-dark-border bg-dark-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Pool</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Daily</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Monthly</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Min</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Starter', '30 days', '0.11%', '~3.5%', '$50', '$100'],
                        ['Growth', '60 days', '0.23%', '~7%', '$50', '$250'],
                        ['Pro', '180 days', '0.33%', '~10%', '$50', '$500'],
                        ['Elite', '360 days', '0.50%', '~15%', '$100', 'No limit'],
                      ].map(([tier, dur, daily, monthly, mn, mx]) => (
                        <tr key={tier} className="border-b border-dark-border/50 last:border-0">
                          <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold text-white">{tier}</td>
                          <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-beige">{dur}</td>
                          <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-beige">{daily}</td>
                          <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-bold text-gold">{monthly}</td>
                          <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-beige">{mn}</td>
                          <td className="px-2 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-beige">{mx}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>

              {/* Accelerator */}
              <motion.section variants={fadeUp} id="accelerator" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.accelerator')}</h2>
                <p className="text-beige leading-relaxed mb-4">
                  Requires an active Elite (360-day) stake. Each referral&apos;s deposit — in <span className="text-gold font-bold">any pool</span> (Starter, Growth, Pro or Elite) — pays you <span className="text-gold font-bold">10% in USDT instantly</span> and adds 10% of their amount to your accelerator progress. When accumulated referrals reach <span className="text-gold font-bold">100% of your stake</span>, you unlock early withdrawal of your earnings.
                </p>
                <div className="rounded-xl bg-dark-card border border-gold/30 p-5 mb-4">
                  <div className="text-sm font-bold text-gold mb-2">12-Hour Grace Period</div>
                  <div className="text-xs text-beige-muted">When your accelerator reaches 100% and auto-liquidates, you have <span className="text-gold font-bold">12 hours</span> to open a new Pool 360 stake. During this window, commissions are held pending — re-stake in time to claim them all. Miss the window, and pending commissions are lost.</div>
                </div>
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
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.affiliates')}</h2>
                <p className="text-beige leading-relaxed mb-4">
                  Residual commissions on <span className="text-gold font-bold">daily yield</span> (never principal) from your entire network across <span className="text-gold font-bold">all 4 pools</span>. When a downline member claims daily earnings, the commission is instantly distributed to qualified uplines in VYR.
                </p>
                <div className="rounded-xl bg-dark-card border border-gold/30 p-5 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gold font-bold mb-1">How it works</div>
                      <div className="text-beige-muted">Commissions are calculated on the <span className="text-gold">daily profit</span> of your referrals, not their stake amount. If a referral earns $5/day, you get 7% = $0.35/day.</div>
                    </div>
                    <div>
                      <div className="text-gold font-bold mb-1">Qualification</div>
                      <div className="text-beige-muted">Requires an <span className="text-gold">active Elite (360-day) stake</span> to receive. Downline members in <span className="text-gold">any pool</span> (Starter, Growth, Pro, Elite) generate commissions for their upline.</div>
                    </div>
                    <div>
                      <div className="text-gold font-bold mb-1">Level Requirements</div>
                      <div className="text-beige-muted">Each level requires a number of <span className="text-gold">direct referrals with at least $100 staked</span> (1 direct for Level 1, up to 11 for Level 11). Your staking amount is the <span className="text-gold">sum of all active stakes</span> — accumulate from $100 up to $1,100 to unlock all 11 levels.</div>
                    </div>
                    <div>
                      <div className="text-gold font-bold mb-1">Dynamic Levels</div>
                      <div className="text-beige-muted">Levels are recalculated in real time: if your stakes (or your directs' stakes) expire or are withdrawn, you automatically return to the previous level — and rise again with new stakes.</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-beige-muted mb-4">A 4% fee applies to USDT accelerator commissions, split equally between the 4 project wallets (Collaborators, Infrastructure, Development, Marketing).</p>
                <div className="overflow-x-auto rounded-2xl border border-dark-border bg-dark-card mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dark-border">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Commission</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Min Stake</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gold">Min Direct Refs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['1', '7%', '$100', '1'],
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
                          <td className="px-4 py-2 text-sm text-beige">{refs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.section>

              {/* Presale */}
              <motion.section variants={fadeUp} id="presale" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.presale')}</h2>
                <p className="text-beige leading-relaxed mb-6">
                  Presale features 2 phases at increasing prices, with a launch price of $0.03 on DEX listing. Phase duration is determined by the project team.
                </p>
                <div className="space-y-3">
                  {[
                    ['Presale Allocation', '30% (300M VYR)'],
                    ['Phase 1 Price', '$0.01'],
                    ['Phase 2 Price', '$0.02'],
                    ['Launch Price', '$0.03 (DEX)'],
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
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.ecosystem')}</h2>
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
                <h2 className="text-2xl font-bold text-white mb-4">{t('wp.security')}</h2>
                <ul className="space-y-3">
                  {[
                    'Smart contract audit before mainnet deployment',
                    'Chainlink Price Feed oracle for reliable, manipulation-resistant pricing',
                    'Automatic on-chain fund distribution eliminates centralized custody risk',
                    'Progressive qualification system in affiliate program prevents abuse',
                    'Timelock and multi-sig on admin functions',
                  ].map((item) => (
                    <li className="flex items-start gap-3 text-beige">
                            <Shield className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                            <span className="text-sm">Smart contracts with timelock and multi-sig on admin functions</span>
                          </li>
                  ))}
                </ul>
              </motion.section>

              {/* Disclaimer */}
              <motion.section variants={fadeUp} id="disclaimer" className="scroll-mt-24">
                <div className="rounded-2xl border border-dark-border bg-dark-card/50 p-6">
                  <h2 className="text-xl font-bold text-white mb-3">{t('wp.disclaimer')}</h2>
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
