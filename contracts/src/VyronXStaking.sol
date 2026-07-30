// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title VyronX Staking Contract
/// @notice 4 staking pools: deposit USDT, earn VYR via oracle. Includes accelerator + 11-level affiliate.
/// @dev Pool 360 has accelerator (10% of referral deposit → early withdrawal) and affiliate commissions on profit.
contract VyronXStaking is ReentrancyGuard {
    // ════════════════════════════════════════════════════════════
    // Token references
    // ════════════════════════════════════════════════════════════
    IERC20 public immutable usdt;
    IERC20 public immutable vyrToken;

    address public owner;
    address public usdtCollector; // wallet receiving deposited USDT
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ════════════════════════════════════════════════════════════
    // Pool Configuration
    // ════════════════════════════════════════════════════════════
    struct Pool {
        uint256 lockPeriodDays;
        uint256 dailyRateBps; // basis points (e.g., 11 = 0.11%)
        bool active;
        string tierName;
    }

    mapping(uint256 => Pool) public pools;
    uint256 public constant POOL_COUNT = 4;

    // Pool IDs: 0 = 30d, 1 = 60d, 2 = 180d, 3 = 360d
    uint256 public constant POOL_360_ID = 3;

    // ════════════════════════════════════════════════════════════
    // Stakes
    // ════════════════════════════════════════════════════════════
    struct Stake {
        address staker;
        uint256 poolId;
        uint256 usdtAmount;
        uint256 startTime;
        uint256 lockEndTime;
        bool withdrawn;
        uint256 accumulatedEarnings; // in USDT value
    }

    mapping(address => Stake[]) public userStakes;
    uint256 public totalStakedUsdt;
    uint256 public totalStakers;

    // ════════════════════════════════════════════════════════════
    // Accelerator (Pool 360 only)
    // ════════════════════════════════════════════════════════════
    struct Accelerator {
        uint256 stakeIndex;
        uint256 totalReferralDeposits;
        uint256 acceleratorPercent; // 0-100, unlocks at 100%
        bool earlyWithdrawUnlocked;
    }

    mapping(address => Accelerator[]) public accelerators; // per stake

    // ════════════════════════════════════════════════════════════
    // Affiliate / Referral System (Pool 360 only)
    // ════════════════════════════════════════════════════════════
    struct AffiliateLevel {
        uint256 commissionBps; // basis points (700 = 7%)
        uint256 minStakeUsdt; // in USDT 1e6
        uint256 minDirectReferrals;
    }

    AffiliateLevel[11] public affiliateLevels;

    // Referrer tracking: who referred whom
    mapping(address => address) public referrer; // user → their referrer
    mapping(address => address[]) public directReferrals; // referrer → list of directs
    mapping(address => uint256) public totalReferralEarnings; // in USDT

    // ════════════════════════════════════════════════════════════
    // Oracle — VYR price in USDT
    // ════════════════════════════════════════════════════════════
    // Price of 1 VYR token (1e18) in USDT (1e6)
    // Updated by owner (or Chainlink automation) — represents VYR/USDT market price
    uint256 public vyrPriceInUsdt = 1_000_000; // default: 1 VYR = $1.00 (in 1e6 USDT per 1e18 token)
    // This means: tokensToPay = earningsUsdt * 1e18 / vyrPriceInUsdt

    // ════════════════════════════════════════════════════════════
    // Events
    // ════════════════════════════════════════════════════════════
    event Staked(address indexed staker, uint256 poolId, uint256 usdtAmount, uint256 endTime);
    event Withdrawn(address indexed staker, uint256 stakeIndex, uint256 usdtEarnings, uint256 vyrPaid);
    event EarlyWithdrawn(address indexed staker, uint256 stakeIndex, uint256 penaltyPercent);
    event AcceleratorUpdated(address indexed staker, uint256 stakeIndex, uint256 newPercent);
    event ReferralRegistered(address indexed user, address indexed referrer);
    event AffiliateCommissionPaid(address indexed earner, address indexed fromUser, uint256 amount, uint256 level);
    event PoolRateUpdated(uint256 indexed poolId, uint256 newDailyRateBps);
    event VyrPriceUpdated(uint256 newPrice);
    event PoolStatusChanged(uint256 indexed poolId, bool active);

    // ════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════
    constructor(address _usdt, address _vyrToken, address _usdtCollector) {
        usdt = IERC20(_usdt);
        vyrToken = IERC20(_vyrToken);
        usdtCollector = _usdtCollector;
        owner = msg.sender;

        // Initialize 4 pools with default rates
        pools[0] = Pool({lockPeriodDays: 30, dailyRateBps: 11, active: false, tierName: "Starter"});
        pools[1] = Pool({lockPeriodDays: 60, dailyRateBps: 23, active: false, tierName: "Growth"});
        pools[2] = Pool({lockPeriodDays: 180, dailyRateBps: 33, active: false, tierName: "Pro"});
        pools[3] = Pool({lockPeriodDays: 360, dailyRateBps: 50, active: false, tierName: "Elite"});

        // Initialize 11 affiliate levels
        affiliateLevels[0] = AffiliateLevel(700, 100e6, 0); // L1: 7%, $100, 0 directs
        affiliateLevels[1] = AffiliateLevel(600, 200e6, 2); // L2: 6%, $200, 2 directs
        affiliateLevels[2] = AffiliateLevel(500, 300e6, 3);
        affiliateLevels[3] = AffiliateLevel(400, 400e6, 4);
        affiliateLevels[4] = AffiliateLevel(300, 500e6, 5);
        affiliateLevels[5] = AffiliateLevel(200, 600e6, 6);
        affiliateLevels[6] = AffiliateLevel(200, 700e6, 7);
        affiliateLevels[7] = AffiliateLevel(200, 800e6, 8);
        affiliateLevels[8] = AffiliateLevel(200, 900e6, 9);
        affiliateLevels[9] = AffiliateLevel(200, 1000e6, 10);
        affiliateLevels[10] = AffiliateLevel(700, 1100e6, 11); // L11: 7%, $1100, 11 directs
    }

    // ════════════════════════════════════════════════════════════
    // Referral Registration
    // ════════════════════════════════════════════════════════════
    /// @notice Register a referrer (must be called BEFORE staking)
    function setReferrer(address _referrer) external {
        require(_referrer != msg.sender, "Cannot refer self");
        require(referrer[msg.sender] == address(0), "Referrer already set");
        require(_referrer != address(0), "Invalid referrer");

        referrer[msg.sender] = _referrer;
        directReferrals[_referrer].push(msg.sender);

        emit ReferralRegistered(msg.sender, _referrer);
    }

    // ════════════════════════════════════════════════════════════
    // Stake
    // ════════════════════════════════════════════════════════════
    /// @notice Stake USDT in a pool
    /// @param poolId 0-3 (30/60/180/360 days)
    /// @param usdtAmount Amount in USDT 1e6
    function stake(uint256 poolId, uint256 usdtAmount) external nonReentrant {
        require(poolId < POOL_COUNT, "Invalid pool");
        Pool storage pool = pools[poolId];
        require(pool.active, "Pool not active");
        require(usdtAmount >= 50e6, "Below minimum ($50)");

        // Transfer USDT from staker → contract → collector
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");
        require(usdt.transfer(usdtCollector, usdtAmount), "USDT forward failed");

        uint256 lockEndTime = block.timestamp + (pool.lockPeriodDays * 1 days);

        // Create stake
        userStakes[msg.sender].push(Stake({
            staker: msg.sender,
            poolId: poolId,
            usdtAmount: usdtAmount,
            startTime: block.timestamp,
            lockEndTime: lockEndTime,
            withdrawn: false,
            accumulatedEarnings: 0
        }));

        totalStakedUsdt += usdtAmount;
        if (userStakes[msg.sender].length == 1) {
            totalStakers++;
        }

        // If Pool 360 — set up accelerator + process referral
        if (poolId == POOL_360_ID) {
            accelerators[msg.sender].push(Accelerator({
                stakeIndex: userStakes[msg.sender].length - 1,
                totalReferralDeposits: 0,
                acceleratorPercent: 0,
                earlyWithdrawUnlocked: false
            }));

            // Update referrer's accelerator
            address ref = referrer[msg.sender];
            if (ref != address(0)) {
                _updateAccelerator(ref, usdtAmount);
            }
        }

        emit Staked(msg.sender, poolId, usdtAmount, lockEndTime);
    }

    // ════════════════════════════════════════════════════════════
    // Accelerator Logic (Pool 360)
    // ════════════════════════════════════════════════════════════
    /// @dev Updates the referrer's accelerator when their referral stakes in Pool 360
    function _updateAccelerator(address referrerAddr, uint256 referralDeposit) internal {
        Accelerator[] storage refs = accelerators[referrerAddr];
        if (refs.length == 0) return;

        // Update ALL active 360-day stakes for this referrer
        for (uint256 i = 0; i < refs.length; i++) {
            if (refs[i].earlyWithdrawUnlocked) continue;

            Stake storage s = userStakes[referrerAddr][refs[i].stakeIndex];
            if (s.withdrawn || s.poolId != POOL_360_ID) continue;

            // Add 10% of referral deposit to accumulated
            refs[i].totalReferralDeposits += referralDeposit;
            // acceleratorPercent = (totalReferralDeposits * 10) / stakerOwnDeposit * 100 / 10
            // = totalReferralDeposits / stakerOwnDeposit * 100 (since 10% each)
            // Actually: each referral adds 10% of THEIR deposit as accelerator
            // accelerator percent = totalReferralDeposits * 100 / referrer's own stake
            // Wait — the spec says: referral deposits $200 → 10% of that ($20) counts as
            // 20% toward a $100 stake. So: (totalRefDeposits * 10) / ownStake
            uint256 acceleratorValue = (refs[i].totalReferralDeposits * 10) / s.usdtAmount;
            if (acceleratorValue > 100) acceleratorValue = 100;

            refs[i].acceleratorPercent = acceleratorValue;

            if (acceleratorValue >= 100 && !refs[i].earlyWithdrawUnlocked) {
                refs[i].earlyWithdrawUnlocked = true;
            }

            emit AcceleratorUpdated(referrerAddr, i, refs[i].acceleratorPercent);
        }
    }

    // ════════════════════════════════════════════════════════════
    // Withdraw
    // ════════════════════════════════════════════════════════════
    /// @notice Withdraw earnings from a matured stake (or early via accelerator)
    /// @param stakeIndex Index in user's stake array
    function withdraw(uint256 stakeIndex) external nonReentrant {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeIndex < stakes.length, "Invalid stake index");
        Stake storage s = stakes[stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(msg.sender == s.staker, "Not stake owner");

        bool canWithdraw = false;
        bool isEarly = false;

        if (block.timestamp >= s.lockEndTime) {
            canWithdraw = true;
        } else if (s.poolId == POOL_360_ID) {
            // Check accelerator
            Accelerator[] storage accs = accelerators[msg.sender];
            for (uint256 i = 0; i < accs.length; i++) {
                if (accs[i].stakeIndex == stakeIndex && accs[i].earlyWithdrawUnlocked) {
                    canWithdraw = true;
                    isEarly = true;
                    break;
                }
            }
        }

        require(canWithdraw, "Stake is locked");

        // Calculate earnings in USDT
        uint256 elapsedDays = (block.timestamp - s.startTime) / 1 days;
        Pool storage pool = pools[s.poolId];

        // Earnings = principal * dailyRate * days / 10000
        uint256 earningsUsdt = (s.usdtAmount * pool.dailyRateBps * elapsedDays) / 10000;

        // TOTAL = principal + earnings (both converted to VYR)
        uint256 totalUsdt = s.usdtAmount + earningsUsdt;

        // Convert to VYR tokens via oracle price
        // vyrToPay = totalUsdt * 1e18 / vyrPriceInUsdt
        uint256 vyrToPay = (totalUsdt * 10 ** 18) / vyrPriceInUsdt;

        // Check contract has enough VYR
        require(vyrToken.balanceOf(address(this)) >= vyrToPay, "Insufficient VYR balance");

        // Mark withdrawn
        s.withdrawn = true;
        s.accumulatedEarnings = earningsUsdt;

        // Pay affiliate commissions (only on Pool 360)
        if (s.poolId == POOL_360_ID) {
            _payAffiliateCommissions(msg.sender, earningsUsdt);
        }

        // Transfer VYR to staker
        require(vyrToken.transfer(msg.sender, vyrToPay), "VYR transfer failed");

        if (isEarly) {
            emit EarlyWithdrawn(msg.sender, stakeIndex, 0);
        }

        emit Withdrawn(msg.sender, stakeIndex, earningsUsdt, vyrToPay);
    }

    // ════════════════════════════════════════════════════════════
    // Affiliate Commission Distribution
    // ═══════════════════════════════════════════ uint256 profitUsdt
    // ════════════════════════════════════════════════════════════
    function _payAffiliateCommissions(address staker, uint256 profitUsdt) internal {
        address current = staker;
        address upline = referrer[current];

        for (uint256 level = 0; level < 11; level++) {
            if (upline == address(0)) break;

            AffiliateLevel storage al = affiliateLevels[level];

            // Check qualification: personal stake >= min AND direct referrals >= min
            uint256 uplineDirects = directReferrals[upline].length;
            uint256 uplineMaxStake = _getMaxStake(upline);

            if (uplineMaxStake >= al.minStakeUsdt && uplineDirects >= al.minDirectReferrals) {
                // Commission = profit * commissionBps / 10000
                uint256 commission = (profitUsdt * al.commissionBps) / 10000;

                if (commission > 0) {
                    // Pay commission in VYR
                    uint256 vyrCommission = (commission * 10 ** 18) / vyrPriceInUsdt;
                    if (vyrToken.balanceOf(address(this)) >= vyrCommission) {
                        vyrToken.transfer(upline, vyrCommission);
                        totalReferralEarnings[upline] += commission;
                        emit AffiliateCommissionPaid(upline, staker, commission, level + 1);
                    }
                }
            }

            current = upline;
            upline = referrer[current];
        }
    }

    /// @dev Returns the highest USDT stake value for a user (for qualification check)
    function _getMaxStake(address user) internal view returns (uint256) {
        Stake[] storage stakes = userStakes[user];
        uint256 maxVal = 0;
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].usdtAmount > maxVal) {
                maxVal = stakes[i].usdtAmount;
            }
        }
        return maxVal;
    }

    // ════════════════════════════════════════════════════════════
    // View: Calculate pending earnings
    // ════════════════════════════════════════════════════════════
    function getPendingEarnings(address staker, uint256 stakeIndex)
        external
        view
        returns (uint256 earningsUsdt, uint256 vyrValue)
    {
        Stake storage s = userStakes[staker][stakeIndex];
        if (s.withdrawn) return (s.accumulatedEarnings, 0);

        uint256 elapsedDays = (block.timestamp - s.startTime) / 1 days;
        Pool storage pool = pools[s.poolId];
        earningsUsdt = (s.usdtAmount * pool.dailyRateBps * elapsedDays) / 10000;
        // Total = principal + earnings (both in VYR)
        uint256 totalUsdt = s.usdtAmount + earningsUsdt;
        vyrValue = (totalUsdt * 10 ** 18) / vyrPriceInUsdt;
    }

    /// @notice Get accelerator status for a user's 360-day stake
    function getAcceleratorStatus(address user, uint256 accIndex)
        external
        view
        returns (uint256 acceleratorPercent, bool unlocked, uint256 totalRefDeposits)
    {
        Accelerator storage acc = accelerators[user][accIndex];
        return (acc.acceleratorPercent, acc.earlyWithdrawUnlocked, acc.totalReferralDeposits);
    }

    /// @notice Get user's stake count
    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    /// @notice Get referral network info
    function getReferralInfo(address user)
        external
        view
        returns (address ref, uint256 directCount, uint256 totalEarnings)
    {
        return (referrer[user], directReferrals[user].length, totalReferralEarnings[user]);
    }

    // ════════════════════════════════════════════════════════════
    // Admin
    // ═══════════════ L. Admin Functions
    // ════════════════════════════════════════════════════════════
    function setPoolActive(uint256 poolId, bool active) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        pools[poolId].active = active;
        emit PoolStatusChanged(poolId, active);
    }

    /// @notice Update pool daily rate (in basis points). Called when opening a new pool.
    function setPoolRate(uint256 poolId, uint256 newDailyRateBps) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        pools[poolId].dailyRateBps = newDailyRateBps;
        emit PoolRateUpdated(poolId, newDailyRateBps);
    }

    /// @notice Update pool lock period (in days)
    function setPoolLockPeriod(uint256 poolId, uint256 newLockDays) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        pools[poolId].lockPeriodDays = newLockDays;
    }

    /// @notice Update pool tier name
    function setPoolName(uint256 poolId, string calldata newName) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        pools[poolId].tierName = newName;
    }

    /// @notice Update all pool params at once (rate + lock period + active)
    function setPoolConfig(
        uint256 poolId,
        uint256 newDailyRateBps,
        uint256 newLockDays,
        bool active,
        string calldata newName
    ) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        pools[poolId].dailyRateBps = newDailyRateBps;
        pools[poolId].lockPeriodDays = newLockDays;
        pools[poolId].active = active;
        pools[poolId].tierName = newName;
        emit PoolRateUpdated(poolId, newDailyRateBps);
        emit PoolStatusChanged(poolId, active);
    }

    /// @notice Update VYR price (oracle integration — for production, replace with Chainlink)
    function setVyrPrice(uint256 _pricePerTokenInUsdt1e6) external onlyOwner {
        vyrPriceInUsdt = _pricePerTokenInUsdt1e6;
        emit VyrPriceUpdated(_pricePerTokenInUsdt1e6);
    }

    function setUsdtCollector(address _collector) external onlyOwner {
        usdtCollector = _collector;
    }

    /// @notice Fund the reward pool with VYR tokens
    function fundRewardPool(uint256 amount) external onlyOwner {
        require(
            vyrToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
    }

    /// @notice Get VYR reward pool balance
    function getRewardPoolBalance() external view returns (uint256) {
        return vyrToken.balanceOf(address(this));
    }

    /// @notice Withdraw excess VYR (owner only, after all stakes mature)
    function withdrawExcessVyr(address to, uint256 amount) external onlyOwner {
        require(vyrToken.transfer(to, amount), "Transfer failed");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        owner = address(0);
    }
}
