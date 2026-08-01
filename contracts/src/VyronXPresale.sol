// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVyronXToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function setAuthorized(address account, bool status) external;
    function setExcludedFromFees(address account, bool status) external;
    function setExcludedFromLimits(address account, bool status) external;
}

interface IUSDT {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

/// @title VyronX Presale Contract
/// @notice Multi-phase presale accepting USDT, distributing funds every 48h to 7 designated wallets
/// @dev Funds distribution: 10% marketing, 15% LP, 15% buyback, 20% tech, 40% dev (4x10%)
contract VyronXPresale is ReentrancyGuard {
    // ════════════════════════════════════════════════════════════
    // Immutable / Config
    // ════════════════════════════════════════════════════════════
    IVyronXToken public immutable token;
    IUSDT public immutable usdt;

    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ════════════════════════════════════════════════════════════
    // Presale Phases
    // ════════════════════════════════════════════════════════════
    struct Phase {
        uint256 pricePerToken; // in USDT (1e6 decimals, per whole token 1e18)
        uint256 bonusPercent; // e.g., 20 = 20% bonus tokens
        uint256 allocation; // max tokens for this phase
        uint256 tokensSold; // running counter
        bool active;
    }

    mapping(uint256 => Phase) public phases;
    uint256 public currentPhase = 0;
    uint256 public constant MAX_PHASES = 4;

    // ════════════════════════════════════════════════════════════
    // Buyer Tracking
    // ════════════════════════════════════════════════════════════
    struct BuyerInfo {
        uint256 usdtSpent;
        uint256 tokensPurchased;
        uint256 bonusTokens;
    }
    mapping(address => BuyerInfo) public buyers;
    address[] public allBuyers;

    // ════════════════════════════════════════════════════════════
    // Counters
    // ════════════════════════════════════════════════════════════
    uint256 public totalUsdtRaised;
    uint256 public totalTokensSold;
    uint256 public totalBuyers;

    // ════════════════════════════════════════════════════════════
    // Fund Distribution Wallets
    // ════════════════════════════════════════════════════════════
    // Distribution percentages (out of 100)
    uint256 public constant MARKETING_PERCENT = 10;
    uint256 public constant LP_PERCENT = 15;
    uint256 public constant BUYBACK_PERCENT = 15;
    uint256 public constant TECH_PERCENT = 20;
    uint256 public constant DEV_PERCENT = 40; // split into 4 x 10%

    address payable public marketingWallet;
    address payable public lpWallet;
    address payable public buybackWallet;
    address payable public techWallet;
    // Dev wallets (same as token sell-fee wallets)
    address payable public devWallet1;
    address payable public devWallet2;
    address payable public devWallet3;
    address payable public devWallet4;

    // ════════════════════════════════════════════════════════════
    // Auto-Distribution (48h cycle)
    // ════════════════════════════════════════════════════════════
    uint256 public lastDistributionTime;
    uint256 public constant DISTRIBUTION_INTERVAL = 48 hours;
    bool public autoDistributeEnabled = true;

    // ════════════════════════════════════════════════════════════
    // Status
    // ════════════════════════════════════════════════════════════
    bool public presaleActive = false;
    bool public presaleFinalized = false;
    uint256 public minBuy = 10 * 1e6; // $10 USDT min
    uint256 public maxBuy = 50_000 * 1e6; // $50,000 USDT max per wallet

    // ════════════════════════════════════════════════════════════
    // Events
    // ════════════════════════════════════════════════════════════
    event TokensPurchased(address indexed buyer, uint256 usdtAmount, uint256 tokensReceived, uint256 bonusTokens);
    event PhaseChanged(uint256 indexed phaseId, uint256 price, uint256 bonus);
    event FundsDistributed(uint256 totalAmount, uint256 timestamp);
    event PresaleStarted(uint256 timestamp);
    event PresaleFinalized(uint256 timestamp);
    event TokensClaimed(address indexed buyer, uint256 amount);

    // ════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════
    constructor(
        address _token,
        address _usdt,
        address payable _marketingWallet,
        address payable _lpWallet,
        address payable _buybackWallet,
        address payable _techWallet,
        address payable _devWallet1,
        address payable _devWallet2,
        address payable _devWallet3,
        address payable _devWallet4
    ) {
        token = IVyronXToken(_token);
        usdt = IUSDT(_usdt);
        owner = msg.sender;

        marketingWallet = _marketingWallet;
        lpWallet = _lpWallet;
        buybackWallet = _buybackWallet;
        techWallet = _techWallet;
        devWallet1 = _devWallet1;
        devWallet2 = _devWallet2;
        devWallet3 = _devWallet3;
        devWallet4 = _devWallet4;

        lastDistributionTime = block.timestamp;
    }

    // ════════════════════════════════════════════════════════════
    // Phase Management
    // ════════════════════════════════════════════════════════════
    /// @notice Configure a presale phase
    /// @param phaseId Phase number (0-3)
    /// @param _pricePerTokenInCents Price in cents (e.g., 1 = $0.01)
    /// @param _bonusPercent Bonus percentage (e.g., 20 = 20%)
    /// @param _allocationTokens Token allocation for this phase (in whole tokens, not wei)
    function setPhase(
        uint256 phaseId,
        uint256 _pricePerTokenInCents,
        uint256 _bonusPercent,
        uint256 _allocationTokens
    ) external onlyOwner {
        require(phaseId < MAX_PHASES, "Invalid phase");
        require(!presaleFinalized, "Presale finalized");

        // Convert cents to USDT-wei: price_per_token_in_usdt_1e6
        // $0.01 per token → 1 cent → 10000 (in USDT 1e6 decimals, per 1e18 token)
        uint256 pricePerTokenUsdWei = (_pricePerTokenInCents * 1e6) / 100;
        // Scale: pricePerTokenUsdWei is USDT per 1 WHOLE token
        // For 1e18 token units: pricePerTokenUsdWei * 1e18... but that overflows
        // We store pricePerToken as: USDT (1e6) per 1e18 tokens
        // tokens = usdtAmount * 1e18 / pricePerTokenUsdWei

        phases[phaseId] = Phase({
            pricePerToken: pricePerTokenUsdWei,
            bonusPercent: _bonusPercent,
            allocation: _allocationTokens * 10 ** 18,
            tokensSold: 0,
            active: true
        });

        emit PhaseChanged(phaseId, pricePerTokenUsdWei, _bonusPercent);
    }

    function setCurrentPhase(uint256 phaseId) external onlyOwner {
        require(phaseId < MAX_PHASES, "Invalid phase");
        require(phases[phaseId].active, "Phase not configured");
        currentPhase = phaseId;
    }

    // ════════════════════════════════════════════════════════════
    // Buy with USDT
    // ════════════════════════════════════════════════════════════
    /// @notice Buy VYR tokens with USDT
    /// @param usdtAmount Amount of USDT to spend (in 1e6 decimals)
    function buyWithUsdt(uint256 usdtAmount) external nonReentrant {
        require(presaleActive, "Presale not active");
        require(!presaleFinalized, "Presale finalized");
        require(usdtAmount >= minBuy, "Below minimum");
        require(usdtAmount <= maxBuy, "Above maximum");

        Phase storage phase = phases[currentPhase];
        require(phase.active, "Phase not active");

        // Calculate tokens
        // tokens = usdtAmount * 1e18 / pricePerToken
        uint256 tokensToReceive = (usdtAmount * 10 ** 18) / phase.pricePerToken;
        require(tokensToReceive > 0, "Zero tokens");

        // Calculate bonus
        uint256 bonusTokens = (tokensToReceive * phase.bonusPercent) / 100;
        uint256 totalTokens = tokensToReceive + bonusTokens;

        // Check phase allocation
        require(phase.tokensSold + totalTokens <= phase.allocation, "Phase allocation exceeded");

        // Check contract has enough tokens
        require(token.balanceOf(address(this)) >= totalTokens, "Insufficient token balance");

        // Transfer USDT from buyer to contract
        require(
            usdt.transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );

        // Transfer tokens to buyer
        require(token.transfer(msg.sender, totalTokens), "Token transfer failed");

        // Update counters
        phase.tokensSold += totalTokens;

        if (buyers[msg.sender].usdtSpent == 0) {
            allBuyers.push(msg.sender);
            totalBuyers++;
        }
        buyers[msg.sender].usdtSpent += usdtAmount;
        buyers[msg.sender].tokensPurchased += tokensToReceive;
        buyers[msg.sender].bonusTokens += bonusTokens;

        totalUsdtRaised += usdtAmount;
        totalTokensSold += totalTokens;

        emit TokensPurchased(msg.sender, usdtAmount, tokensToReceive, bonusTokens);

        // Auto-distribute if 48h elapsed
        if (autoDistributeEnabled && block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL) {
            _distributeFunds();
        }
    }

    // ════════════════════════════════════════════════════════════
    // Fund Distribution (every 48h)
    // ════════════════════════════════════════════════════════════
    /// @notice Distribute accumulated USDT to designated wallets (auto-called on 48h interval)
    function _distributeFunds() internal {
        uint256 balance = usdt.balanceOf(address(this));
        if (balance == 0) return;

        // Calculate each portion
        uint256 marketingAmt = (balance * MARKETING_PERCENT) / 100;
        uint256 lpAmt = (balance * LP_PERCENT) / 100;
        uint256 buybackAmt = (balance * BUYBACK_PERCENT) / 100;
        uint256 techAmt = (balance * TECH_PERCENT) / 100;
        // Dev = remaining (40% split into 4 x 10%)
        uint256 devPerWallet = (balance * 10) / 100;

        // Distribute
        require(usdt.transfer(marketingWallet, marketingAmt), "Marketing transfer failed");
        require(usdt.transfer(lpWallet, lpAmt), "LP transfer failed");
        require(usdt.transfer(buybackWallet, buybackAmt), "Buyback transfer failed");
        require(usdt.transfer(techWallet, techAmt), "Tech transfer failed");
        require(usdt.transfer(devWallet1, devPerWallet), "Dev1 transfer failed");
        require(usdt.transfer(devWallet2, devPerWallet), "Dev2 transfer failed");
        require(usdt.transfer(devWallet3, devPerWallet), "Dev3 transfer failed");
        // Remaining (includes dust) to devWallet4
        uint256 remaining = usdt.balanceOf(address(this));
        require(usdt.transfer(devWallet4, remaining), "Dev4 transfer failed");

        lastDistributionTime = block.timestamp;

        emit FundsDistributed(balance, block.timestamp);
    }

    /// @notice Manually trigger fund distribution (owner only)
    function distributeFunds() external onlyOwner {
        _distributeFunds();
    }

    /// @notice Check if distribution is due
    function isDistributionDue() external view returns (bool) {
        return block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL;
    }

    /// @notice Time until next auto-distribution
    function timeUntilNextDistribution() external view returns (uint256) {
        if (block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL) return 0;
        return (lastDistributionTime + DISTRIBUTION_INTERVAL) - block.timestamp;
    }

    // ════════════════════════════════════════════════════════════
    // Lifecycle
    // ════════════════════════════════════════════════════════════
    function startPresale() external onlyOwner {
        require(!presaleActive, "Already active");
        presaleActive = true;
        lastDistributionTime = block.timestamp;
        emit PresaleStarted(block.timestamp);
    }

    function pausePresale() external onlyOwner {
        presaleActive = false;
    }

    function finalizePresale() external onlyOwner {
        require(presaleActive, "Not active");
        presaleActive = false;
        presaleFinalized = true;

        // Final distribution
        _distributeFunds();

        emit PresaleFinalized(block.timestamp);
    }

    /// @notice Withdraw unsold tokens after presale ends
    function withdrawUnsoldTokens(address to) external onlyOwner {
        require(presaleFinalized, "Presale not finalized");
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No tokens");
        require(token.transfer(to, balance), "Transfer failed");
    }

    // ════════════════════════════════════════════════════════════
    // Admin
    // ════════════════════════════════════════════════════════════
    function setMinBuy(uint256 amount) external onlyOwner {
        minBuy = amount;
    }

    function setMaxBuy(uint256 amount) external onlyOwner {
        maxBuy = amount;
    }

    function setAutoDistributeEnabled(bool enabled) external onlyOwner {
        autoDistributeEnabled = enabled;
    }

    /// @notice Update all distribution wallets (for mainnet deployment or corrections)
    function setDistributionWallets(
        address payable _marketingWallet,
        address payable _lpWallet,
        address payable _buybackWallet,
        address payable _techWallet
    ) external onlyOwner {
        require(_marketingWallet != address(0) && _lpWallet != address(0) &&
                _buybackWallet != address(0) && _techWallet != address(0), "Zero address");
        marketingWallet = _marketingWallet;
        lpWallet = _lpWallet;
        buybackWallet = _buybackWallet;
        techWallet = _techWallet;
    }

    /// @notice Update dev wallets (4 wallets, 10% each in distribution)
    function setDevWallets(
        address payable _d1, address payable _d2,
        address payable _d3, address payable _d4
    ) external onlyOwner {
        require(_d1 != address(0) && _d2 != address(0) &&
                _d3 != address(0) && _d4 != address(0), "Zero address");
        devWallet1 = _d1; devWallet2 = _d2; devWallet3 = _d3; devWallet4 = _d4;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        owner = address(0);
    }

    // ════════════════════════════════════════════════════════════
    // View — for frontend
    // ════════════════════════════════════════════════════════════
    function getPresaleInfo()
        external
        view
        returns (
            uint256 _currentPhase,
            uint256 _pricePerToken,
            uint256 _bonusPercent,
            uint256 _totalRaised,
            uint256 _totalSold,
            uint256 _totalBuyers,
            bool _isActive,
            bool _isFinalized
        )
    {
        Phase storage p = phases[currentPhase];
        return (
            currentPhase,
            p.pricePerToken,
            p.bonusPercent,
            totalUsdtRaised,
            totalTokensSold,
            totalBuyers,
            presaleActive,
            presaleFinalized
        );
    }

    function getBuyerInfo(address buyer)
        external
        view
        returns (uint256 usdtSpent, uint256 tokensPurchased, uint256 bonusTokens)
    {
        BuyerInfo storage info = buyers[buyer];
        return (info.usdtSpent, info.tokensPurchased, info.bonusTokens);
    }

    /// @notice Calculate how many tokens you get for a given USDT amount
    function getTokensForUsdt(uint256 usdtAmount) external view returns (uint256 tokens, uint256 bonus) {
        Phase storage p = phases[currentPhase];
        tokens = (usdtAmount * 10 ** 18) / p.pricePerToken;
        bonus = (tokens * p.bonusPercent) / 100;
    }
}
