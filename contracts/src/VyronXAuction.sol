// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @dev VYR token — burnable (verified on mainnet)
interface IBurnable {
    function burn(uint256 amount) external;
}

/// @dev PancakeSwap V2 Router — minimal interface for USDT→VYR swap
interface IPancakeRouter {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/// @dev Staking V4 price oracle (vyrPriceInUsdt)
interface IPriceOracle {
    function vyrPriceInUsdt() external view returns (uint256);
}

/// @title VyronX Penny Auction — Leilão de Centavos
/// @notice Mecânica:
///         · Lance = $1,00 (USDT ou saldo VYR com +10% bônus)
///         · Cada lance: preço do lote +$0,01 e timer reseta
///         · Timer DINÂMICO conforme arrecadação vs meta (= valor do prêmio):
///           20s (<20%) → 15s (≥20%) → 10s (≥40%) → 7s (≥60%) → 5s (≥80%) → 3s (≥100%)
///         · Timer zera sem novo lance → último lanceiro GANHA:
///           paga o preço final (centavos) e recebe o prêmio em USDT
///         · Sem Buy It Now — lances perdedores são consumidos
///         · Split da receita: 40% buyback VYR (swap+burn metade) / 25% reposição prêmios /
///           20% operação (4 wallets) / 15% rede MLM
///         · Limite de vitórias por wallet/semana
contract VyronXAuction is ReentrancyGuard {
    // ════════════════════════════════════════════════════════════
    // Storage
    // ════════════════════════════════════════════════════════════

    IERC20 public immutable usdt;
    address public owner;

    /// @notice VYR token (buyback + burn + bid-pack purchases with balance)
    IERC20 public vyrToken;
    IBurnable public immutable vyrBurner;
    IPancakeRouter public dexRouter;
    bool public autoBuybackEnabled = true;
    address payable public buybackFallbackWallet;

    /// @notice Staking V4 address — read-only price oracle (vyrPriceInUsdt)
    address public stakingOracle;

    // ── Bid economics ──
    /// @notice Price of one bid in USDT (18 dec). Default $1.00
    uint256 public bidPrice = 1e18;
    /// @notice Price increment per bid (18 dec). Default $0.01
    uint256 public priceIncrement = 1e16;
    /// @notice Starting price of every auction (18 dec). $0.01
    uint256 public constant START_PRICE = 1e16;

    // ── Dynamic timer tiers (configurable seconds) ──
    /// @notice timerSeconds[0]=<20% meta, [1]=≥20%, [2]=≥40%, [3]=≥60%, [4]=≥80%, [5]=≥100%
    uint16[6] public timerSeconds = [20, 15, 10, 7, 5, 3];

    // ── Revenue split (bps, must sum 10000) ──
    uint256 public buybackShareBps = 4000;  // 40% — swap USDT→VYR, burn half, half to treasury
    uint256 public prizePoolShareBps = 2500; // 25% — stays in contract to fund future prizes
    uint256 public walletShareBps = 2000;   // 20% — 4 fee wallets (5% each)
    uint256 public mlmShareBps = 1500;      // 15% — network rewards wallet

    address payable[4] public feeWallets;   // Collaborators / Infrastructure / Development / Marketing
    address payable public mlmWallet;       // rede MLM (cashback/acelerador)
    address payable public treasuryWallet;  // receives half of bought-back VYR + half of VYR bid-packs

    // ── Anti-abuse ──
    /// @notice Max auction wins per wallet per week. 0 = unlimited.
    uint256 public weeklyWinLimit = 3;
    mapping(address => mapping(uint256 => uint256)) public winsPerWeek; // user => week => count

    // ── Bid credits (internal, non-transferable) ──
    mapping(address => uint256) public bidBalance;
    /// @notice Bonus bps when buying bid packs with VYR (unilevel balance). Default 10%
    uint256 public vyBonusBps = 1000;

    /// @notice Prize pool accounting: USDT inside the contract available to fund prizes
    uint256 public availablePrizeFunds;
    /// @notice USDT locked for prizes of open/completed-unclaimed auctions
    uint256 public lockedPrizeFunds;

    // ── Auctions ──
    enum Status { Active, Completed, Cancelled }

    struct Auction {
        uint256 prizeUsdt;      // [0] prize value in USDT (18 dec) = arrecadação meta
        uint256 currentPrice;   // [1] current price (starts $0.01, +$0.01/bid)
        uint256 bidCount;       // [2] total bids placed
        address lastBidder;     // [3] last bidder (winner if finalized with bids)
        address winner;         // [4] set at finalize (0 if no bids)
        uint256 startTime;      // [5]
        uint256 endTime;        // [6] current countdown target (reset on every bid)
        uint256 finalizeTime;   // [7] set at finalize — claim deadline base
        uint256 finalPricePaid; // [8] amount winner paid at claim
        bool prizeClaimed;      // [9]
        Status status;          // [10]
    }

    uint256 public nextAuctionId;
    mapping(uint256 => Auction) public auctions;
    uint256[] public activeAuctionIds;

    /// @notice Auction metadata — illustrative image URL + title (set/edited by owner)
    mapping(uint256 => string) public auctionTitle;
    mapping(uint256 => string) public auctionImage;

    /// @notice Winner must claim within 7 days of finalize
    uint256 public constant CLAIM_WINDOW = 7 days;

    bool public paused;

    // ── Global stats ──
    uint256 public totalBidsPlaced;
    uint256 public totalUsdtRevenue;
    uint256 public totalBuybackUsdt;
    uint256 public totalVyrBurned;

    // ════════════════════════════════════════════════════════════
    // Events
    // ════════════════════════════════════════════════════════════

    event AuctionOpened(uint256 indexed auctionId, uint256 prizeUsdt, uint256 endTime);
    event AuctionMetaUpdated(uint256 indexed auctionId, string title, string image);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 newPrice, uint256 endTime, uint256 windowSeconds);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint256 bidCount, uint256 revenueUsdt);
    event AuctionCancelled(uint256 indexed auctionId);
    event PrizeClaimed(uint256 indexed auctionId, address indexed winner, uint256 prizeUsdt, uint256 finalPricePaid);
    event PrizeExpired(uint256 indexed auctionId, uint256 prizeUsdt);
    event BidPackBoughtUSDT(address indexed user, uint256 bidCount, uint256 costUsdt);
    event BidPackBoughtVYR(address indexed user, uint256 vyrIn, uint256 bidCount, uint256 vyrBurned);
    event BuybackSwappedAndBurned(uint256 indexed auctionId, uint256 usdtIn, uint256 vyrOut, uint256 vyrBurned);
    event BuybackFallback(uint256 indexed auctionId, uint256 usdtAmount);
    event PrizePoolFunded(address indexed from, uint256 amount);
    event ConfigUpdated(string param);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ════════════════════════════════════════════════════════════
    // Modifiers
    // ════════════════════════════════════════════════════════════

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════

    constructor(
        address _usdt,
        address _owner,
        address _vyrToken,
        address _dexRouter,
        address _stakingOracle,
        address payable[4] memory _feeWallets,
        address payable _mlmWallet,
        address payable _treasuryWallet,
        address payable _buybackFallbackWallet
    ) {
        require(_usdt != address(0), "USDT zero");
        require(_owner != address(0), "Owner zero");
        require(_vyrToken != address(0), "VYR zero");
        require(_stakingOracle != address(0), "Oracle zero");
        require(_buybackFallbackWallet != address(0), "Buyback zero");
        usdt = IERC20(_usdt);
        owner = _owner;
        vyrToken = IERC20(_vyrToken);
        vyrBurner = IBurnable(_vyrToken);
        dexRouter = IPancakeRouter(_dexRouter);
        stakingOracle = _stakingOracle;
        feeWallets = _feeWallets;
        mlmWallet = _mlmWallet;
        treasuryWallet = _treasuryWallet;
        buybackFallbackWallet = _buybackFallbackWallet;
        emit OwnershipTransferred(address(0), _owner);
    }

    // ════════════════════════════════════════════════════════════
    // Dynamic timer
    // ════════════════════════════════════════════════════════════

    /// @notice Current countdown window (seconds) based on arrecadação vs meta.
    ///         meta = prize value; raised = bidCount × bidPrice.
    function _timerWindow(uint256 raised, uint256 goal) internal view returns (uint256) {
        if (goal == 0) return timerSeconds[0];
        if (raised >= goal) return timerSeconds[5];              // ≥100%
        if (raised * 5 >= goal * 4) return timerSeconds[4];      // ≥80%
        if (raised * 5 >= goal * 3) return timerSeconds[3];      // ≥60%
        if (raised * 5 >= goal * 2) return timerSeconds[2];      // ≥40%
        if (raised * 5 >= goal) return timerSeconds[1];          // ≥20%
        return timerSeconds[0];                                  // <20%
    }

    /// @notice Public helper — frontend shows the live tier
    function currentTimerWindow(uint256 auctionId) external view returns (uint256) {
        Auction storage a = auctions[auctionId];
        return _timerWindow(a.bidCount * bidPrice, a.prizeUsdt);
    }

    /// @notice Progress: raised USDT / goal USDT (18 dec both)
    function auctionProgress(uint256 auctionId) external view returns (uint256 raised, uint256 goal) {
        Auction storage a = auctions[auctionId];
        return (a.bidCount * bidPrice, a.prizeUsdt);
    }

    // ════════════════════════════════════════════════════════════
    // Bid packs
    // ════════════════════════════════════════════════════════════

    /// @notice Buy bid packs with USDT — $1 per bid
    function buyBidPackUSDT(uint256 bidCount) external nonReentrant {
        require(!paused, "Paused");
        require(bidCount > 0, "Min 1 bid");
        uint256 cost = bidCount * bidPrice;
        require(usdt.transferFrom(msg.sender, address(this), cost), "USDT transfer failed");
        bidBalance[msg.sender] += bidCount;
        emit BidPackBoughtUSDT(msg.sender, bidCount, cost);
    }

    /// @notice Buy bid packs with VYR balance (unilevel commissions path).
    ///         Valued at the Staking V4 oracle price, +10% bonus bids.
    ///         VYR received: 50% burned 🔥 / 50% to treasury (sai de circulação).
    function buyBidPackWithVYR(uint256 vyrAmount) external nonReentrant {
        require(!paused, "Paused");
        require(vyrAmount > 0, "Zero VYR");
        uint256 price = IPriceOracle(stakingOracle).vyrPriceInUsdt();
        require(price > 0, "Oracle price zero");
        uint256 valueUsdt = (vyrAmount * price) / 1e18;
        uint256 bids = (valueUsdt * (10000 + vyBonusBps)) / (10000 * bidPrice);
        require(bids > 0, "Dust VYR");
        require(vyrToken.transferFrom(msg.sender, address(this), vyrAmount), "VYR transfer failed");

        // 50% burn / 50% treasury
        uint256 half = vyrAmount / 2;
        if (half > 0) {
            vyrBurner.burn(half);
            totalVyrBurned += half;
        }
        uint256 rest = vyrAmount - half;
        if (rest > 0) require(vyrToken.transfer(treasuryWallet, rest), "Treasury transfer failed");

        bidBalance[msg.sender] += bids;
        emit BidPackBoughtVYR(msg.sender, vyrAmount, bids, half);
    }

    // ════════════════════════════════════════════════════════════
    // Bidding
    // ════════════════════════════════════════════════════════════

    function placeBid(uint256 auctionId) external nonReentrant {
        require(!paused, "Paused");
        Auction storage a = auctions[auctionId];
        require(a.status == Status.Active && a.endTime > 0, "Not active");
        require(block.timestamp <= a.endTime, "Expired");
        require(bidBalance[msg.sender] >= 1, "No bid credits");
        if (weeklyWinLimit > 0) {
            require(winsPerWeek[msg.sender][block.timestamp / 7 days] < weeklyWinLimit, "Weekly win limit");
        }

        bidBalance[msg.sender] -= 1;
        a.bidCount += 1;
        a.currentPrice += priceIncrement;
        a.lastBidder = msg.sender;
        uint256 window = _timerWindow(a.bidCount * bidPrice, a.prizeUsdt);
        a.endTime = block.timestamp + window;
        totalBidsPlaced += 1;

        emit BidPlaced(auctionId, msg.sender, a.currentPrice, a.endTime, window);
    }

    // ════════════════════════════════════════════════════════════
    // Finalize + claim
    // ════════════════════════════════════════════════════════════

    /// @notice Anyone calls after countdown reaches zero. Distributes revenue,
    ///         records winner. Winner then claims paying the final price.
    function finalize(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.status == Status.Active, "Not active");
        require(a.endTime > 0, "Not active");
        require(block.timestamp > a.endTime, "Not expired");

        a.status = Status.Completed;
        a.finalizeTime = block.timestamp;
        _removeFromActive(auctionId);

        if (a.lastBidder == address(0)) {
            // No bids — prize returns to the pool
            lockedPrizeFunds -= a.prizeUsdt;
            availablePrizeFunds += a.prizeUsdt;
            emit AuctionFinalized(auctionId, address(0), 0, 0);
            return;
        }

        a.winner = a.lastBidder;
        winsPerWeek[a.winner][block.timestamp / 7 days] += 1;

        uint256 revenue = a.bidCount * bidPrice;
        totalUsdtRevenue += revenue;

        uint256 buybackAmt = (revenue * buybackShareBps) / 10000;
        uint256 poolAmt = (revenue * prizePoolShareBps) / 10000;
        uint256 walletTotal = (revenue * walletShareBps) / 10000;
        uint256 mlmAmt = (revenue * mlmShareBps) / 10000;

        // 20% — fee wallets (5% each, dust to last)
        uint256 perWallet = walletTotal / 4;
        uint256 remainder = walletTotal - (perWallet * 4);
        for (uint256 i = 0; i < 4; i++) {
            uint256 amt = perWallet;
            if (i == 3) amt += remainder;
            if (amt > 0) require(usdt.transfer(feeWallets[i], amt), "Fee transfer failed");
        }

        // 15% — rede MLM
        if (mlmAmt > 0) require(usdt.transfer(mlmWallet, mlmAmt), "MLM transfer failed");

        // 25% — stays inside the contract funding future prizes
        availablePrizeFunds += poolAmt;

        // 40% — buyback VYR (swap + burn half, half treasury) with fallback
        _executeBuyback(auctionId, buybackAmt);

        emit AuctionFinalized(auctionId, a.winner, a.bidCount, revenue);
    }

    /// @notice Winner pays the final price (USDT) and receives the prize (USDT).
    function claimPrize(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.status == Status.Completed, "Not completed");
        require(a.winner != address(0), "No winner");
        require(msg.sender == a.winner, "Not winner");
        require(!a.prizeClaimed, "Already claimed");
        require(block.timestamp <= a.finalizeTime + CLAIM_WINDOW, "Claim window over");

        // Winner pays final price → goes to the prize pool (reposição)
        require(usdt.transferFrom(msg.sender, address(this), a.currentPrice), "Pay final price");
        availablePrizeFunds += a.currentPrice;
        a.finalPricePaid = a.currentPrice;

        lockedPrizeFunds -= a.prizeUsdt;
        a.prizeClaimed = true;
        require(usdt.transfer(msg.sender, a.prizeUsdt), "Prize transfer failed");

        emit PrizeClaimed(auctionId, msg.sender, a.prizeUsdt, a.finalPricePaid);
    }

    /// @notice After the claim window, unclaimed prize returns to the pool (anyone).
    function expireUnclaimed(uint256 auctionId) external nonReentrant {
        Auction storage a = auctions[auctionId];
        require(a.status == Status.Completed, "Not completed");
        require(a.winner != address(0), "No winner");
        require(!a.prizeClaimed, "Already claimed");
        require(block.timestamp > a.finalizeTime + CLAIM_WINDOW, "Window still open");

        lockedPrizeFunds -= a.prizeUsdt;
        availablePrizeFunds += a.prizeUsdt;
        a.prizeClaimed = true; // block double-expire
        emit PrizeExpired(auctionId, a.prizeUsdt);
    }

    // ════════════════════════════════════════════════════════════
    // Buyback (padrão loteria: swap + burn half, half treasury, fallback)
    // ════════════════════════════════════════════════════════════

    function _executeBuyback(uint256 auctionId, uint256 usdtAmount) internal {
        if (!autoBuybackEnabled || address(dexRouter) == address(0) || address(vyrToken) == address(0)) {
            require(usdt.transfer(buybackFallbackWallet, usdtAmount), "Buyback fallback failed");
            emit BuybackFallback(auctionId, usdtAmount);
            return;
        }

        address[] memory path = new address[](2);
        path[0] = address(usdt);
        path[1] = address(vyrToken);

        usdt.approve(address(dexRouter), usdtAmount);
        uint256 vyrBefore = vyrToken.balanceOf(address(this));

        try dexRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            usdtAmount, 0, path, address(this), block.timestamp + 300
        ) {
            uint256 vyrOut = vyrToken.balanceOf(address(this)) - vyrBefore;
            totalBuybackUsdt += usdtAmount;
            uint256 half = vyrOut / 2;
            if (half > 0) {
                vyrBurner.burn(half);
                totalVyrBurned += half;
            }
            uint256 rest = vyrOut - half;
            if (rest > 0) require(vyrToken.transfer(treasuryWallet, rest), "Treasury VYR failed");
            emit BuybackSwappedAndBurned(auctionId, usdtAmount, vyrOut, half);
        } catch {
            require(usdt.transfer(buybackFallbackWallet, usdtAmount), "Buyback fallback failed");
            emit BuybackFallback(auctionId, usdtAmount);
        }
    }

    // ════════════════════════════════════════════════════════════
    // Admin — auction management
    // ════════════════════════════════════════════════════════════

    /// @notice Fund the prize pool (USDT in). Required before opening auctions.
    function fundPrizePool(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero");
        require(usdt.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        availablePrizeFunds += amount;
        emit PrizePoolFunded(msg.sender, amount);
    }

    /// @notice Open a new auction. startDelay = seconds until countdown ends
    ///         if nobody bids (viewing window before the first bid).
    function openAuction(uint256 prizeUsdt, uint256 startDelay) external onlyOwner {
        require(prizeUsdt > 0, "Prize zero");
        require(availablePrizeFunds >= prizeUsdt, "Fund prize pool first");
        require(startDelay >= 60 && startDelay <= 30 days, "Delay 60s-30d");

        availablePrizeFunds -= prizeUsdt;
        lockedPrizeFunds += prizeUsdt;

        nextAuctionId++;
        uint256 id = nextAuctionId;
        Auction storage a = auctions[id];
        a.prizeUsdt = prizeUsdt;
        a.currentPrice = START_PRICE;
        a.startTime = block.timestamp;
        a.endTime = block.timestamp + startDelay;
        a.status = Status.Active;
        activeAuctionIds.push(id);

        emit AuctionOpened(id, prizeUsdt, a.endTime);
    }

    /// @notice Cancel an auction — only BEFORE any bid (prize returns to pool).
    function cancelAuction(uint256 auctionId) external onlyOwner {
        Auction storage a = auctions[auctionId];
        require(a.status == Status.Active, "Not active");
        require(a.bidCount == 0, "Has bids");
        a.status = Status.Cancelled;
        lockedPrizeFunds -= a.prizeUsdt;
        availablePrizeFunds += a.prizeUsdt;
        _removeFromActive(auctionId);
        emit AuctionCancelled(auctionId);
    }

    /// @notice Set/edit the illustrative image URL + title of an auction (any time).
    function setAuctionMeta(uint256 auctionId, string calldata title, string calldata imageUrl) external onlyOwner {
        require(auctionId >= 1 && auctionId <= nextAuctionId, "Invalid id");
        require(bytes(imageUrl).length <= 256, "URL too long");
        auctionTitle[auctionId] = title;
        auctionImage[auctionId] = imageUrl;
        emit AuctionMetaUpdated(auctionId, title, imageUrl);
    }

    /// @notice Read metadata (title, imageUrl).
    function getAuctionMeta(uint256 auctionId) external view returns (string memory title, string memory imageUrl) {
        return (auctionTitle[auctionId], auctionImage[auctionId]);
    }

    /// @notice Last completed auctions with winners (newest first) — powers the winners wall.
    function getRecentWinners(uint256 count) external view returns (
        uint256[] memory ids, address[] memory winners, uint256[] memory prizes, uint256[] memory finalPrices
    ) {
        uint256 total = nextAuctionId;
        uint256 n = 0;
        for (uint256 id = total; id >= 1; id--) {
            if (n >= count) break;
            Auction storage a = auctions[id];
            if (a.status == Status.Completed && a.winner != address(0)) n++;
        }
        ids = new uint256[](n);
        winners = new address[](n);
        prizes = new uint256[](n);
        finalPrices = new uint256[](n);
        uint256 j = 0;
        for (uint256 id = total; id >= 1; id--) {
            if (j >= n) break;
            Auction storage a = auctions[id];
            if (a.status == Status.Completed && a.winner != address(0)) {
                ids[j] = id;
                winners[j] = a.winner;
                prizes[j] = a.prizeUsdt;
                finalPrices[j] = a.currentPrice;
                j++;
            }
        }
    }

    // ════════════════════════════════════════════════════════════
    // Admin — configuration
    // ════════════════════════════════════════════════════════════

    function setBidPrice(uint256 _price) external onlyOwner {
        require(_price >= 1e16 && _price <= 100e18, "Bid $0.01-$100");
        bidPrice = _price;
        emit ConfigUpdated("bidPrice");
    }

    function setPriceIncrement(uint256 _inc) external onlyOwner {
        require(_inc >= 1e15 && _inc <= 10e16, "Inc $0.001-$0.10");
        priceIncrement = _inc;
        emit ConfigUpdated("priceIncrement");
    }

    /// @notice timerSeconds tiers: [<20%, ≥20%, ≥40%, ≥60%, ≥80%, ≥100%]
    function setTimerSeconds(uint16[6] calldata _seconds) external onlyOwner {
        for (uint256 i = 0; i < 6; i++) {
            require(_seconds[i] >= 1 && _seconds[i] <= 3600, "1s-3600s");
        }
        timerSeconds = _seconds;
        emit ConfigUpdated("timerSeconds");
    }

    function setWeeklyWinLimit(uint256 _limit) external onlyOwner {
        require(_limit <= 10, "Max 10");
        weeklyWinLimit = _limit;
        emit ConfigUpdated("weeklyWinLimit");
    }

    function setVyBonusBps(uint256 _bps) external onlyOwner {
        require(_bps <= 5000, "Max 50%");
        vyBonusBps = _bps;
        emit ConfigUpdated("vyBonusBps");
    }

    function setDistribution(
        uint256 _buybackBps, uint256 _poolBps, uint256 _walletBps, uint256 _mlmBps
    ) external onlyOwner {
        require(_buybackBps + _poolBps + _walletBps + _mlmBps == 10000, "Must sum 10000");
        buybackShareBps = _buybackBps;
        prizePoolShareBps = _poolBps;
        walletShareBps = _walletBps;
        mlmShareBps = _mlmBps;
        emit ConfigUpdated("distribution");
    }

    function setFeeWallets(address payable[4] calldata _wallets) external onlyOwner {
        for (uint256 i = 0; i < 4; i++) require(_wallets[i] != address(0), "Wallet zero");
        feeWallets = _wallets;
        emit ConfigUpdated("feeWallets");
    }

    function setMlmWallet(address payable _wallet) external onlyOwner {
        require(_wallet != address(0), "Zero");
        mlmWallet = _wallet;
        emit ConfigUpdated("mlmWallet");
    }

    function setTreasuryWallet(address payable _wallet) external onlyOwner {
        require(_wallet != address(0), "Zero");
        treasuryWallet = _wallet;
        emit ConfigUpdated("treasuryWallet");
    }

    function setBuybackWallet(address payable _wallet) external onlyOwner {
        require(_wallet != address(0), "Zero");
        buybackFallbackWallet = _wallet;
        emit ConfigUpdated("buybackWallet");
    }

    function setAutoBuyback(bool _enabled) external onlyOwner {
        autoBuybackEnabled = _enabled;
        emit ConfigUpdated("autoBuyback");
    }

    function setDexRouter(address _router) external onlyOwner {
        require(_router != address(0), "Zero");
        dexRouter = IPancakeRouter(_router);
        emit ConfigUpdated("dexRouter");
    }

    function setStakingOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Zero");
        stakingOracle = _oracle;
        emit ConfigUpdated("stakingOracle");
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit ConfigUpdated("paused");
    }

    /// @notice Withdraw USDT that is neither prize pool nor locked prizes (rounding dust).
    function withdrawExcess() external onlyOwner {
        uint256 bal = usdt.balanceOf(address(this));
        uint256 accounted = availablePrizeFunds + lockedPrizeFunds;
        require(bal > accounted, "No excess");
        require(usdt.transfer(owner, bal - accounted), "Transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ════════════════════════════════════════════════════════════
    // Views
    // ════════════════════════════════════════════════════════════

    function getAuction(uint256 auctionId)
        external view returns (
            uint256 prizeUsdt, uint256 currentPrice, uint256 bidCount,
            address lastBidder, address winner, uint256 startTime,
            uint256 endTime, uint256 finalizeTime, uint256 finalPricePaid,
            bool prizeClaimed, Status status
        )
    {
        Auction storage a = auctions[auctionId];
        return (a.prizeUsdt, a.currentPrice, a.bidCount, a.lastBidder, a.winner,
                a.startTime, a.endTime, a.finalizeTime, a.finalPricePaid, a.prizeClaimed, a.status);
    }

    function getActiveAuctionIds() external view returns (uint256[] memory) {
        return activeAuctionIds;
    }

    /// @notice Full timer tiers array (public mapping getter needs an index — this returns all 6)
    function getTimerSeconds() external view returns (uint16[6] memory) {
        return timerSeconds;
    }

    function getWinsThisWeek(address user) external view returns (uint256) {
        return winsPerWeek[user][block.timestamp / 7 days];
    }

    function _removeFromActive(uint256 auctionId) internal {
        uint256 len = activeAuctionIds.length;
        for (uint256 i = 0; i < len; i++) {
            if (activeAuctionIds[i] == auctionId) {
                activeAuctionIds[i] = activeAuctionIds[len - 1];
                activeAuctionIds.pop();
                return;
            }
        }
    }
}
