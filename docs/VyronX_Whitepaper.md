# 🟨 VyronX ($VYR)

## Whitepaper v1.0

---

## 1. Introdução

O **VyronX ($VYR)** é um ecossistema DeFi construído na BNB Smart Chain (BEP-20) que combina tecnologia de inteligência artificial, mecanismos de staking inovadores e um modelo de distribuição de valor transparente e automatizado. O projeto tem como objetivo criar uma plataforma sustentável onde investidores podem participar de pools de staking com rendimentos diferenciados, beneficiar-se de um sistema de afiliados com comissões residuais de até 11 níveis, e acessar um ecossistema crescente de utilidades que inclui arbitragem automatizada por IA, buyback estratégico, mercado preditivo e um launchpad para futuros tokens de governança.

### 1.1 Visão

Tornar-se uma plataforma DeFi de referência, onde tecnologia de ponta (IA, automação, oracles) e mecanismos financeiros inovadores se encontram para entregar valor real e sustentável aos participantes do ecossistema.

### 1.2 Missão

Democratizar o acesso a instrumentos financeiros descentralizados sofisticados — arbitragem automatizada, staking com rendimentos diferenciados, mercado preditivo e launchpad — através de uma plataforma intuitiva, transparente e construída sobre a segurança da BNB Smart Chain.

---

## 2. O Problema

O mercado DeFi atual enfrenta desafios significativos:

- **Falta de transparência:** Muitos projetos operam sem clareza sobre a origem dos rendimentos ou o destino dos recursos arrecadados.
- **Modelos de staking limitados:** A maioria das plataformas oferece apenas staking simples, sem opções de flexibilidade ou mecanismos de incentivo à indicação.
- **Distribuição de valor centralizada:** Os recursos arrecadados em pré-vendas frequentemente são controlados por uma única entidade, sem mecanismos automáticos de distribuição.
- **Escassez de utilidade real:** Muitos tokens não possuem utilidades concretas além da especulação.
- **Barreira de entrada:** Ferramentas como arbitragem automatizada e mercado preditivo são inacessíveis para o investidor comum.

---

## 3. A Solução

O VyronX resolve esses problemas através de um ecossistema integrado que combina:

1. **Token com mecanismo de taxas dual** — taxas de entrada e saída com destinos específicos e automatizados (rewards, liquidez, burn e wallets do projeto).
2. **4 Pools de Staking** — com diferentes durações e rendimentos, flexibilidade total via painel admin, entrada em USDT e saída em VYR via oracle de preço.
3. **Acelerador de retirada** — mecanismo exclusivo da Pool de 360 dias onde indicações aceleram a liberação antecipada dos rendimentos.
4. **Plano de afiliados de 11 níveis** — comissão residual sobre o lucro da rede, com qualificação progressiva baseada em aporte e indicações.
5. **Distribuição automática da pré-venda** — recursos distribuídos automaticamente a cada 48 horas para 7 wallets com destinos específicos e transparentes.
6. **Ecossistema de utilidades** — IA para arbitragem, buyback, leilão de centavos, fundo de investimentos, mercado preditivo e launchpad.

---

## 4. Token — VyronX ($VYR)

| Especificação | Detalhe |
|---------------|---------|
| **Nome** | VyronX |
| **Símbolo / Ticker** | VYR |
| **Padrão** | BEP-20 |
| **Rede** | BNB Smart Chain |
| **Supply Total** | 1.000.000.000 VYR (1 Bilhão) |
| **Decimais** | 18 |

---

## 5. Tokenomics

### 5.1 Distribuição do Supply

| Destino | % | Quantidade (VYR) |
|---------|---|-------------------|
| **Pré-venda** | 30% | 300.000.000 |
| **Liquidez (LP)** | 20% | 200.000.000 |
| **Staking Pools** | 50% | 500.000.000 |
| **Total** | **100%** | **1.000.000.000** |

### 5.2 Justificativa das Alocações

