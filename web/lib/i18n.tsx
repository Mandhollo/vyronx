'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'en' | 'pt' | 'es';

// ════════════════════════════════════════════════════════════
// TRANSLATION DICTIONARY
// ════════════════════════════════════════════════════════════
const DICT: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    'nav.home': 'Home',
    'nav.presale': 'Presale',
    'nav.staking': 'Staking',
    'nav.dashboard': 'Dashboard',
    'nav.admin': 'Admin',
    'nav.whitepaper': 'Whitepaper',
    'nav.roadmap': 'Roadmap',
    'nav.connect': 'Connect Wallet',
    'nav.buy': 'Buy $VYR',
    // Hero
    'hero.badge': 'Presale Live Soon',
    'hero.tagline': 'The Next-Generation',
    'hero.tagline2': 'DeFi Ecosystem',
    'hero.tagline3': 'Powered by Artificial Intelligence',
    'hero.subtitle': 'AI arbitrage agents • Multi-tier staking pools • Buyback & burn • Predictive markets • Launchpad',
    'hero.cta1': 'Join Presale',
    'hero.cta2': 'Read Whitepaper',
    // Stats
    'stats.supply': 'TOTAL SUPPLY',
    'stats.apy': 'MAX MONTHLY APY',
    'stats.pools': 'STAKING POOLS',
    'stats.levels': 'AFFILIATE LEVELS',
    // Sections
    'section.ecosystem': 'ECOSYSTEM',
    'section.ecosystem.title': 'A Complete DeFi Powerhouse',
    'section.ecosystem.desc': 'Seven powerful utilities that create sustained demand and real value for the $VYR token.',
    'section.tokenomics': 'TOKENOMICS',
    'section.tokenomics.title': 'Built for Sustainability',
    'section.tokenomics.desc': '1 billion fixed supply with a transparent, utility-driven allocation.',
    'section.staking': 'STAKING',
    'section.staking.title': 'Earn Up to 15% Monthly',
    'section.staking.desc': 'Four staking tiers designed for every investor. Stake USDT, earn VYR at market price via Chainlink oracle.',
    'section.roadmap': 'ROADMAP',
    'section.roadmap.title': 'The Path Forward',
    'section.roadmap.desc': 'A phased approach to building a comprehensive DeFi ecosystem.',
    // Features
    'feat.ai': 'AI Arbitrage Agents',
    'feat.staking': 'Multi-Tier Staking',
    'feat.buyback': 'Buyback & Burn',
    'feat.predictive': 'Predictive Markets',
    'feat.launchpad': 'Launchpad',
    'feat.secure': 'Secure & Transparent',
    // Pools
    'pool.starter': 'STARTER',
    'pool.growth': 'GROWTH',
    'pool.pro': 'PRO',
    'pool.elite': 'ELITE',
    'pool.monthly': 'Monthly Return',
    'pool.daily': 'Daily Rate',
    'pool.lock': 'Lock Period',
    'pool.days': 'days',
    'pool.bestrating': 'Best Rate',
    'pool.viewall': 'View Staking Details',
    // CTA
    'cta.title': 'Ready to Join VyronX?',
    'cta.contact': 'Contact Us',
    // Footer
    'footer.tagline': 'AI-powered DeFi ecosystem on BNB Smart Chain. Stake, earn, and participate in the future of decentralized finance.',
    'footer.platform': 'PLATFORM',
    'footer.resources': 'RESOURCES',
    'footer.contact': 'CONTACT',
    'footer.disclaimer': 'Disclaimer',
    // Presale
    'presale.title': 'Buy',
    'presale.subtitle': 'at the Best Price',
    'presale.amount': 'Amount (USDT)',
    'presale.receive': 'You Receive',
    'presale.price': 'Presale Price',
    'presale.buy': 'Buy VYR',
    'presale.approving': 'Approving...',
    'presale.buying': 'Buying...',
    'presale.connect': 'Connect your wallet to buy',
    // Staking
    'staking.title': 'Staking Pools',
    'staking.subtitle': 'Stake USDT, Earn VYR',
    'staking.amount': 'Amount (USDT)',
    'staking.min': 'Min: $50',
    'staking.stake': 'Stake Now',
    'staking.approve': 'Approve USDT',
    'staking.connect': 'Connect your wallet to stake',
    'staking.referral': 'Referral Address (optional)',
    // Common
    'common.loading': 'Loading...',
    'common.connect': 'Connect Wallet',
    'common.disconnect': 'Disconnect',
    'common.copy': 'Copy Address',
    'common.view': 'View on BscScan',
  },
  pt: {
    // Nav
    'nav.home': 'Início',
    'nav.presale': 'Pré-venda',
    'nav.staking': 'Staking',
    'nav.dashboard': 'Painel',
    'nav.admin': 'Admin',
    'nav.whitepaper': 'Whitepaper',
    'nav.roadmap': 'Roadmap',
    'nav.connect': 'Conectar Carteira',
    'nav.buy': 'Comprar $VYR',
    // Hero
    'hero.badge': 'Pré-venda em Breve',
    'hero.tagline': 'O Ecossistema',
    'hero.tagline2': 'DeFi de Próxima Geração',
    'hero.tagline3': 'Impulsionado por Inteligência Artificial',
    'hero.subtitle': 'Agentes de arbitragem com IA • Pools de staking multinível • Recompra e queima • Mercados preditivos • Launchpad',
    'hero.cta1': 'Entrar na Pré-venda',
    'hero.cta2': 'Ler Whitepaper',
    // Stats
    'stats.supply': 'FORNECIMENTO TOTAL',
    'stats.apy': 'APY MENSAL MÁXIMO',
    'stats.pools': 'POOLS DE STAKING',
    'stats.levels': 'NÍVEIS DE AFILIADOS',
    // Sections
    'section.ecosystem': 'ECOSSISTEMA',
    'section.ecosystem.title': 'Uma Potência DeFi Completa',
    'section.ecosystem.desc': 'Sete utilidades poderosas que criam demanda sustentada e valor real para o token $VYR.',
    'section.tokenomics': 'TOKENOMICS',
    'section.tokenomics.title': 'Construído para Sustentabilidade',
    'section.tokenomics.desc': '1 bilhão de fornecimento fixo com alocação transparente e orientada por utilidade.',
    'section.staking': 'STAKING',
    'section.staking.title': 'Ganhe Até 15% ao Mês',
    'section.staking.desc': 'Quatro níveis de staking para cada investidor. Stake em USDT, ganhe VYR pelo preço de mercado via oracle Chainlink.',
    'section.roadmap': 'ROADMAP',
    'section.roadmap.title': 'O Caminho a Seguir',
    'section.roadmap.desc': 'Uma abordagem faseada para construir um ecossistema DeFi abrangente.',
    // Features
    'feat.ai': 'Agentes de Arbitragem IA',
    'feat.staking': 'Staking Multinível',
    'feat.buyback': 'Recompra e Queima',
    'feat.predictive': 'Mercados Preditivos',
    'feat.launchpad': 'Launchpad',
    'feat.secure': 'Seguro e Transparente',
    // Pools
    'pool.starter': 'INICIANTE',
    'pool.growth': 'CRESCIMENTO',
    'pool.pro': 'PRO',
    'pool.elite': 'ELITE',
    'pool.monthly': 'Retorno Mensal',
    'pool.daily': 'Taxa Diária',
    'pool.lock': 'Período de Bloqueio',
    'pool.days': 'dias',
    'pool.bestrating': 'Melhor Taxa',
    'pool.viewall': 'Ver Detalhes do Staking',
    // CTA
    'cta.title': 'Pronto para Entrar na VyronX?',
    'cta.contact': 'Fale Conosco',
    // Footer
    'footer.tagline': 'Ecossistema DeFi com IA na BNB Smart Chain. Faça stake, ganhe e participe do futuro das finanças descentralizadas.',
    'footer.platform': 'PLATAFORMA',
    'footer.resources': 'RECURSOS',
    'footer.contact': 'CONTATO',
    'footer.disclaimer': 'Aviso Legal',
    // Presale
    'presale.title': 'Comprar',
    'presale.subtitle': 'no Melhor Preço',
    'presale.amount': 'Valor (USDT)',
    'presale.receive': 'Você Recebe',
    'presale.price': 'Preço da Pré-venda',
    'presale.buy': 'Comprar VYR',
    'presale.approving': 'Aprovando...',
    'presale.buying': 'Comprando...',
    'presale.connect': 'Conecte sua carteira para comprar',
    // Staking
    'staking.title': 'Pools de Staking',
    'staking.subtitle': 'Stake em USDT, Ganhe VYR',
    'staking.amount': 'Valor (USDT)',
    'staking.min': 'Mín: $50',
    'staking.stake': 'Fazer Stake',
    'staking.approve': 'Aprovar USDT',
    'staking.connect': 'Conecte sua carteira para fazer stake',
    'staking.referral': 'Endereço de Indicação (opcional)',
    // Common
    'common.loading': 'Carregando...',
    'common.connect': 'Conectar Carteira',
    'common.disconnect': 'Desconectar',
    'common.copy': 'Copiar Endereço',
    'common.view': 'Ver no BscScan',
  },
  es: {
    // Nav
    'nav.home': 'Inicio',
    'nav.presale': 'Preventa',
    'nav.staking': 'Staking',
    'nav.dashboard': 'Panel',
    'nav.admin': 'Admin',
    'nav.whitepaper': 'Whitepaper',
    'nav.roadmap': 'Roadmap',
    'nav.connect': 'Conectar Billetera',
    'nav.buy': 'Comprar $VYR',
    // Hero
    'hero.badge': 'Preventa Próximamente',
    'hero.tagline': 'El Ecosistema',
    'hero.tagline2': 'DeFi de Próxima Generación',
    'hero.tagline3': 'Impulsado por Inteligencia Artificial',
    'hero.subtitle': 'Agentes de arbitraje con IA • Pools de staking multinivel • Recompra y quema • Mercados predictivos • Launchpad',
    'hero.cta1': 'Unirse a la Preventa',
    'hero.cta2': 'Leer Whitepaper',
    // Stats
    'stats.supply': 'SUMINISTRO TOTAL',
    'stats.apy': 'APY MENSUAL MÁXIMO',
    'stats.pools': 'POOLS DE STAKING',
    'stats.levels': 'NIVELES DE AFILIADOS',
    // Sections
    'section.ecosystem': 'ECOSISTEMA',
    'section.ecosystem.title': 'Una Potencia DeFi Completa',
    'section.ecosystem.desc': 'Siete utilidades poderosas que crean demanda sostenida y valor real para el token $VYR.',
    'section.tokenomics': 'TOKENOMICS',
    'section.tokenomics.title': 'Construido para Sostenibilidad',
    'section.tokenomics.desc': '1 billón de suministro fijo con asignación transparente y orientada por utilidad.',
    'section.staking': 'STAKING',
    'section.staking.title': 'Gana Hasta 15% Mensual',
    'section.staking.desc': 'Cuatro niveles de staking para cada inversor. Stake en USDT, gana VYR al precio de mercado vía oracle Chainlink.',
    'section.roadmap': 'ROADMAP',
    'section.roadmap.title': 'El Camino a Seguir',
    'section.roadmap.desc': 'Un enfoque por fases para construir un ecosistema DeFi integral.',
    // Features
    'feat.ai': 'Agentes de Arbitraje IA',
    'feat.staking': 'Staking Multinivel',
    'feat.buyback': 'Recompra y Quema',
    'feat.predictive': 'Mercados Predictivos',
    'feat.launchpad': 'Launchpad',
    'feat.secure': 'Seguro y Transparente',
    // Pools
    'pool.starter': 'PRINCIPIANTE',
    'pool.growth': 'CRECIMIENTO',
    'pool.pro': 'PRO',
    'pool.elite': 'ELITE',
    'pool.monthly': 'Retorno Mensual',
    'pool.daily': 'Tasa Diaria',
    'pool.lock': 'Período de Bloqueo',
    'pool.days': 'días',
    'pool.bestrating': 'Mejor Tasa',
    'pool.viewall': 'Ver Detalles de Staking',
    // CTA
    'cta.title': '¿Listo para Unirte a VyronX?',
    'cta.contact': 'Contáctanos',
    // Footer
    'footer.tagline': 'Ecosistema DeFi con IA en BNB Smart Chain. Haz stake, gana y participa en el futuro de las finanzas descentralizadas.',
    'footer.platform': 'PLATAFORMA',
    'footer.resources': 'RECURSOS',
    'footer.contact': 'CONTACTO',
    'footer.disclaimer': 'Aviso Legal',
    // Presale
    'presale.title': 'Comprar',
    'presale.subtitle': 'al Mejor Precio',
    'presale.amount': 'Cantidad (USDT)',
    'presale.receive': 'Recibes',
    'presale.price': 'Precio de Preventa',
    'presale.buy': 'Comprar VYR',
    'presale.approving': 'Aprobando...',
    'presale.buying': 'Comprando...',
    'presale.connect': 'Conecta tu billetera para comprar',
    // Staking
    'staking.title': 'Pools de Staking',
    'staking.subtitle': 'Stake en USDT, Gana VYR',
    'staking.amount': 'Cantidad (USDT)',
    'staking.min': 'Mín: $50',
    'staking.stake': 'Hacer Stake',
    'staking.approve': 'Aprobar USDT',
    'staking.connect': 'Conecta tu billetera para hacer stake',
    'staking.referral': 'Dirección de Referido (opcional)',
    // Common
    'common.loading': 'Cargando...',
    'common.connect': 'Conectar Billetera',
    'common.disconnect': 'Desconectar',
    'common.copy': 'Copiar Dirección',
    'common.view': 'Ver en BscScan',
  },
};

// ════════════════════════════════════════════════════════════
// CONTEXT
// ════════════════════════════════════════════════════════════
interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k: string) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vyronx-lang') as Lang;
      if (saved && ['en', 'pt', 'es'].includes(saved)) setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('vyronx-lang', l); } catch {}
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  };

  const t = (key: string) => DICT[lang]?.[key] ?? DICT.en[key] ?? key;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
