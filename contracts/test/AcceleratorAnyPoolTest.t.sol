// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {VyronXStakingV5} from "../src/VyronXStakingV5.sol";
import {MockERC20L} from "./PoolLimitsTest.t.sol";

/// @dev V5 final rule: a referral deposit in ANY pool (Starter/Growth/Pro/Elite)
///      triggers the full accelerator package for the 360-enabled upline:
///      instant 10% USDT commission + accelerator progress + MLM commissions.
///      The accelerator ENTRY (auto-liquidation, 12h grace) belongs to the Elite stake.
contract AcceleratorAnyPoolTest is Test {
    VyronXStakingV5 internal staking;
    MockERC20L internal usdt;
    MockERC20L internal vyr;

    address internal owner = address(0x1111);
    address internal promoter = address(0x2222); // 360-enabled
    address internal investor = address(0x3333); // stakes Growth

    function setUp() public {
        usdt = new MockERC20L();
        vyr = new MockERC20L();
        vyr.mint(address(this), 5_000_000e18);
        staking = new VyronXStakingV5(address(usdt), address(vyr), address(0xC011), owner);
        vyr.transfer(address(staking), 5_000_000e18);
        staking.setPoolActive(1, true); // Growth
        staking.setPoolActive(0, true); // Starter
        staking.setPoolActive(3, true); // Elite

        usdt.mint(promoter, 100e18);
        usdt.mint(investor, 250e18);

        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 100e18); // Elite 360 — enables accelerator
        vm.stopPrank();

        vm.startPrank(investor);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(promoter);
        vm.stopPrank();
    }

    /// Instant 10% USDT commission fires on a GROWTH deposit (not just Elite)
    function test_InstantCommission_OnGrowthDeposit() public {
        uint256 before = usdt.balanceOf(promoter);
        vm.prank(investor);
        staking.stake(1, 250e18); // Growth
        uint256 gained = usdt.balanceOf(promoter) - before;
        // 10% of $250 = $25 gross, minus 4% fee split = $24 net
        assertEq(gained, 24e18, "Promoter must receive 9.6% of Growth deposit");
    }

    /// Accelerator progress counts deposits from ANY pool
    function test_AcceleratorProgress_CountsGrowthDeposit() public {
        vm.prank(investor);
        staking.stake(1, 250e18); // Growth $250

        (, uint256 deposits, uint256 pct,,,,) = staking.accelerators(promoter, 0);
        assertEq(deposits, 250e18, "Growth deposit must feed accelerator progress");
        // $250 deposits vs $100 Elite stake -> 25% progress
        assertEq(pct, 25, "Accelerator percent must be 25%");
    }

    /// A NON-360-enabled referrer gets NO instant commission from any pool deposit
    function test_NonEnabledReferrer_GetsNoInstantCommission() public {
        address stranger = address(0x4444); // only Starter, not enabled
        usdt.mint(stranger, 100e18);
        vm.startPrank(stranger);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(promoter);
        staking.stake(0, 100e18); // Starter (30d)
        vm.stopPrank();

        // Now a referral of STRANGER deposits Growth; stranger is not 360-enabled
        address follower = address(0x5555);
        usdt.mint(follower, 250e18);
        vm.startPrank(follower);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(stranger);
        vm.stopPrank();

        uint256 before = usdt.balanceOf(stranger);
        vm.prank(follower);
        staking.stake(1, 250e18); // Growth
        assertEq(usdt.balanceOf(stranger) - before, 0, "Not 360-enabled -> no instant commission");
    }

    /// MLM commission is paid on Growth yield claims (unilevel on all pools)
    function test_MLM_PaidOnGrowthYield() public {
        vm.prank(investor);
        staking.stake(1, 250e18); // Growth 60d 0.23%/day

        vm.warp(block.timestamp + 20 days); // $250 * 0.23% * 20d = $11.50 >= $10 min claim
        vm.prank(investor);
        staking.claimDailyEarnings(0);

        // promoter: L1 (owner-level? no—promoter's referrer is owner).
        // investor's referrer is promoter; promoter qualifies: has Elite 360 +
        // $100 staked + needs 1 qualified direct (L1 requires 1 direct with $100+).
        // investor staked $250 >= $100 -> qualified.
        assertGt(staking.totalReferralEarnings(promoter), 0, "MLM must pay on Growth yield");
    }
}
