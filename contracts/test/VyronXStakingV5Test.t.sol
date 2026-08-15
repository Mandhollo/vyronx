// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV5.sol";

contract MockERC20 is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

contract VyronXStakingV5Test is Test {
    VyronXStakingV5 staking;
    MockERC20 usdt;
    MockERC20 vyr;
    address owner = address(0x1111);
    address promoter = address(0x2222);
    address investor = address(0x3333);

    function setUp() public {
        usdt = new MockERC20();
        vyr = new MockERC20();
        usdt.mint(investor, 100000e18);
        vyr.mint(address(this), 500_000_000e18);
        address collector = address(0xC011);
        vm.prank(owner);
        staking = new VyronXStakingV5(address(usdt), address(vyr), collector, owner);
        vyr.transfer(address(staking), 500_000_000e18);
        vm.prank(owner);
        staking.setPoolActive(3, true);
        vm.prank(owner);
        staking.setPoolActive(0, true);
        vm.startPrank(investor);
        usdt.approve(address(staking), type(uint256).max);
        vm.stopPrank();
    }

    /// @dev V4 CRITICAL TEST: MLM commission must be calculated on YIELD (5/day), NOT on principal ($1000)
    function test_MLM_PaysOnYieldNotPrincipal() public {
        // Setup: promoter stakes $1000 in Pool 360
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        // Investor stakes $1000 in Pool 360, referred by promoter
        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        // Fast forward 3 days (yield: $1000 * 0.005 * 3 = $15 > $10 min)
        vm.warp(block.timestamp + 3 days);

        // Investor claims daily earnings
        vm.prank(investor);
        staking.claimDailyEarnings(0);

        // Pool 360 rate: 0.50% daily = 50 bps
        // Investor yield: $1000 * 0.005 * 3 days = $15 yield
        // Promoter commission (Level 1): 7% of $15 = $1.05 yield
        // In V3: Promoter would have gotten 7% of $1000 = $70 (WRONG)
        // In V4: Promoter gets 7% of $15 = $1.05 (CORRECT)

        uint256 promoterEarnings = staking.totalReferralEarnings(promoter);
        assertEq(promoterEarnings, 1.05e18, "V4: promoter should earn 7% of $15 yield = $1.05");

        // Make sure it's NOT the V3 buggy amount ($70 = 7% of $1000)
        assertNotEq(promoterEarnings, 70e18, "V4: promoter must NOT earn on principal");
    }

    /// @dev V4: Daily claim should distribute commissions to upline immediately
    function test_DailyClaim_DistributesMLM() public {
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 3 days);
        vm.prank(investor);
        staking.claimDailyEarnings(0); // Should trigger MLM payout

        assertGt(staking.totalReferralEarnings(promoter), 0, "MLM should be distributed on daily claim");
    }

    /// @dev V4: Withdraw (principal) should NOT pay MLM commissions anymore
    function test_Withdraw_DoesNotPayMLM() public {
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        // Fast forward past lock (360 days)
        vm.warp(block.timestamp + 400 days);

        // Investor withdraws principal
        vm.prank(investor);
        staking.withdraw(0);

        // Promoter should have ZERO MLM earnings (no daily claims were made)
        assertEq(staking.totalReferralEarnings(promoter), 0, "Withdraw should NOT pay MLM");
    }

    function test_Voucher_ParticipatesInAccelerator() public {
        vm.prank(owner);
        staking.createVoucher(promoter, 3, 1100e18, 0);
        vm.prank(promoter);
        staking.redeemVoucher(0);
        assertEq(staking.getUserStakeCount(promoter), 1);

        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 200e18);
        vm.stopPrank();

        // promoter should have received $20 - 4% = $19.20 USDT (net commission)
        assertEq(usdt.balanceOf(promoter), 19.2e18, "promoter should have received net 10% USDT commission");
        (uint256 pct,,, , ,) = staking.getAcceleratorStatus(promoter, 0);
        assertGt(pct, 0, "accelerator percent should be > 0");
    }

    function test_Voucher_NoYield() public {
        vm.prank(owner);
        staking.createVoucher(promoter, 3, 1100e18, 0);
        vm.prank(promoter);
        staking.redeemVoucher(0);

        vm.warp(block.timestamp + 10 days);
        vm.expectRevert("Voucher: no yield");
        vm.prank(promoter);
        staking.claimDailyEarnings(0);
    }

    function test_Voucher_NoPrincipalReturn() public {
        vm.prank(owner);
        staking.createVoucher(promoter, 3, 1100e18, 0);
        vm.prank(promoter);
        staking.redeemVoucher(0);

        vm.warp(block.timestamp + 400 days);
        uint256 promoterVyrBefore = vyr.balanceOf(promoter);

        vm.prank(promoter);
        staking.withdraw(0);

        assertEq(vyr.balanceOf(promoter), promoterVyrBefore, "voucher should return no principal");
    }

    function test_FeeIs4Percent() public {
        assertEq(staking.withdrawalFeeBps(), 400);
    }

    function test_OwnerIsRootReferrer() public {
        assertEq(staking.rootReferrer(), owner);
    }

    /// @dev V4: Accelerator USDT commission should deduct 4% fee (split to 4 wallets)
    function test_AcceleratorCommission_Has4PercentFee() public {
        // Promoter stakes $1100 in Elite
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 1100e18);
        vm.stopPrank();

        // Investor stakes $1000 in Elite, referred by promoter
        uint256 investorUstdBefore = usdt.balanceOf(investor);
        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 1000e18); // 10% = $100 commission
        vm.stopPrank();

        // Promoter balance: $2000 minted - $1100 staked + $96 net commission = $996
        uint256 promoterUstd = usdt.balanceOf(promoter);
        assertEq(promoterUstd, 996e18, "Promoter should have $996 ($900 + $96 net commission)");

        // 4 wallets should each have received their share of the 4% fee
        // Note: they may also receive fees from other tests in the suite, so we check >= $1
        address w1 = staking.commissionFeeWallets(0);
        address w2 = staking.commissionFeeWallets(1);
        address w3 = staking.commissionFeeWallets(2);
        address w4 = staking.commissionFeeWallets(3);
        assertGe(usdt.balanceOf(w1), 1e18, "Wallet 1 should have >= $1");
        assertGe(usdt.balanceOf(w2), 1e18, "Wallet 2 should have >= $1");
        assertGe(usdt.balanceOf(w3), 1e18, "Wallet 3 should have >= $1");
        assertGe(usdt.balanceOf(w4), 1e18, "Wallet 4 should have >= $1");
    }

    /// @dev V5: MLM is paid ONLY on Elite (360) pool yield — Starter/Growth/Pro pay NOTHING
    function test_MLM_NonElitePool_PaysNothing() public {
        // Promoter stakes $1100 in Pool 360 (Elite) to qualify
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 1100e18); // Elite
        vm.stopPrank();

        // Investor stakes $100 in Growth (60d lock), referred by promoter
        vm.prank(owner);
        staking.setPoolActive(1, true); // Growth
        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(1, 100e18); // Growth ($50-$250)
        vm.stopPrank();

        // Fast forward 50 days (yield: $100 * 0.0023 * 50 = $11.50 > $10 min; lock 60d still active)
        vm.warp(block.timestamp + 50 days);
        vm.prank(investor);
        staking.claimDailyEarnings(0);

        // V5: Growth yield pays NO MLM commission — unilevel is Elite-360 only
        assertEq(staking.totalReferralEarnings(promoter), 0, "Non-Elite pool must NOT pay MLM");
    }

    /// @dev V4: Upline without Elite stake should NOT receive MLM
    function test_MLM_NoEliteNoPay() public {
        // Promoter stakes $1100 in Pool 0 (Starter) - NOT Elite
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(0, 100e18); // Starter only (max $100)
        vm.stopPrank();

        // Investor stakes $1000 in Pool 360, referred by promoter
        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 3 days);

        vm.prank(investor);
        staking.claimDailyEarnings(0);

        // Promoter should get ZERO because no Elite stake
        assertEq(staking.totalReferralEarnings(promoter), 0, "Promoter without Elite should NOT receive MLM");
    }
}

