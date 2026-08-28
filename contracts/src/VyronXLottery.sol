// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @dev VYR token needs burn — standard burn(address,uint256) or burn(uint256)
interface IBurnable {
    function burn(uint256 amount) external;
}

/// @dev PancakeSwap V2 Router — minimal interface for USDT→VYR swap + burn
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
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

/// @title VyronX Lottery — 4 Parallel Types
/// @notice 4 independent lotteries running simultaneously:
///         Type 0 = Mega (highlighted, big celebration prize)
///         Type 1 = Big
///         Type 2 = Medium
///         Type 3 = Small
///         Each has its own round lifecycle, prize target, and ticket price.
///         Global distribution % applies to all types.
contract VyronXLottery is ReentrancyGuard {
    // ════════════════════════════════════════════════════════════
    // Constants & Storage
    // ════════════════════════════════════════════════════════════

    IERC20 public immutable usdt;
    address public owner;

    uint256 public constant LOTTERY_COUNT = 4;
    // Type 0 = Mega, 1 = Big, 2 = Medium, 3 = Small

    /// @notice Buy-back: auto-swap USDT→VYR on PancakeSwap then burn VYR.
    ///         If disabled or swap fails, USDT goes to buybackWallet fallback.
    IERC20 public vyrToken;
    IPancakeRouter public dexRouter;
    bool public autoBuybackEnabled = true;
    address payable public buybackFallbackWallet;

    /// @notice Ticket price per lottery type (USDT, 18 decimals)
    uint256[4] public ticketPrice;

    /// @notice Display name per lottery type
    string[4] public lotteryNames;

    /// @notice Custom image per lottery type (data-URI base64 or URL), set by owner.
    string[4] public lotteryImages;

    /// @notice Next globally-unique round ID (starts at 1)
    uint256 public nextRoundId;

    /// @notice Active round ID per lottery type (0 = none active)
    uint256[4] public currentRoundId;

    /// @notice Fee wallets — 4 addresses, each gets equal share of walletShareBps
    address payable[4] public feeWallets;
    address payable public buybackWallet;

    /// @notice Global distribution percentages (basis points, must sum to 10000)
    uint256 public walletShareBps = 2000;     // 20%
    uint256 public buybackShareBps = 2000;    // 20%
    uint256 public winner1ShareBps = 5000;    // 50%
    uint256 public winner2ShareBps = 600;     // 6%
    uint256 public winner3ShareBps = 400;     // 4%

    // ════════════════════════════════════════════════════════════
    // Round data
    // ════════════════════════════════════════════════════════════

    enum RoundStatus { Inactive, Active, Drawing, Completed }

    struct Round {
        uint8 lotteryType;           // 0-3
        RoundStatus status;
        uint256 prizeTarget;
        uint256 totalCollected;
        uint256 ticketCount;
        uint256 startTime;
        uint256 endTime;
        address[] participants;
        uint256[] ticketAmounts;
        address winner1;
        address winner2;
        address winner3;
        uint256 prize1;
        uint256 prize2;
        uint256 prize3;
        uint256 buybackAmount;
        uint256 walletPayoutTotal;
    }

    mapping(uint256 => Round) public rounds;          // roundId → Round
    mapping(uint256 => mapping(address => uint256)) public userTickets; // roundId → user → count

    struct TicketPurchase {
        uint256 roundId;
        uint8 lotteryType;
        uint256 ticketCount;
        uint256 totalPaid;
        uint256 timestamp;
    }
    mapping(address => TicketPurchase[]) public userHistory;

    uint256 public totalRoundsCompleted;

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    // ════════════════════════════════════════════════════════════
    // Events
    // ════════════════════════════════════════════════════════════

    event RoundOpened(uint256 indexed roundId, uint8 indexed lotteryType, uint256 prizeTarget, uint256 startTime);
    event TicketsPurchased(uint256 indexed roundId, uint8 indexed lotteryType, address indexed buyer, uint256 ticketCount, uint256 totalPaid);
    event RoundClosed(uint256 indexed roundId, uint8 indexed lotteryType, uint256 totalCollected, uint256 ticketCount);
    event WinnersDrawn(uint256 indexed roundId, uint8 indexed lotteryType, address w1, address w2, address w3, uint256 p1, uint256 p2, uint256 p3);
    event BuybackExecuted(uint256 indexed roundId, uint256 amount);
    event BuybackSwappedAndBurned(uint256 indexed roundId, uint256 usdtIn, uint256 vyrBurned);
    event BuybackFallback(uint256 indexed roundId, uint256 amount);
    event WalletPayout(uint256 indexed roundId, uint256 totalAmount);
    event FeesUpdated(uint256 walletBps, uint256 buybackBps, uint256 w1Bps, uint256 w2Bps, uint256 w3Bps);
    event TicketPriceUpdated(uint8 indexed lotteryType, uint256 newPrice);
    event LotteryNameUpdated(uint8 indexed lotteryType, string newName);
    event LotteryImageUpdated(uint8 indexed lotteryType, string imageURI);
    event FeeWalletsUpdated(address payable[4] wallets, address buybackWallet);
    event AutoBuybackToggled(bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════

    constructor(
        address _usdt,
        address _owner,
        address payable[4] memory _feeWallets,
        address payable _buybackWallet,
        address _vyrToken,
        address _dexRouter
    ) {
        require(_usdt != address(0), "USDT zero");
        require(_owner != address(0), "Owner zero");
        require(_buybackWallet != address(0), "Buyback zero");
        require(_vyrToken != address(0), "VYR zero");
        require(_dexRouter != address(0), "Router zero");
        usdt = IERC20(_usdt);
        owner = _owner;
        feeWallets = _feeWallets;
        buybackWallet = _buybackWallet;
        buybackFallbackWallet = _buybackWallet;
        vyrToken = IERC20(_vyrToken);
        dexRouter = IPancakeRouter(_dexRouter);

        // Default: all ticket prices = $1 USDT
        ticketPrice[0] = 1e18;
        ticketPrice[1] = 1e18;
        ticketPrice[2] = 1e18;
        ticketPrice[3] = 1e18;

        // Default names
        lotteryNames[0] = "Mega";
        lotteryNames[1] = "Big";
        lotteryNames[2] = "Medium";
        lotteryNames[3] = "Small";

        emit OwnershipTransferred(address(0), _owner);
    }

    // ════════════════════════════════════════════════════════════
    // Admin — Round management
    // ════════════════════════════════════════════════════════════

    function openRound(uint8 lotteryType, uint256 prizeTarget) external onlyOwner {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        require(prizeTarget > 0, "Prize target zero");
        require(currentRoundId[lotteryType] == 0, "Type already active");

        nextRoundId++;
        uint256 rid = nextRoundId;
        Round storage r = rounds[rid];
        r.lotteryType = lotteryType;
        r.status = RoundStatus.Active;
        r.prizeTarget = prizeTarget;
        r.startTime = block.timestamp;
        currentRoundId[lotteryType] = rid;

        emit RoundOpened(rid, lotteryType, prizeTarget, block.timestamp);
    }

    /// @notice USDT threshold at which a round auto-closes.
    function roundCloseThreshold(uint256 roundId) public view returns (uint256) {
        return (rounds[roundId].prizeTarget * 10000) / winner1ShareBps;
    }

    /// @notice Adjust Prize-1 target for an active round.
    function setPrizeTarget(uint8 lotteryType, uint256 newTarget) external onlyOwner {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        require(newTarget > 0, "Zero target");
        uint256 rid = currentRoundId[lotteryType];
        require(rid != 0, "No active round");
        require(rounds[rid].status == RoundStatus.Active, "Not active");
        rounds[rid].prizeTarget = newTarget;
    }

    // ════════════════════════════════════════════════════════════
    // Buy tickets
    // ════════════════════════════════════════════════════════════

    function buyTickets(uint8 lotteryType, uint256 ticketCount) external nonReentrant {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        require(ticketCount > 0, "Min 1 ticket");
        uint256 rid = currentRoundId[lotteryType];
        require(rid != 0, "No active round");
        Round storage r = rounds[rid];
        require(r.status == RoundStatus.Active, "Round not active");

        uint256 cost = ticketPrice[lotteryType] * ticketCount;
        require(usdt.transferFrom(msg.sender, address(this), cost), "USDT transfer failed");

        r.totalCollected += cost;
        r.ticketCount += ticketCount;
        r.participants.push(msg.sender);
        r.ticketAmounts.push(ticketCount);
        userTickets[rid][msg.sender] += ticketCount;

        userHistory[msg.sender].push(TicketPurchase({
            roundId: rid,
            lotteryType: lotteryType,
            ticketCount: ticketCount,
            totalPaid: cost,
            timestamp: block.timestamp
        }));

        emit TicketsPurchased(rid, lotteryType, msg.sender, ticketCount, cost);

        if (r.totalCollected >= roundCloseThreshold(rid)) {
            _closeRound(rid);
        }
    }

    function _closeRound(uint256 roundId) internal {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Active, "Not active");
        r.status = RoundStatus.Drawing;
        r.endTime = block.timestamp;
        uint8 lt = r.lotteryType;
        currentRoundId[lt] = 0; // free the type for a new round
        emit RoundClosed(roundId, lt, r.totalCollected, r.ticketCount);
        _drawAndPay(roundId);
    }

    // ════════════════════════════════════════════════════════════
    // Draw & Pay
    // ════════════════════════════════════════════════════════════

    function _drawAndPay(uint256 roundId) internal {
        Round storage r = rounds[roundId];
        require(r.status == RoundStatus.Drawing, "Not drawing");

        uint256 pool = r.totalCollected;
        uint256 p1 = (pool * winner1ShareBps) / 10000;
        uint256 p2 = (pool * winner2ShareBps) / 10000;
        uint256 p3 = (pool * winner3ShareBps) / 10000;
        uint256 buybackAmt = (pool * buybackShareBps) / 10000;
        uint256 walletTotal = (pool * walletShareBps) / 10000;

        // Fee wallets
        uint256 perWallet = walletTotal / 4;
        uint256 remainder = walletTotal - (perWallet * 4);
        for (uint256 i = 0; i < 4; i++) {
            uint256 amt = perWallet;
            if (i == 3) amt += remainder;
            if (amt > 0) require(usdt.transfer(feeWallets[i], amt), "Fee transfer failed");
        }
        emit WalletPayout(roundId, walletTotal);

        // Buyback: auto swap USDT→VYR on PancakeSwap + burn, with fallback
        _executeBuyback(roundId, buybackAmt);

        // Winners
        (address w1, address w2, address w3) = _pickWinners(roundId);

        if (w1 != address(0)) { require(usdt.transfer(w1, p1), "W1 transfer failed"); }
        else { require(usdt.transfer(buybackWallet, p1), "Buyback fallback1"); }
        if (w2 != address(0)) { require(usdt.transfer(w2, p2), "W2 transfer failed"); }
        else { require(usdt.transfer(buybackWallet, p2), "Buyback fallback2"); }
        if (w3 != address(0)) { require(usdt.transfer(w3, p3), "W3 transfer failed"); }
        else { require(usdt.transfer(buybackWallet, p3), "Buyback fallback3"); }

        r.winner1 = w1; r.winner2 = w2; r.winner3 = w3;
        r.prize1 = p1; r.prize2 = p2; r.prize3 = p3;
        r.buybackAmount = buybackAmt;
        r.walletPayoutTotal = walletTotal;
        r.status = RoundStatus.Completed;
        totalRoundsCompleted++;

        emit WinnersDrawn(roundId, r.lotteryType, w1, w2, w3, p1, p2, p3);
    }

    /// @notice Executes buy-back: swaps USDT→VYR on PancakeSwap, then burns the VYR.
    ///         If autoBuybackEnabled is false OR the swap fails (low liquidity etc),
    ///         USDT is sent to buybackFallbackWallet as safety net.
    function _executeBuyback(uint256 roundId, uint256 usdtAmount) internal {
        if (!autoBuybackEnabled || address(dexRouter) == address(0) || address(vyrToken) == address(0)) {
            // Fallback: send USDT directly
            require(usdt.transfer(buybackFallbackWallet, usdtAmount), "Buyback fallback failed");
            emit BuybackFallback(roundId, usdtAmount);
            return;
        }

        // Swap path: USDT → VYR (direct pair if exists, else USDT → WBNB → VYR)
        // Try direct first; PancakeSwap will revert if no liquidity
        address[] memory path = new address[](2);
        path[0] = address(usdt);
        path[1] = address(vyrToken);

        // Approve router
        usdt.approve(address(dexRouter), usdtAmount);

        uint256 vyrBefore = vyrToken.balanceOf(address(this));

        try dexRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            usdtAmount,
            0, // accept any amount (slippage protection = immediate execution)
            path,
            address(this), // VYR comes to this contract first
            block.timestamp + 300
        ) {
            uint256 vyrReceived = vyrToken.balanceOf(address(this)) - vyrBefore;
            if (vyrReceived > 0) {
                // Burn the received VYR permanently
                IBurnable(address(vyrToken)).burn(vyrReceived);
                emit BuybackSwappedAndBurned(roundId, usdtAmount, vyrReceived);
            } else {
                // Edge case: swap returned 0 tokens
                emit BuybackFallback(roundId, usdtAmount);
            }
        } catch {
            // Swap failed (no liquidity, pair issue, etc) — fallback to USDT transfer
            // First reset approval
            usdt.approve(address(dexRouter), 0);
            require(usdt.transfer(buybackFallbackWallet, usdtAmount), "Buyback fallback failed");
            emit BuybackFallback(roundId, usdtAmount);
        }
    }

    function _pickWinners(uint256 roundId) internal view returns (address w1, address w2, address w3) {
        Round storage r = rounds[roundId];
        uint256 totalTickets = r.ticketCount;
        uint256 len = r.participants.length;

        if (len == 0 || totalTickets == 0) return (address(0), address(0), address(0));

        uint256 seed = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1), block.timestamp, roundId, totalTickets, r.totalCollected
        )));

        uint256 r1 = seed % totalTickets;
        w1 = _participantByTicketIndex(roundId, r1);
        if (len < 2) return (w1, address(0), address(0));

        uint256 r2 = uint256(keccak256(abi.encodePacked(seed, "w2"))) % totalTickets;
        w2 = _participantByTicketIndex(roundId, r2);
        if (w2 == w1) {
            for (uint256 i = 0; i < len; i++) {
                if (r.participants[i] != w1) { w2 = r.participants[i]; break; }
            }
        }
        if (len < 3) return (w1, w2, address(0));

        uint256 r3 = uint256(keccak256(abi.encodePacked(seed, "w3"))) % totalTickets;
        w3 = _participantByTicketIndex(roundId, r3);
        if (w3 == w1 || w3 == w2) {
            for (uint256 i = 0; i < len; i++) {
                if (r.participants[i] != w1 && r.participants[i] != w2) { w3 = r.participants[i]; break; }
            }
        }
        return (w1, w2, w3);
    }

    function _participantByTicketIndex(uint256 roundId, uint256 ticketIndex) internal view returns (address) {
        Round storage r = rounds[roundId];
        uint256 cumulative = 0;
        for (uint256 i = 0; i < r.participants.length; i++) {
            cumulative += r.ticketAmounts[i];
            if (ticketIndex < cumulative) return r.participants[i];
        }
        return r.participants[r.participants.length - 1];
    }

    // ════════════════════════════════════════════════════════════
    // Admin — force close & settings
    // ════════════════════════════════════════════════════════════

    function forceCloseRound(uint8 lotteryType) external onlyOwner {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        uint256 rid = currentRoundId[lotteryType];
        require(rid != 0, "No active round");
        require(rounds[rid].status == RoundStatus.Active, "Not active");
        _closeRound(rid);
    }

    function setDistributionBps(
        uint256 _walletShare, uint256 _buybackShare,
        uint256 _w1, uint256 _w2, uint256 _w3
    ) external onlyOwner {
        require(_walletShare + _buybackShare + _w1 + _w2 + _w3 == 10000, "Must sum 10000");
        walletShareBps = _walletShare;
        buybackShareBps = _buybackShare;
        winner1ShareBps = _w1;
        winner2ShareBps = _w2;
        winner3ShareBps = _w3;
        emit FeesUpdated(_walletShare, _buybackShare, _w1, _w2, _w3);
    }

    function setTicketPrice(uint8 lotteryType, uint256 _price) external onlyOwner {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        require(_price > 0, "Zero price");
        ticketPrice[lotteryType] = _price;
        emit TicketPriceUpdated(lotteryType, _price);
    }

    function setLotteryName(uint8 lotteryType, string calldata _name) external onlyOwner {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        require(bytes(_name).length > 0, "Empty name");
        lotteryNames[lotteryType] = _name;
        emit LotteryNameUpdated(lotteryType, _name);
    }

    /// @notice Set custom image for a lottery (data-URI base64 up to ~90KB or external URL).
    /// @dev Empty string clears the image (falls back to site default).
    function setLotteryImage(uint8 lotteryType, string calldata _imageURI) external onlyOwner {
        require(lotteryType < LOTTERY_COUNT, "Invalid type");
        require(bytes(_imageURI).length <= 131072, "Image too large");
        lotteryImages[lotteryType] = _imageURI;
        emit LotteryImageUpdated(lotteryType, _imageURI);
    }

    function setFeeWallets(address payable[4] memory _wallets, address payable _buybackWallet) external onlyOwner {
        for (uint256 i = 0; i < 4; i++) require(_wallets[i] != address(0), "Zero wallet");
        require(_buybackWallet != address(0), "Zero buyback");
        feeWallets = _wallets;
        buybackWallet = _buybackWallet;
        emit FeeWalletsUpdated(_wallets, _buybackWallet);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function recoverTokens(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Zero token");
        IERC20(token).transfer(msg.sender, amount);
    }

    /// @notice Toggle auto buy-back (swap+burn) on/off. If off, USDT goes to fallback wallet.
    function setAutoBuybackEnabled(bool _enabled) external onlyOwner {
        autoBuybackEnabled = _enabled;
        emit AutoBuybackToggled(_enabled);
    }

    /// @notice Change the DEX router (e.g. if PancakeSwap migrates).
    function setDexRouter(address _router) external onlyOwner {
        require(_router != address(0), "Zero router");
        dexRouter = IPancakeRouter(_router);
    }

    /// @notice Change the fallback wallet (receives USDT if swap fails or auto disabled).
    function setBuybackFallbackWallet(address payable _wallet) external onlyOwner {
        require(_wallet != address(0), "Zero wallet");
        buybackFallbackWallet = _wallet;
    }

    // ════════════════════════════════════════════════════════════
    // View functions
    // ════════════════════════════════════════════════════════════

    struct RoundView {
        uint256 roundId;
        uint8 lotteryType;
        RoundStatus status;
        uint256 prizeTarget;
        uint256 totalCollected;
        uint256 ticketCount;
        uint256 participantCount;
        uint256 startTime;
        uint256 endTime;
        uint256 closeThreshold;
        address winner1;
        address winner2;
        address winner3;
        uint256 prize1;
        uint256 prize2;
        uint256 prize3;
        uint256 buybackAmount;
        uint256 walletPayoutTotal;
    }

    function getRound(uint256 roundId) external view returns (RoundView memory) {
        Round storage r = rounds[roundId];
        return RoundView({
            roundId: roundId,
            lotteryType: r.lotteryType,
            status: r.status,
            prizeTarget: r.prizeTarget,
            totalCollected: r.totalCollected,
            ticketCount: r.ticketCount,
            participantCount: r.participants.length,
            startTime: r.startTime,
            endTime: r.endTime,
            closeThreshold: roundCloseThreshold(roundId),
            winner1: r.winner1,
            winner2: r.winner2,
            winner3: r.winner3,
            prize1: r.prize1,
            prize2: r.prize2,
            prize3: r.prize3,
            buybackAmount: r.buybackAmount,
            walletPayoutTotal: r.walletPayoutTotal
        });
    }

    /// @notice Get active round for a lottery type (returns roundId=0 if none active).
    function getCurrentRound(uint8 lotteryType) external view returns (RoundView memory) {
        uint256 rid = currentRoundId[lotteryType];
        if (rid == 0) {
            return RoundView({
                roundId: 0, lotteryType: lotteryType, status: RoundStatus.Inactive,
                prizeTarget: 0, totalCollected: 0, ticketCount: 0, participantCount: 0,
                startTime: 0, endTime: 0, closeThreshold: 0,
                winner1: address(0), winner2: address(0), winner3: address(0),
                prize1: 0, prize2: 0, prize3: 0, buybackAmount: 0, walletPayoutTotal: 0
            });
        }
        return this.getRound(rid);
    }

    /// @notice Get active round IDs for all 4 types at once.
    function getAllCurrentRoundIds() external view returns (uint256[4] memory) {
        return currentRoundId;
    }

    function getUserTickets(uint256 roundId, address user) external view returns (uint256) {
        return userTickets[roundId][user];
    }

    function getUserHistory(address user) external view returns (TicketPurchase[] memory) {
        return userHistory[user];
    }

    function getFeeWallets() external view returns (address[4] memory) {
        return [address(feeWallets[0]), address(feeWallets[1]), address(feeWallets[2]), address(feeWallets[3])];
    }

    function getLotteryNames() external view returns (string[4] memory) {
        return lotteryNames;
    }

    function getLotteryImages() external view returns (string[4] memory) {
        return lotteryImages;
    }

    function getTicketPrices() external view returns (uint256[4] memory) {
        return ticketPrice;
    }

    receive() external payable {}
}
