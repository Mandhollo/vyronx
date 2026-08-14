import io

p = 'lib/i18n.tsx'
s = io.open(p, encoding='utf-8').read()

en = "    'nav.auction': 'Auction',"
en_block = """    'nav.auction': 'Auction',
    'auc.title': 'Penny Auction',
    'auc.subtitle': 'Every bid costs $1 and raises the price by just 1 cent. Last bidder when the clock hits zero wins the prize paying cents.',
    'auc.live': 'Live Auctions',
    'auc.none': 'No active auctions right now. New drops coming soon!',
    'auc.prize': 'Prize Value',
    'auc.current': 'Current Price',
    'auc.bids': 'Bids',
    'auc.lastBidder': 'Last Bidder',
    'auc.goal': 'Goal Progress',
    'auc.placeBid': 'PLACE BID — $1',
    'auc.connectFirst': 'Connect wallet to bid',
    'auc.noCredits': 'No bid credits — buy a pack below',
    'auc.winLimit': 'Weekly win limit reached',
    'auc.paused': 'Auction paused',
    'auc.buyTitle': 'Buy Bid Packs',
    'auc.buySub': '1 bid = $1. Use USDT or your unilevel VYR balance (+10% bonus).',
    'auc.withUSDT': 'Buy with USDT',
    'auc.withVYR': 'Buy with VYR balance (+10%)',
    'auc.credits': 'Your Bid Credits',
    'auc.vyrBalance': 'VYR Balance',
    'auc.approveFirst': 'Approve first',
    'auc.buy': 'Buy',
    'auc.howTitle': 'How It Works',
    'auc.how1': 'Each bid costs $1 and increases the price by only $0.01.',
    'auc.how2': 'Every bid resets the clock. The closer to the goal, the faster: 20s → 15s → 10s → 7s → 5s → 3s.',
    'auc.how3': 'When the clock hits zero, the last bidder wins and pays the final price (just cents).',
    'auc.how4': 'Lost bids are consumed. 40% of all revenue buys back and burns $VYR.',
    'auc.won': 'You won! Claim your prize',
    'auc.claimTitle': 'Claim Prize',
    'auc.claimSub': 'Pay the final price and receive the full prize in USDT.',
    'auc.finalized': 'Ended',
    'auc.timer': 'Time Left',"""

pt_anchor = "    'nav.auction': 'Leilão',"
pt_block = """    'nav.auction': 'Leilão',
    'auc.title': 'Leilão de Centavos',
    'auc.subtitle': 'Cada lance custa $1 e aumenta o preço em apenas 1 centavo. O último a lancear quando o cronômetro zerar leva o prêmio pagando centavos.',
    'auc.live': 'Leilões ao Vivo',
    'auc.none': 'Nenhum leilão ativo agora. Novos prêmios em breve!',
    'auc.prize': 'Valor do Prêmio',
    'auc.current': 'Preço Atual',
    'auc.bids': 'Lances',
    'auc.lastBidder': 'Último Lanceiro',
    'auc.goal': 'Progresso da Meta',
    'auc.placeBid': 'DAR LANCE — $1',
    'auc.connectFirst': 'Conecte a carteira para lancear',
    'auc.noCredits': 'Sem créditos — compre um pacote abaixo',
    'auc.winLimit': 'Limite de vitórias da semana atingido',
    'auc.paused': 'Leilão pausado',
    'auc.buyTitle': 'Comprar Pacotes de Lances',
    'auc.buySub': '1 lance = $1. Use USDT ou seu saldo VYR do unilevel (+10% de bônus).',
    'auc.withUSDT': 'Comprar com USDT',
    'auc.withVYR': 'Comprar com saldo VYR (+10%)',
    'auc.credits': 'Seus Créditos de Lance',
    'auc.vyrBalance': 'Saldo VYR',
    'auc.approveFirst': 'Aprove primeiro',
    'auc.buy': 'Comprar',
    'auc.howTitle': 'Como Funciona',
    'auc.how1': 'Cada lance custa $1 e aumenta o preço em apenas $0,01.',
    'auc.how2': 'Cada lance reseta o cronômetro. Quanto mais perto da meta, mais rápido: 20s → 15s → 10s → 7s → 5s → 3s.',
    'auc.how3': 'Quando o cronômetro zerar, o último lanceiro ganha e paga o preço final (centavos).',
    'auc.how4': 'Lances perdidos são consumidos. 40% de toda receita compra e queima $VYR.',
    'auc.won': 'Você ganhou! Resgate seu prêmio',
    'auc.claimTitle': 'Resgatar Prêmio',
    'auc.claimSub': 'Pague o preço final e receba o prêmio integral em USDT.',
    'auc.finalized': 'Encerrado',
    'auc.timer': 'Tempo Restante',"""

es_anchor = "    'nav.auction': 'Subasta',"
es_block = """    'nav.auction': 'Subasta',
    'auc.title': 'Subasta de Centavos',
    'auc.subtitle': 'Cada puja cuesta $1 y sube el precio solo 1 centavo. El último en pujar cuando el cronómetro llegue a cero se lleva el premio pagando centavos.',
    'auc.live': 'Subastas en Vivo',
    'auc.none': 'No hay subastas activas ahora. ¡Nuevos premios pronto!',
    'auc.prize': 'Valor del Premio',
    'auc.current': 'Precio Actual',
    'auc.bids': 'Pujas',
    'auc.lastBidder': 'Último Pujador',
    'auc.goal': 'Progreso de la Meta',
    'auc.placeBid': 'PUJAR — $1',
    'auc.connectFirst': 'Conecta la cartera para pujar',
    'auc.noCredits': 'Sin créditos — compra un paquete abajo',
    'auc.winLimit': 'Límite de victorias semanales alcanzado',
    'auc.paused': 'Subasta pausada',
    'auc.buyTitle': 'Comprar Paquetes de Pujas',
    'auc.buySub': '1 puja = $1. Usa USDT o tu saldo VYR del unilevel (+10% de bono).',
    'auc.withUSDT': 'Comprar con USDT',
    'auc.withVYR': 'Comprar con saldo VYR (+10%)',
    'auc.credits': 'Tus Créditos de Puja',
    'auc.vyrBalance': 'Saldo VYR',
    'auc.approveFirst': 'Aprueba primero',
    'auc.buy': 'Comprar',
    'auc.howTitle': 'Cómo Funciona',
    'auc.how1': 'Cada puja cuesta $1 y sube el precio solo $0,01.',
    'auc.how2': 'Cada puja reinicia el cronómetro. Cuanto más cerca de la meta, más rápido: 20s → 15s → 10s → 7s → 5s → 3s.',
    'auc.how3': 'Cuando el cronómetro llegue a cero, el último pujador gana y paga el precio final (centavos).',
    'auc.how4': 'Pujas perdidas se consumen. 40% de todos los ingresos compra y quema $VYR.',
    'auc.won': '¡Ganaste! Reclama tu premio',
    'auc.claimTitle': 'Reclamar Premio',
    'auc.claimSub': 'Paga el precio final y recibe el premio íntegro en USDT.',
    'auc.finalized': 'Finalizada',
    'auc.timer': 'Tiempo Restante',"""

assert en in s, 'EN anchor missing'
s = s.replace(en, en_block, 1)
assert pt_anchor in s, 'PT anchor missing'
s = s.replace(pt_anchor, pt_block, 1)
assert es_anchor in s, 'ES anchor missing'
s = s.replace(es_anchor, es_block, 1)

io.open(p, 'w', encoding='utf-8').write(s)
print('OK — auc keys:', s.count("'auc."))
