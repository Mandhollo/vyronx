// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title VyronX Staking V4
/// @notice V4 fix: MLM commissions are paid DAILY on the YIELD (earnings), not on the package principal.
/// @notice claimDailyEarnings now distributes MLM commissions. withdraw() only returns principal + remaining yield.
contract VyronXStakingV4 is ReentrancyGuard {
    IERC20 public immutable usdt;
    IERC20 public immutable vyrToken;

    address public owner;
    address public usdtCollector;
    address public feeWallet = 0xCA45A82266FbFAc591D1EC0ae356b7C5bDB65D00;
    address public rootReferrer;

    uint256 public withdrawalFeeBps = 400; // 4% — editable
    uint256 public constant MAX_FEE_BPS = 1000;
    uint256 public acceleratorCommBps = 1000; // 10% USDT commission — editable
    uint256 public commFeeBps = 400; // 4% fee on USDT commissions — editable

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    // ═══ Pools ═══
    struct Pool { uint256 lockPeriodDays; uint256 dailyRateBps; bool active; string tierName; }
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
        uint256 lastClaimDay;
        bool isVoucher;
    }
    mapping(address => Stake[]) public userStakes;
    uint256 public totalStakedUsdt;
    uint256 public totalStakers;

    // ═══ Vouchers (license + accelerator participation) ═══
    struct Voucher {
        address recipient;
        uint256 poolId;
        uint256 usdtValue;     // for accelerator % calc only
        uint256 expiry;
        bool redeemed;
        bool cancelled;
    }
    Voucher[] public vouchers;
    mapping(address => uint256[]) public userVoucherIds;

    // ═══ Accelerator ═══
    struct Accelerator {
        uint256 stakeIndex;
        uint256 totalReferralDeposits;
        uint256 acceleratorPercent;
        bool earlyWithdrawUnlocked;
        uint256 unlockedTimestamp;
        uint256 pendingCommission;
        bool graceClaimed;
    }
    mapping(address => Accelerator[]) public accelerators;
    uint256 public constant GRACE_PERIOD = 12 hours;

    // ═══ Affiliate / MLM ═══
    struct AffiliateLevel { uint256 commissionBps; uint256 minStakeUsdt; uint256 minDirectReferrals; }
    AffiliateLevel[11] public affiliateLevels;
    mapping(address => address) public referrer;
    mapping(address => address[]) public directReferrals;
    mapping(address => uint256) public totalReferralEarnings;

    uint256 public vyrPriceInUsdt = 1e18;
    uint256 public constant MIN_CLAIM_USDT = 10e18;

    // V4: 4 wallets that receive the 4% fee on USDT commissions (same as sell tax wallets)
    address payable[4] public commissionFeeWallets;

    function _distributeCommissionFee(uint256 feeAmount) internal {
        if (feeAmount == 0) return;
        uint256 share = feeAmount / 4;
        uint256 remainder = feeAmount - (share * 4); // dust from rounding
        // Add remainder to last wallet
        for (uint256 i = 0; i < 4; i++) {
            uint256 amount = share;
            if (i == 3) amount += remainder;
            if (amount > 0 && commissionFeeWallets[i] != address(0)) {
                require(usdt.transfer(commissionFeeWallets[i], amount), "Fee wallet transfer failed");
            }
        }
    }

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
    event EarlyWithdrawn(address indexed staker, uint256 stakeIndex, uint256 payout);
    event VoucherCreated(uint256 indexed voucherId, address indexed recipient, uint256 poolId, uint256 usdtValue, uint256 expiry);
    event VoucherRedeemed(uint256 indexed voucherId, address indexed recipient);
    event VoucherCancelled(uint256 indexed voucherId);

    constructor(address _usdt, address _vyrToken, address _usdtCollector, address _rootReferrer) {
        usdt = IERC20(_usdt);
        vyrToken = IERC20(_vyrToken);
        usdtCollector = _usdtCollector;
        owner = msg.sender;
        rootReferrer = _rootReferrer;

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

        // V4: Initialize commission fee wallets (same as sell tax wallets)
        commissionFeeWallets[0] = payable(0x9d7f20EbB6C5D73a4CA57E53E97Fe2707FCCE720); // Collaborators
        commissionFeeWallets[1] = payable(0x76681cccEb9F03d2a054211df8FEEbcbfE817521); // Infrastructure
        commissionFeeWallets[2] = payable(0x5dBB4282cadE4C3f38F1Ff73c2141Ab0402b5eD3); // Development
        commissionFeeWallets[3] = payable(0xe9A61001c79287C300378F5caB528baec36274Cd); // Marketing
    }

    // ═══ Referral ═══
    function setReferrer(address _referrer) external {
        require(_referrer != msg.sender, "Cannot refer self");
        require(_referrer != address(0), "Invalid referrer");
        require(referrer[msg.sender] == address(0), "Referrer already set");
        referrer[msg.sender] = _referrer;
        directReferrals[_referrer].push(msg.sender);
        emit ReferralRegistered(msg.sender, _referrer);
    }

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
                uint256 commission = (usdtAmount * acceleratorCommBps) / 10000;
                // V4: 4% fee on commission, split to 4 wallets
                uint256 fee = (commission * commFeeBps) / 10000;
                uint256 netCommission = commission - fee;
                require(usdt.transfer(ref, netCommission), "Commission failed");
                _distributeCommissionFee(fee);
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
            _createAccelerator(msg.sender, userStakes[msg.sender].length - 1);

            address ref = referrer[msg.sender];
            if (ref != address(0)) _updateAccelerator(ref, usdtAmount);
        }

        emit Staked(msg.sender, poolId, usdtAmount, lockEndTime);
    }

    /// @dev Create accelerator entry for a stake (used by stake + redeemVoucher)
    function _createAccelerator(address user, uint256 stakeIdx) internal {
        accelerators[user].push(Accelerator({
            stakeIndex: stakeIdx,
            totalReferralDeposits: 0,
            acceleratorPercent: 0,
            earlyWithdrawUnlocked: false,
            unlockedTimestamp: 0,
            pendingCommission: 0,
            graceClaimed: false
        }));
    }

    // ═══ V4: Daily earnings claim + MLM commission distribution ═══
    function claimDailyEarnings(uint256 stakeIndex) external nonReentrant {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeIndex < stakes.length, "Invalid index");
        Stake storage s = stakes[stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(msg.sender == s.staker, "Not owner");
        require(!s.isVoucher, "Voucher: no yield");

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

        // V4 FIX: MLM commissions distributed on daily yield from ANY pool (not just 360)
        if (referrer[msg.sender] != address(0)) {
            _payAffiliateCommissions(msg.sender, earningsUsdt);
        }

        require(vyrToken.transfer(msg.sender, payout), "VYR transfer failed");
        if (fee > 0) require(vyrToken.transfer(feeWallet, fee), "Fee transfer failed");

        emit DailyClaimed(msg.sender, stakeIndex, payout);
    }

    // ═══ Accelerator ═══
    function _updateAccelerator(address referrerAddr, uint256 referralDeposit) internal {
        Accelerator[] storage refs = accelerators[referrerAddr];
        if (refs.length == 0) return;

        for (uint256 i = 0; i < refs.length; i++) {
            Accelerator storage acc = refs[i];
            if (acc.earlyWithdrawUnlocked && block.timestamp > acc.unlockedTimestamp + GRACE_PERIOD) continue;

            Stake storage s = userStakes[referrerAddr][acc.stakeIndex];
            if (s.withdrawn || s.poolId != POOL_360_ID) continue;

            // If accelerator completed but within 12h grace -> add to pending
            if (acc.earlyWithdrawUnlocked && !acc.graceClaimed) {
                uint256 comm = (referralDeposit * acceleratorCommBps) / 10000;
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

    function claimGraceCommission(uint256 accIndex) external nonReentrant {
        Accelerator storage acc = accelerators[msg.sender][accIndex];
        require(acc.earlyWithdrawUnlocked, "Not unlocked");
        require(!acc.graceClaimed, "Already claimed");
        require(acc.pendingCommission > 0, "Nothing pending");
        require(hasActivePool360(msg.sender), "Need active Pool 360");
        require(block.timestamp <= acc.unlockedTimestamp + GRACE_PERIOD, "Grace expired");

        acc.graceClaimed = true;
        uint256 amount = acc.pendingCommission;
        acc.pendingCommission = 0;

        // V4: 4% fee on grace commission, split to 4 wallets
        uint256 fee = (amount * commFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        require(usdt.transfer(msg.sender, netAmount), "Transfer failed");
        _distributeCommissionFee(fee);
        emit GraceClaimed(msg.sender, netAmount);
    }

    function hasActivePool360(address user) public view returns (bool) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].withdrawn && stakes[i].poolId == POOL_360_ID && !stakes[i].isVoucher) return true;
        }
        return false;
    }

    /// @dev V4: To receive MLM commissions, upline must have an active stake in ANY pool
    function hasActiveStake(address user) public view returns (bool) {
        Stake[] storage stakes = userStakes[user];
        for (uint256 i = 0; i < stakes.length; i++) {
            if (!stakes[i].withdrawn) return true;
        }
        return false;
    }

    // ═══ Payout (V4: NO MLM commissions here, only paid on claimDaily) ═══
    function _payoutStake(address staker, uint256 stakeIndex, bool isEarly) internal {
        Stake storage s = userStakes[staker][stakeIndex];
        require(!s.withdrawn, "Already withdrawn");

        if (s.isVoucher) {
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

        // V4 FIX: MLM commissions are NOT paid here anymore. They are paid on claimDailyEarnings.

        require(vyrToken.transfer(staker, payout), "VYR transfer failed");
        if (fee > 0) require(vyrToken.transfer(feeWallet, fee), "Fee transfer failed");

        emit Withdrawn(staker, stakeIndex, earningsUsdt, payout);
        if (isEarly) emit EarlyWithdrawn(staker, stakeIndex, payout);
    }

    // ═══ Withdraw principal ═══
    function withdraw(uint256 stakeIndex) external nonReentrant {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeIndex < stakes.length, "Invalid index");
        Stake storage s = stakes[stakeIndex];
        require(!s.withdrawn, "Already withdrawn");
        require(msg.sender == s.staker, "Not owner");
        require(block.timestamp >= s.lockEndTime, "Stake locked");
        _payoutStake(msg.sender, stakeIndex, false);
    }

    // ═══ Affiliate (V4: unchanged logic, but now called on daily yield) ═══
    function _payAffiliateCommissions(address staker, uint256 profitUsdt) internal {
        address current = staker;
        address upline = referrer[current];

        for (uint256 level = 0; level < 11; level++) {
            if (upline == address(0)) break;
            AffiliateLevel storage al = affiliateLevels[level];
            uint256 uplineDirects = directReferrals[upline].length;
            uint256 uplineMaxStake = _getMaxStake(upline);

            if (uplineMaxStake >= al.minStakeUsdt && uplineDirects >= al.minDirectReferrals && hasActivePool360(upline)) {
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
            if ( stakes[i].usdtAmount > maxVal) maxVal = stakes[i].usdtAmount;
        }
        return maxVal;
    }

    // ═══ Views ═══
    function getPendingEarnings(address staker, uint256 stakeIndex)
        external view returns (uint256 earningsUsdt, uint256 vyrValue)
    {
        Stake storage s = userStakes[staker][stakeIndex];
        if (s.withdrawn || s.isVoucher) return (0, 0);

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
            acc.acceleratorPercent, acc.earlyWithdrawUnlocked, acc.totalReferralDeposits,
            acc.unlockedTimestamp + GRACE_PERIOD, acc.pendingCommission, expired
        );
    }

    function getUserStakeCount(address user) external view returns (uint256) { return userStakes[user].length; }

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

    function setVyrPrice(uint256 _price) external onlyOwner { vyrPriceInUsdt = _price; emit VyrPriceUpdated(_price); }
    function setUsdtCollector(address _c) external onlyOwner { usdtCollector = _c; }
    function setWithdrawalFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "Exceeds max 10%");
        withdrawalFeeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }
    function setAcceleratorCommBps(uint256 _bps) external onlyOwner {
        require(_bps <= 2000, "Max 20%");
        acceleratorCommBps = _bps;
    }
    function setCommFeeBps(uint256 _bps) external onlyOwner {
        require(_bps <= MAX_FEE_BPS, "Exceeds max 10%");
        commFeeBps = _bps;
    }
    function setFeeWallet(address _w) external onlyOwner { feeWallet = _w; }
    function setRootReferrer(address _r) external onlyOwner { rootReferrer = _r; }
    function setCommissionFeeWallets(address payable[4] calldata _w) external onlyOwner {
        commissionFeeWallets = _w;
    }

    function withdrawExcessVyr(address to, uint256 amount) external onlyOwner {
        vyrToken.transfer(to, amount);
    }

    // ═══ Vouchers (license + accelerator) ═══
    function createVoucher(address recipient, uint256 poolId, uint256 usdtValue, uint256 expiryTimestamp) external onlyOwner {
        require(poolId < POOL_COUNT, "Invalid pool");
        require(usdtValue > 0, "Value must be > 0");
        require(expiryTimestamp == 0 || expiryTimestamp > block.timestamp, "Past expiry");

        uint256 voucherId = vouchers.length;
        vouchers.push(Voucher({
            recipient: recipient,
            poolId: poolId,
            usdtValue: usdtValue,
            expiry: expiryTimestamp,
            redeemed: false,
            cancelled: false
        }));
        userVoucherIds[recipient].push(voucherId);

        emit VoucherCreated(voucherId, recipient, poolId, usdtValue, expiryTimestamp);
    }

    /// @notice Redeem voucher -> creates virtual Pool 360 stake + accelerator entry
    function redeemVoucher(uint256 voucherId) external nonReentrant {
        require(voucherId < vouchers.length, "Invalid voucher");
        Voucher storage v = vouchers[voucherId];
        require(v.recipient == msg.sender, "Not your voucher");
        require(!v.redeemed, "Already redeemed");
        require(!v.cancelled, "Cancelled");
        require(v.expiry == 0 || v.expiry > block.timestamp, "Expired");

        v.redeemed = true;
        _ensureReferrer();

        // V3+: Create virtual Pool 360 stake so voucher holder participates in accelerator
        userStakes[msg.sender].push(Stake({
            staker: msg.sender,
            poolId: POOL_360_ID,
            usdtAmount: v.usdtValue,
            startTime: block.timestamp,
            lockEndTime: block.timestamp + 360 days,
            withdrawn: false,
            lastClaimDay: block.timestamp / 1 days,
            isVoucher: true
        }));

        // Create accelerator entry
        _createAccelerator(msg.sender, userStakes[msg.sender].length - 1);

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
        uint256[] memory ids, uint256[] memory poolIds, uint256[] memory usdtValues,
        uint256[] memory expiries, bool[] memory redeemed, bool[] memory cancelled
    ) {
        uint256[] memory ids_ = userVoucherIds[user];
        uint256 len = ids_.length;
        ids = new uint256[](len);
        poolIds = new uint256[](len);
        usdtValues = new uint256[](len);
        expiries = new uint256[](len);
        redeemed = new bool[](len);
        cancelled = new bool[](len);
        for (uint256 i = 0; i < len; i++) {
            Voucher storage v = vouchers[ids_[i]];
            ids[i] = ids_[i];
            poolIds[i] = v.poolId;
            usdtValues[i] = v.usdtValue;
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