contract VyronXStakingV5MigrationTest is Test {
    VyronXStakingV5 staking;
    MockERC20 usdt;
    MockERC20 vyr;
    address owner = address(0x1111);
    address promoter = address(0x2222);
    address investor = address(0x3333);

    function setUp() public {
        usdt = new MockERC20();
        vyr = new MockERC20();
        usdt.mint(investor, 100000e18);
        vyr.mint(address(this), 500_000_000e18);
        address collector = address(0xC011);
        vm.prank(owner);
        staking = new VyronXStakingV5(address(usdt), address(vyr), collector, owner);
        vyr.transfer(address(staking), 500_000_000e18);
        vm.prank(owner);
        staking.setPoolActive(3, true);
        vm.startPrank(investor);
        usdt.approve(address(staking), type(uint256).max);
        vm.stopPrank();
    }

    /// @dev Migrated voucher (via migrateVoucher) should receive MLM commissions
    function test_MigratedVoucher_ReceivesMLM() public {
        // Step 1: Owner migrates a voucher for promoter
        vm.prank(owner);
        staking.migrateVoucher(promoter, 3, 1100e18, owner);

        // Verify migration
        assertEq(staking.getVoucherCount(), 1, "Voucher should be migrated");
        assertEq(staking.getUserStakeCount(promoter), 1, "Promoter should have 1 virtual stake");
        (address ref,,) = staking.getReferralInfo(promoter);
        assertEq(ref, owner, "Promoter referrer should be owner");

        // Step 2: Investor stakes in Elite, referred by promoter
        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 1000e18);
        vm.stopPrank();

        // Step 3: Fast forward 3 days
        vm.warp(block.timestamp + 3 days);

        // Step 4: Investor claims daily earnings
        vm.prank(investor);
        staking.claimDailyEarnings(0);

        // Step 5: Owner (upline of promoter) should receive MLM commission
        // Promoter has voucher (Pool 360 active), so qualifies for MLM
        // But promoter is Level 1 (direct referrer of investor)
        // Commission: $15 yield * 7% = $1.05
        assertGt(staking.totalReferralEarnings(promoter), 0, "Migrated voucher holder should receive MLM");
    }

    /// @dev Migrated voucher with batch should preserve referral chain
    function test_MigratedVoucherBatch_PreservesChain() public {
        address[] memory recipients = new address[](2);
        recipients[0] = promoter;
        recipients[1] = investor;

        uint256[] memory poolIds = new uint256[](2);
        poolIds[0] = 3;
        poolIds[1] = 3;

        uint256[] memory values = new uint256[](2);
        values[0] = 1100e18;
        values[1] = 1100e18;

        address[] memory refs = new address[](2);
        refs[0] = owner;        // promoter referred by owner
        refs[1] = promoter;     // investor referred by promoter

        vm.prank(owner);
        staking.migrateVoucherBatch(recipients, poolIds, values, refs);

        // Verify chain: owner → promoter → investor
        (address pRef,,) = staking.getReferralInfo(promoter);
        (address iRef,,) = staking.getReferralInfo(investor);
        assertEq(pRef, owner, "Promoter referrer = owner");
        assertEq(iRef, promoter, "Investor referrer = promoter");

        // Verify both have virtual stakes
        assertEq(staking.getUserStakeCount(promoter), 1);
        assertEq(staking.getUserStakeCount(investor), 1);
    }
}