- **Pré-venda (30%):** Garante capital inicial para desenvolvimento, marketing e estruturação do projeto, distribuído para a comunidade早期.
- **Liquidez (20%):** Assegura liquidez robusta nas DEXs (PancakeSwap), proporcionando negociação fluida e preço estável.
- **Staking Pools (50%):** Reserva substancial que sustenta todo o sistema de staking — é desta reserva que os rendimentos são distribuídos aos investidores na forma de tokens VYR.

---

## 6. Mecanismo de Taxas

O token VYR implementa um sistema de taxas dual que beneficia tanto o investidor quanto o ecossistema:

### 6.1 Taxa de Entrada (Compra) — 8%

Toda compra de VYR incide uma taxa de 8%, distribuída da seguinte forma:

| Destino | % | Função |
|---------|---|--------|
| **Rewards (Stake no próprio token)** | 4% | Distribuído aos holders/stakers como recompensa passiva |
| **Liquidez (Auto-Liquidity)** | 2% | Adicionada automaticamente ao pool de liquidez |
| **Burn (Queima Permanente)** | 2% | Tokens queimados permanentemente, reduzindo o supply |

### 6.2 Taxa de Saída (Venda) — 8% em BNB

Toda venda de VYR incide uma taxa de 8%, que é convertida em BNB e distribuída igualmente para 4 wallets:

| Wallet | % |
|--------|---|
| Wallet 1 | 2% |
| Wallet 2 | 2% |
| Wallet 3 | 2% |
| Wallet 4 | 2% |

> **Nota técnica:** A conversão para BNB ocorre automaticamente no contrato via swap no momento da venda.

---

## 7. Staking Pools

O VyronX oferece 4 pools de staking com durações e rendimentos diferenciados. Todos os rendimentos são ajustáveis via Painel Admin no momento da abertura de cada pool.

### 7.1 Pools Disponíveis

| Pool | Duração | Rendimento Diário | Rendimento Mensal Aprox. |
|------|---------|-------------------|--------------------------|
| Pool 1 | 30 dias | 0,11% | ~3,5% |
| Pool 2 | 60 dias | 0,23% | ~7% |
| Pool 3 | 180 dias | 0,33% | ~10% |
| Pool 4 | 360 dias | 0,5% | ~15% |

> Os rendimentos acima são valores de referência. A equipe pode ajustá-los ao abrir novas pools conforme as condições de mercado.

### 7.2 Mecânica de Funcionamento

| Etapa | Detalhe |
|-------|---------|
| **Entrada** | O investidor deposita **USDT** na pool escolhida |
| **Período** | O capital fica bloqueado pela duração da pool |
| **Rendimentos** | Acumulam diariamente com base na taxa da pool |
| **Saída** | O investidor recebe **VYR** (convertido via Oracle de preço de mercado) |
| **Origem do VYR** | Reserva do contrato (500M alocados para Staking Pools) |
| **Destino dos USDT** | Wallet do projeto para reinvestimento no ecossistema |

### 7.3 Conversão via Oracle

A conversão de USDT para VYR na retirada é feita utilizando o **preço de mercado em tempo real via Oracle (Chainlink Price Feed)**. Isso garante:

- **Transparência:** O preço não pode ser manipulado.
- **Precisão:** O investidor recebe o valor justo no momento exato da retirada.
- **Fórmula:** `VYR = ValorUSDT / PreçoVyronX`

---

## 8. Acelerador de Retirada (Pool 360 Dias)

Exclusivo para a Pool de 360 dias, o **Acelerador** é um mecanismo que permite ao investidor antecipar a retirada de seus rendimentos com base em indicações.

### 8.1 Como Funciona

- Cada indicação que entra na Pool de 360 dias gera uma aceleração de **10% sobre o valor depositado pelo indicado**.
- Essa aceleração é somada ao acumulado do indicador.
- Quando o acumulado atinge **100% do valor stakeado pelo indicador**, ele pode retirar seus rendimentos antecipadamente.

