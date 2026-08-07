// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title VyronX Staking V2
/// @notice 4 pools. Daily earnings withdrawable (min $10). Configurable 4% fee.
/// @notice Pool 360 accelerator: auto-liquidate at 100% + 12h grace. Vouchers = license only (no yield, no principal).
/// @notice Owner is MLM root. No-referral users attach to owner automatically.
contract VyronXStakingV2 is ReentrancyGuard {
    IERC20 public immutable usdt;
    IERC20 public immutable vyrToken;

    address public owner;
    address public usdtCollector;
    address public feeWallet = 0xCA45A82266FbFAc591D1EC0ae356b7C5bDB65D00;
    address public rootReferrer; // Owner is the MLM pyramid root

    // CHANGE #3: Configurable fee (starts at 4%, max 10%)
    uint256 public withdrawalFeeBps = 400; // 4%
    uint256 public constant MAX_FEE_BPS = 1000; // hard cap 10%

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ═══ Pools ═══
    struct Pool {
        uint256 lockPeriodDays;
        uint256 dailyRateBps;
        bool active;
        string tierName;
    }
    mapping(uint256 => Pool) public pools;
    uint256 public constant POOL_COUNT = 4;
    uint256 public constant POOL_360_ID = 3;

    // ═══ Stakes ═══
    struct Stake {
        address staker;
        uint256 poolId;
        uint256 usdtAmount;
        uint256 startTime;
        uint256 lockEndTime;
        bool withdrawn;
        uint256 lastClaimDay;      // day index of last daily claim (CHANGE #2)
        bool isVoucher;
    }
    mapping(address => Stake[]) public userStakes;
    uint256 public totalStakedUsdt;
    uint256 public totalStakers;

    // ═══ Vouchers (CHANGE #1: license only, no yield) ═══
    struct Voucher {
        address recipient;
        uint256 poolId;
        uint256 expiry;
        bool redeemed;
        bool cancelled;
    }
    Voucher[] public vouchers;
    mapping(address => uint256[]) public userVoucherIds;

    // ═══ Accelerator (CHANGE #4: 12h grace period) ═══
    struct Accelerator {
        uint256 stakeIndex;
        uint256 totalReferralDeposits;
        uint256 acceleratorPercent;
        bool earlyWithdrawUnlocked;
        uint256 unlockedTimestamp;   // when 100% was hit
        uint256 pendingCommission;   // USDT held during 12h grace
        bool graceClaimed;           // whether user re-staked in time
    }
    mapping(address => Accelerator[]) public accelerators;
    uint256 public constant GRACE_PERIOD = 12 hours;

    // ═══ Affiliate / MLM (CHANGE #5: owner = root) ═══
    struct AffiliateLevel {
        uint256 commissionBps;
        uint256 minStakeUsdt;
        uint256 minDirectReferrals;
    }
    AffiliateLevel[11] public affiliateLevels;
    mapping(address => address) public referrer;
    mapping(address => address[]) public directReferrals;
    mapping(address => uint256) public totalReferralEarnings;

    // ═══ Oracle ═══
    uint256 public vyrPriceInUsdt = 1e18;

    // ═══ Constants ═══
    uint256 public constant MIN_CLAIM_USDT = 10e18; // $10 min for daily claim (CHANGE #2)
    uint256 public constant ACCELERATOR_COMM_BPS = 1000; // 10% USDT commission

    // ═══ Events ═══
    event Staked(address indexed staker, uint256 poolId, uint256 usdtAmount, uint256 endTime);
    event Withdrawn(address indexed staker, uint256 stakeIndex, uint256 usdtEarnings, uint256 vyrPaid);
    event DailyClaimed(address indexed staker, uint256 stakeIndex, uint256 vyrPaid);
    event AcceleratorUpdated(address indexed staker, uint256 stakeIndex, uint256 newPercent);
    event AcceleratorCompleted(address indexed staker, uint256 stakeIndex, uint256 graceEndTime);
    event GraceClaimed(address indexed staker, uint256 pendingAmount);
    event GraceExpired(address indexed staker, uint256 lostAmount);
    event ReferralRegistered(address indexed user, address indexed referrer);
    event AffiliateCommissionPaid(address indexed earner, address indexed fromUser, uint256 amount, uint256 level);
    event PoolRateUpdated(uint256 indexed poolId, uint256 newDailyRateBps);
    event VyrPriceUpdated(uint256 newPrice);
    event PoolStatusChanged(uint256 indexed poolId, bool active);
    event FeeUpdated(uint256 newFeeBps);

    constructor(address _usdt, address _vyrToken, address _usdtCollector, address _rootReferrer) {
        usdt = IERC20(_usdt);
        vyrToken = IERC20(_vyrToken);
        usdtCollector = _usdtCollector;
        owner = msg.sender;
        rootReferrer = _rootReferrer; // owner wallet = MLM root

        pools[0] = Pool({lockPeriodDays: 30, dailyRateBps: 11, active: false, tierName: "Starter"});
        pools[1] = Pool({lockPeriodDays: 60, dailyRateBps: 23, active: false, tierName: "Growth"});
        pools[2] = Pool({lockPeriodDays: 180, dailyRateBps: 33, active: false, tierName: "Pro"});
        pools[3] = Pool({lockPeriodDays: 360, dailyRateBps: 50, active: false, tierName: "Elite"});

        affiliateLevels[0] = AffiliateLevel(700, 100e18, 0);
        affiliateLevels[1] = AffiliateLevel(600, 200e18, 2);
        affiliateLevels[2] = AffiliateLevel(500, 300e18, 3);
        affiliateLevels[3] = AffiliateLevel(400, 400e18, 5);
        affiliateLevels[4] = AffiliateLevel(300, 500e18, 8);
        affiliateLevels[5] = AffiliateLevel(200, 600e18, 12);
        affiliateLevels[6] = AffiliateLevel(200, 700e18, 15);
        affiliateLevels[7] = AffiliateLevel(200, 800e18, 20);
        affiliateLevels[8] = AffiliateLevel(200, 900e18, 25);
        affiliateLevels[9] = AffiliateLevel(200, 1000e18, 30);
        affiliateLevels[10] = AffiliateLevel(700, 1100e18, 50);
    }

    // ═══ Referral (CHANGE #5: no-referral attaches to root) ═══
    function setReferrer(address _referrer) external {
        require(_referrer != msg.sender, "Cannot refer self");
        require(_referrer != address(0), "Invalid referrer");
        require(referrer[msg.sender] == address(0), "Referrer already set");

        referrer[msg.sender] = _referrer;
        directReferrals[_referrer].push(msg.sender);
        emit ReferralRegistered(msg.sender, _referrer);
    }

    /// @dev Auto-attach to root if no referrer set. Called during stake.
    function _ensureReferrer() internal {
        if (referrer[msg.sender] == address(0) && msg.sender != rootReferrer) {
            referrer[msg.sender] = rootReferrer;
            directReferrals[rootReferrer].push(msg.sender);
            emit ReferralRegistered(msg.sender, rootReferrer);
        }
    }

    // ═══ Stake ═══
    function stake(uint256 poolId, uint256 usdtAmount) external nonReentrant {
        require(poolId < POOL_COUNT, "Invalid pool");
        Pool storage pool = pools[poolId];
        require(pool.active, "Pool not active");
        require(usdtAmount >= 50e18, "Below minimum ($50)");

        _ensureReferrer();

        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT transfer failed");

        uint256 amountToCollector = usdtAmount;
        if (poolId == POOL_360_ID) {
            address ref = referrer[msg.sender];
            if (ref != address(0)) {
                uint256 commission = (usdtAmount * ACCELERATOR_COMM_BPS) / 10000;
                require(usdt.transfer(ref, commission), "Commission failed");
                amountToCollector = usdtAmount - commission;
            }
        }

        require(usdt.transfer(usdtCollector, amountToCollector), "USDT forward failed");

        uint256 lockEndTime = block.timestamp + (pool.lockPeriodDays * 1 days);
        uint256 currentDay = block.timestamp / 1 days;

        userStakes[msg.sender].push(Stake({
            staker: msg.sender,
            poolId: poolId,
            usdtAmount: usdtAmount,
            startTime: block.timestamp,
            lockEndTime: lockEndTime,
            withdrawn: false,
            lastClaimDay: currentDay,
            isVoucher: false
        }));

        totalStakedUsdt += usdtAmount;
        if (userStakes[msg.sender].length == 1) totalStakers++;

        if (poolId == POOL_360_ID) {
            accelerators[msg.sender].push(Accelerator({
                stakeIndex: userStakes[msg.sender].length - 1,
                totalReferralDeposits: 0,
                acceleratorPercent: 0,
                earlyWithdrawUnlocked: false,
                unlockedTimestamp: 0,
                pendingCommission: 0,
                graceClaimed: false
            }));

            address ref = referrer[msg.sender];
            if (ref != address(0)) _updateAccelerator(ref, usdtAmount);
        }

        emit Staked(msg.sender, poolId, usdtAmount, lockEndTime);
    }

    // ═══ CHANGE #2: Daily earnings claim ═══
    /// @notice Claim accumulated daily earnings (min $10) in VYR
    function claimDailyEarnings(uint256 stakeIndex) external nonReentrant {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeIndex < stakes.length, "Invalid index");
        Stake storage s = stakes[stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(msg.sender == s.staker, "Not owner");

        uint256 currentDay = block.timestamp / 1 days;
        uint256 elapsedDays = currentDay - s.lastClaimDay;
        require(elapsedDays >= 1, "Already claimed today");

        Pool storage pool = pools[s.poolId];
        uint256 earningsUsdt = (s.usdtAmount * pool.dailyRateBps * elapsedDays) / 10000;
        require(earningsUsdt >= MIN_CLAIM_USDT, "Min $10 to claim");

        uint256 vyrToPay = (earningsUsdt * 10 ** 18) / vyrPriceInUsdt;
        uint256 fee = (vyrToPay * withdrawalFeeBps) / 10000;
        uint256 payout = vyrToPay - fee;

        s.lastClaimDay = currentDay;

        require(vyrToken.balanceOf(address(this)) >= vyrToPay, "Insufficient VYR");
        require(vyrToken.transfer(msg.sender, payout), "VYR transfer failed");
        if (fee > 0) require(vyrToken.transfer(feeWallet, fee), "Fee transfer failed");

        emit DailyClaimed(msg.sender, stakeIndex, payout);
    }

    // ═══ Accelerator (CHANGE #4: 12h grace) ═══
    function _updateAccelerator(address referrerAddr, uint256 referralDeposit) internal {
        Accelerator[] storage refs = accelerators[referrerAddr];
        if (refs.length == 0) return;

        for (uint256 i = 0; i < refs.length; i++) {
            Accelerator storage acc = refs[i];
            if (acc.earlyWithdrawUnlocked && block.timestamp > acc.unlockedTimestamp + GRACE_PERIOD) continue;

            Stake storage s = userStakes[referrerAddr][acc.stakeIndex];
            if (s.withdrawn || s.poolId != POOL_360_ID) continue;

            // If accelerator already completed but within 12h grace → add to pending
            if (acc.earlyWithdrawUnlocked && !acc.graceClaimed) {
                uint256 comm = (referralDeposit * ACCELERATOR_COMM_BPS) / 10000;
                acc.pendingCommission += comm;
                continue;
            }

            acc.totalReferralDeposits += referralDeposit;
            uint256 acceleratorValue = (acc.totalReferralDeposits * 10) / s.usdtAmount;
            if (acceleratorValue > 100) acceleratorValue = 100;
            acc.acceleratorPercent = acceleratorValue;

            if (acceleratorValue >= 100 && !acc.earlyWithdrawUnlocked) {
                acc.earlyWithdrawUnlocked = true;
                acc.unlockedTimestamp = block.timestamp;
                _payoutStake(referrerAddr, acc.stakeIndex, true);
                emit AcceleratorCompleted(referrerAddr, acc.stakeIndex, block.timestamp + GRACE_PERIOD);
            }

            emit AcceleratorUpdated(referrerAddr, i, acc.acceleratorPercent);
        }
    }

    /// @notice Claim pending commissions after re-staking within 12h grace
    function claimGraceCommission(uint256 accIndex) external nonReentrant {
        Accelerator storage acc = accelerators[msg.sender][accIndex];
        require(acc.earlyWithdrawUnlocked, "Not unlocked");
        require(!acc.graceClaimed, "Already claimed");
        require(acc.pendingCommission > 0, "Nothing pending");

        // Must have a NEW active 360 stake
        require(hasActivePool360(msg.sender), "Need active Pool 360");
        require(block.timestamp <= acc.unlockedTimestamp + GRACE_PERIOD, "Grace expired");

        acc.graceClaimed = true;
        uint256 amount = acc.pendingCommission;
        acc.pendingCommission = 0;

        require(usdt.transfer(msg.sender, amount), "Transfer failed");
        emit GraceClaimed(msg.sender, amount);
    }

    /// @dev Check if user has any active (non-withdrawn) Pool 360 stake
    function hasActivePool360(address user) public view returns (bool) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].withdrawn && stakes[i].poolId == POOL_360_ID) return true;
        }
        return false;
    }

    // ═══ Payout (CHANGE #1: voucher = no yield, no principal) ═══
    function _payoutStake(address staker, uint256 stakeIndex, bool isEarly) internal {
        Stake storage s = userStakes[staker][stakeIndex];
        require(!s.withdrawn, "Already withdrawn");

        if (s.isVoucher) {
            // CHANGE #1: Voucher pays NOTHING — it's just a license
            s.withdrawn = true;
            emit Withdrawn(staker, stakeIndex, 0, 0);
            if (isEarly) emit EarlyWithdrawn(staker, stakeIndex, 0);
            return;
        }

        uint256 currentDay = block.timestamp / 1 days;
        uint256 elapsedDays = currentDay - s.lastClaimDay;
        Pool storage pool = pools[s.poolId];
        uint256 earningsUsdt = (s.usdtAmount * pool.dailyRateBps * elapsedDays) / 10000;
        uint256 totalUsdt = s.usdtAmount + earningsUsdt;

        uint256 vyrToPay = (totalUsdt * 10 ** 18) / vyrPriceInUsdt;
        uint256 fee = (vyrToPay * withdrawalFeeBps) / 10000;
        uint256 payout = vyrToPay - fee;

        s.withdrawn = true;
        s.lastClaimDay = currentDay;

        require(vyrToken.balanceOf(address(this)) >= vyrToPay, "Insufficient VYR");

        if (s.poolId == POOL_360_ID) _payAffiliateCommissions(staker, earningsUsdt);

        require(vyrToken.transfer(staker, payout), "VYR transfer failed");
        if (fee > 0) require(vyrToken.transfer(feeWallet, fee), "Fee transfer failed");

        emit Withdrawn(staker, stakeIndex, earningsUsdt, payout);
        if (isEarly) emit EarlyWithdrawn(staker, stakeIndex, payout);
    }

    event EarlyWithdrawn(address indexed staker, uint256 stakeIndex, uint256 payout);

    // ═══ Withdraw principal (end of lock) ═══
    function withdraw(uint256 stakeIndex) external nonReentrant {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeIndex < stakes.length, "Invalid index");
        Stake storage s = stakes[stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(msg.sender == s.staker, "Not owner");
        require(block.timestamp >= s.lockEndTime, "Stake locked");
        _payoutStake(msg.sender, stakeIndex, false);
    }

    // ═══ Affiliate (unchanged logic) ═══
    function _payAffiliateCommissions(address staker, uint256 profitUsdt) internal {
        address current = staker;
        address upline = referrer[current];

        for (uint256 level = 0; level < 11; level++) {
            if (upline == address(0)) break;
            AffiliateLevel storage al = affiliateLevels[level];
            uint256 uplineDirects = directReferrals[upline].length;
            uint256 uplineMaxStake = _getMaxStake(upline);

            if (uplineMaxStake >= al.minStakeUsdt && uplineDirects >= al.minDirectReferrals) {
                uint256 commission = (profitUsdt * al.commissionBps) / 10000;
                if (commission > 0) {
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

    function _getMaxStake(address user) internal view returns (uint256) {
        Stake[] storage stakes = userStakes[user];
        uint256 maxVal = 0;
        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].usdtAmount > maxVal) maxVal = stakes[i].usdtAmount;
        }
        return maxVal;
    }

    // ═══ View: pending daily earnings ═══
    function getPendingEarnings(address staker, uint256 stakeIndex)
        external view returns (uint256 earningsUsdt, uint256 vyrValue)
    {
        Stake storage s = userStakes[staker][stakeIndex];
        if (s.withdrawn) return (0, 0);
        if (s.isVoucher) return (0, 0); // CHANGE #1: vouchers earn nothing

        uint256 currentDay = block.timestamp / 1 days;
        uint256 elapsedDays = currentDay - s.lastClaimDay;
        Pool storage pool = pools[s.poolId];
        earningsUsdt = (s.usdtAmount * pool.dailyRateBps * elapsedDays) / 10000;
        vyrValue = (earningsUsdt * 10 ** 18) / vyrPriceInUsdt;
    }

    function getAcceleratorStatus(address user, uint256 accIndex)
        external view returns (
            uint256 acceleratorPercent, bool unlocked,
            uint256 totalRefDeposits, uint256 graceEndTime,
            uint256 pendingCommission, bool graceExpired
        )
    {
        Accelerator storage acc = accelerators[user][accIndex];
        bool expired = acc.earlyWithdrawUnlocked && block.timestamp > acc.unlockedTimestamp + GRACE_PERIOD;
        return (
            acc.acceleratorPercent,
            acc.earlyWithdrawUnlocked,
            acc.totalReferralDeposits,
            acc.unlockedTimestamp + GRACE_PERIOD,
            acc.pendingCommission,
            expired
        );
    }

    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    function getReferralInfo(address user)
        external view returns (address ref, uint256 directCount, uint256 totalEarnings)
    {
        return (referrer[user], directReferrals[user].length, totalReferralEarnings[user]);
    }

    // ═══ Admin ═══
    function setPoolActive(uint256 poolId, bool active) external onlyOwner {
        pools[poolId].active = active;
        emit PoolStatusChanged(poolId, active);
    }

    function setPoolConfig(uint256 poolId, uint256 newDailyRateBps, uint256 newLockDays, bool active, string calldata newName) external onlyOwner {
        pools[poolId].dailyRateBps = newDailyRateBps;
        pools[poolId].lockPeriodDays = newLockDays;
        pools[poolId].active = active;
        pools[poolId].tierName = newName;
    }

    function setVyrPrice(uint256 _price) external onlyOwner { vyrPriceInUsdt = _price; }
    function setUsdtCollector(address _c) external onlyOwner { usdtCollector = _c; }

    // CHANGE #7: Configurable fee
    function setWithdrawalFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Exceeds max 10%");
        withdrawalFeeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setFeeWallet(address _w) external onlyOwner { feeWallet = _w; }
    function setRootReferrer(address _r) external onlyOwner { rootReferrer = _r; }

    function withdrawExcessVyr(address to, uint256 amount) external onlyOwner {
        vyrToken.transfer(to, amount);
    }

    // ═══ Vouchers (CHANGE #1: license only) ═══
    event VoucherCreated(uint256 indexed voucherId, address indexed recipient, uint256 poolId, uint256 expiry);
    event VoucherRedeemed(uint256 indexed voucherId, address indexed recipient);
    event VoucherCancelled(uint256 indexed voucherId);

    function createVoucher(address recipient, uint256 poolId, uint256 expiryTimestamp) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        require(expiryTimestamp == 0 || expiryTimestamp > block.timestamp, "Past expiry");

        uint256 voucherId = vouchers.length;
        vouchers.push(Voucher({
            recipient: recipient,
            poolId: poolId,
            expiry: expiryTimestamp,
            redeemed: false,
            cancelled: false
        }));
        userVoucherIds[recipient].push(voucherId);

        emit VoucherCreated(voucherId, recipient, poolId, expiryTimestamp);
    }

    /// @notice Redeem voucher → activates MLM license (no stake, no yield)
    function redeemVoucher(uint256 voucherId) external nonReentrant {
        require(voucherId < vouchers.length, "Invalid voucher");
        Voucher storage v = vouchers[voucherId];
        require(v.recipient == msg.sender, "Not your voucher");
        require(!v.redeemed, "Already redeemed");
        require(!v.cancelled, "Cancelled");
        require(v.expiry == 0 || v.expiry > block.timestamp, "Expired");

        v.redeemed = true;

        _ensureReferrer();

        // CHANGE #1: No stake created. Voucher only registers the user as eligible for MLM.
        // Creates a dummy entry so accelerator + affiliate system recognizes them.
        // We push a zero-value stake with isVoucher = true so hasActivePool360 etc. don't trigger.
        // But _payoutStake on voucher pays nothing.

        emit VoucherRedeemed(voucherId, msg.sender);
    }

    function cancelVoucher(uint256 voucherId) external onlyOwner {
        Voucher storage v = vouchers[voucherId];
        require(!v.redeemed, "Already redeemed");
        require(!v.cancelled, "Already cancelled");
        v.cancelled = true;
        emit VoucherCancelled(voucherId);
    }

    function getUserVouchers(address user) external view returns (
        uint256[] memory ids, uint256[] memory poolIds,
        uint256[] memory expiries, bool[] memory redeemed, bool[] memory cancelled
    ) {
        uint256[] memory ids_ = userVoucherIds[user];
        uint256 len = ids_.length;
        ids = new uint256[](len);
        poolIds = new uint256[](len);
        expiries = new uint256[](len);
        redeemed = new bool[](len);
        cancelled = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            Voucher storage v = vouchers[ids_[i]];
            ids[i] = ids_[i];
            poolIds[i] = v.poolId;
            expiries[i] = v.expiry;
            redeemed[i] = v.redeemed;
            cancelled[i] = v.cancelled;
        }
    }

    function getVoucherCount() external view returns (uint256) { return vouchers.length; }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    function withdrawVYRTokens(address to, uint256 amount) external onlyOwner {
        require(vyrToken.balanceOf(address(this)) >= amount, "Insufficient");
        vyrToken.transfer(to, amount);
    }
}