### 8.2 Exemplo Prático

Investidor stakeia **$100** na Pool de 360 dias:

| Indicação | Depósito do Indicado | 10% (Aceleração) | Acumulado | % do Stake |
|-----------|---------------------|-------------------|-----------|-------------|
| 1ª | $200 | $20 | $20 | 20% |
| 2ª | $500 | $50 | $70 | 70% |
| 3ª | $300 | $30 | $100 | **100% — LIBERADO** |

Neste cenário, com 3 indicações totalizando $1.000 em depósitos, o investidor atinge 100% de aceleração e pode retirar seus rendimentos antes de completar os 360 dias.

---

## 9. Plano de Afiliados (Pool 360 Dias)

O VyronX possui um sistema de afiliados com **11 níveis de comissão residual** sobre o **lucro** dos investidores da rede (exclusivo para a Pool de 360 dias).

### 9.1 Estrutura de Comissões

| Nível | Comissão | Aporte Pessoal Mín. | Diretos Ativos Mín. |
|-------|----------|---------------------|----------------------|
| 1º | 7% | $100 | — |
| 2º | 6% | $200 | 2 × $100 |
| 3º | 5% | $300 | 3 × $100 |
| 4º | 4% | $400 | 4 × $100 |
| 5º | 3% | $500 | 5 × $100 |
| 6º | 2% | $600 | 6 × $100 |
| 7º | 2% | $700 | 7 × $100 |
| 8º | 2% | $800 | 8 × $100 |
| 9º | 2% | $900 | 9 × $100 |
| 10º | 2% | $1.000 | 10 × $100 |
| 11º | 7% | $1.100 | 11 × $100 |

### 9.2 Regras de Qualificação

- As comissões são calculadas **sempre sobre o LUCRO**, nunca sobre o valor principal investido.
- Cada nível requer um **aporte pessoal mínimo** e um número mínimo de **indicados diretos ativos** (com pelo menos $100 cada).
- O investidor só recebe comissão dos níveis para os quais está qualificado.

### 9.3 Exemplo Prático

Um investidor no 1º nível aplica **$1.000** por 360 dias. Ao final do período, obtém um lucro de **$1.800**.

- O afiliado (upline) no 1º nível recebe: **7% de $1.800 = $126**

---

## 10. Pré-venda e Distribuição

### 10.1 Visão Geral

A pré-venda do VYR ocorre diretamente na plataforma web, com os recursos arrecadados distribuídos de forma **automática e transparente** a cada **48 horas** para 7 wallets com destinos específicos.

### 10.2 Distribuição dos Recursos Arrecadados

| Destino | % | Finalidade |
|---------|---|------------|
| **Marketing** | 10% | Promoção, parcerias, divulgação |
| **LP Inicial** | 15% | Formação de liquidez nas DEXs |
| **Buyback** | 15% | Recompra estratégica do token |
| **Estrutura e Tecnologia** | 20% | Infraestrutura, servidores, segurança |
| **Desenvolvimento** | 40% | Dividido igualmente (10% cada) entre as 4 wallets do time |
| **Total** | **100%** | — |

### 10.3 Mecanismo de Distribuição Automática (48h)

A distribuição ocorre automaticamente a cada **48 horas**, enviando os recursos acumulados para as 7 wallets designadas. Esta abordagem:

- **Reduz taxas de rede:** Evita múltiplas transações desnecessárias.
- **Garante transparência:** Todos podem verificar os envios on-chain.
- **Assegura disciplina financeira:** Nenhum valor fica retido sem destino.

---

## 11. Ecossistema e Roadmap

### 11.1 Utilidades Planejadas

| # | Utilidade | Descrição |
|---|-----------|-----------|
| 1 | **Agentes de IA — Arbitragem** | Bots de IA que realizam arbitragem de criptomoedas com operações visíveis em tempo real na plataforma |
| 2 | **Taxas de Rede** | Receita proveniente das taxas operacionais do ecossistema |
| 3 | **Buyback com Deságio** | Recompra do próprio token VYR com desconto estratégico |
| 4 | **Leilão de Centavos** | Mecânica de leilão onde usuários disputam o token pagando centavos |
| 5 | **Fundo de Investimentos** | Fundo destinado a investimentos diversos, gerando receita para o ecossistema |
| 6 | **Mercado Preditivo** | Plataforma de previsão on-chain |
| 7 | **Launchpad** | Plataforma de lançamento de futuros tokens de governança com distribuição via airdrop |

### 11.2 Roadmap

| Fase | Entregáveis | Status |
|------|------------|--------|
| **Fase 1 — Fundação** | Token VYR deploy, Pré-venda, LP na DEX, Plataforma Web (Home) | Planejada |
| **Fase 2 — Staking** | 4 Pools operacionais, Painel Admin, Acelerador, Afiliados 11 níveis | Planejada |
| **Fase 3 — IA & Arbitragem** | Agentes de IA com dashboard de operações em tempo real | Planejada |
| **Fase 4 — Buyback & Leilão** | Mecanismo de buyback com deságio + Leilão de centavos | Planejada |
| **Fase 5 — Fundo & Preditivo** | Fundo de investimentos + Mercado preditivo | Planejada |
| **Fase 6 — Launchpad** | Lançamento de tokens de governança + Airdrops | Planejada |

---

## 12. Tecnologia

### 12.1 Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| **Blockchain** | BNB Smart Chain (BEP-20) |
| **Smart Contracts** | Solidity + Hardhat |
| **Oracle** | Chainlink Price Feed |
| **Frontend** | Next.js + Tailwind CSS |
| **Web3** | wagmi/viem + Web3Modal |
| **Backend** | Supabase (Auth, Database, Admin) |
| **Deploy** | Vercel |

### 12.2 Identidade Visual

| Cor | Uso |
|-----|-----|
| **Dark (Preto)** | Predominante — fundo principal |
| **Gold (#D4AF37)** | Cor de marca, destaques, botões, headers |
| **Green Musgo Escuro** | Pequenos detalhes, separadores, ícones |
| **Bege** | Textos secundários, cards |
| **Branco** | Textos principais, contraste |

---

## 13. Segurança

- **Auditoria de Smart Contracts** antes do deploy principal.
- **Oracle Chainlink** para preços confiáveis e à prova de manipulação.
- **Distribuição automática on-chain** elimina risco de custódia centralizada.
- **Sistema de qualificação progressiva** no plano de afiliados previne abuso.

---

## 14. Considerações Finais

O **VyronX ($VYR)** representa uma nova geração de projetos DeFi que combinam tecnologia avançada, mecanismos financeiros inovadores e um modelo de distribuição de valor transparente. Com um ecossistema que vai desde staking com rendimentos diferenciados até arbitragem por IA, buyback estratégico e um launchpad para futuros tokens, o VyronX está posicionado para entregar utilidade real e sustentabilidade a longo prazo.

A combinação de taxas estratégicas (com rewards, burn e liquidez automática), um plano de afiliados robusto de 11 níveis, o acelerador de retirada exclusivo e a distribuição automática da pré-venda cria um ecossistema onde todos os participantes são incentivados a permanecer e contribuir para o crescimento da plataforma.

---

## Disclaimer

Este whitepaper é um documento informativo e não constitui aconselhamento financeiro, legal ou tributário. A participação em projetos DeFi envolve riscos inerentes. Os investidores devem realizar sua própria pesquisa (DYOR — Do Your Own Research) antes de tomar qualquer decisão de investimento. As taxas, rendimentos e mecanismos descritos podem ser ajustados pela equipe conforme as condições de mercado e as necessidades do ecossistema. Tokens VYR não representam participação acionária, dívida ou qualquer forma de direito sobre a entidade desenvolvedora.

---

**VyronX ($VYR)** — Whitepaper v1.0
© 2026 VyronX. Todos os direitos reservados.
