// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {VyronXToken} from "../src/VyronXToken.sol";
import {VyronXPresale} from "../src/VyronXPresale.sol";
import {VyronXStaking} from "../src/VyronXStaking.sol";
import {MockRouter, MockFactory} from "../src/mocks/MockDEX.sol";

/// @title E2E Test — Full dApp simulation
contract VyronXE2ETest is Test {
    MockUSDT usdt;
    VyronXToken token;
    VyronXPresale presale;
    VyronXStaking staking;

    address deployer = makeAddr("deployer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address dave = makeAddr("dave");

    function setUp() public {
        // Deploy everything
        vm.startPrank(deployer);

        // Deploy mock DEX router
        MockFactory factory = new MockFactory();
        MockRouter router = new MockRouter(address(factory), address(0xBEEF));
        token = new VyronXToken(address(router));
        usdt = new MockUSDT();
        presale = new VyronXPresale(
            address(token), address(usdt),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer)
        );
        staking = new VyronXStaking(address(usdt), address(token), payable(deployer));

        // Configure
        token.setAuthorized(address(presale), true);
        token.setAuthorized(address(staking), true);
        token.setExcludedFromFees(address(presale), true);
        token.setExcludedFromFees(address(staking), true);
        token.setExcludedFromLimits(address(presale), true);
        token.setExcludedFromLimits(address(staking), true);

        token.transfer(address(presale), 300_000_000 ether);
        token.approve(address(staking), 500_000_000 ether);
        staking.fundRewardPool(500_000_000 ether);

        presale.setPhase(0, 1, 20, 75_000_000); // $0.01, 20% bonus
        presale.setCurrentPhase(0);
        presale.startPresale();

        staking.setPoolActive(0, true);
        staking.setPoolActive(1, true);
        staking.setPoolActive(2, true);
        staking.setPoolActive(3, true);

        // Mint USDT to test users
        usdt.mint(alice, 100_000 * 1e18);
        usdt.mint(bob, 100_000 * 1e18);
        usdt.mint(charlie, 100_000 * 1e18);
        usdt.mint(dave, 100_000 * 1e18);

        vm.stopPrank();
    }

    // ════════════════════════════════════════════════════════════
    // TEST 1: Buy VYR from Presale
    // ════════════════════════════════════════════════════════════
    function test_Presale_BuyVYR() public {
        vm.startPrank(alice);

        // Approve USDT
        usdt.approve(address(presale), 10_000 * 1e18);

        // Check balance before
        uint256 usdtBefore = usdt.balanceOf(alice);
        uint256 vyrBefore = token.balanceOf(alice);

        // Buy with $10,000
        presale.buyWithUsdt(10_000 * 1e18);

        uint256 usdtAfter = usdt.balanceOf(alice);
        uint256 vyrAfter = token.balanceOf(alice);

        vm.stopPrank();

        // Assertions
        assertEq(usdtBefore - usdtAfter, 10_000 * 1e18, "USDT spent");
        // $10,000 / $0.01 = 1,000,000 VYR + 20% bonus = 1,200,000 VYR
        assertEq(vyrAfter - vyrBefore, 1_200_000 ether, "VYR received with bonus");

        console.log("=== TEST 1: PRESALE BUY ===");
        console.log("USDT spent:", usdtBefore - usdtAfter);
        console.log("VYR received:", vyrAfter - vyrBefore);
        console.log("PASS!");
    }

    // ════════════════════════════════════════════════════════════
    // TEST 2: Stake in Pool 30
    // ════════════════════════════════════════════════════════════
    function test_Staking_Pool30() public {
        vm.startPrank(bob);

        usdt.approve(address(staking), 10_000 * 1e18);
        staking.stake(0, 10_000 * 1e18); // Pool 0 = 30 days

        uint256 stakeCount = staking.getUserStakeCount(bob);
        assertEq(stakeCount, 1, "Should have 1 stake");

        // Fast forward 30 days
        vm.warp(block.timestamp + 31 days);

        (uint256 earningsUsdt, uint256 vyrValue) = staking.getPendingEarnings(bob, 0);

        // Expected: 10,000 * 0.11% * 31 = 341 USDT
        assertGt(earningsUsdt, 0, "Should have earnings");
        assertGt(vyrValue, 0, "Should have VYR value");

        console.log("=== TEST 2: STAKE POOL 30 ===");
        console.log("USDT staked: 10,000");
        console.log("Days elapsed: 31");
        console.log("Earnings (USDT):", earningsUsdt);
        console.log("VYR value:", vyrValue);
        console.log("PASS!");

        vm.stopPrank();
    }

    // ════════════════════════════════════════════════════════════
    // TEST 3: Accelerator + Affiliate
    // ════════════════════════════════════════════════════════════
    function test_Accelerator_And_Affiliate() public {
        // Alice stakes $100 in Pool 360
        vm.startPrank(alice);
        usdt.approve(address(staking), 100 * 1e18);
        staking.stake(3, 100 * 1e18); // Pool 3 = 360 days
        vm.stopPrank();

        // Bob registers Alice as referrer
        vm.prank(bob);
        staking.setReferrer(alice);

        // Charlie registers Alice as referrer
        vm.prank(charlie);
        staking.setReferrer(alice);

        // Check Alice's USDT balance before Bob stakes
        uint256 aliceUsdtBefore = usdt.balanceOf(alice);

        // Bob stakes $200 in Pool 360
        vm.startPrank(bob);
        usdt.approve(address(staking), 200 * 1e18);
        staking.stake(3, 200 * 1e18);
        vm.stopPrank();

        // Alice should have received 10% of $200 = $20 USDT commission immediately
        uint256 aliceUsdtAfterBob = usdt.balanceOf(alice);
        assertEq(aliceUsdtAfterBob - aliceUsdtBefore, 20 * 1e18, "Alice should get $20 USDT commission from Bob");

        // Check accelerator — Alice should be at 20% ($20/$100)
        (uint256 accPercent1, bool unlocked1, uint256 totalRef1) = staking.getAcceleratorStatus(alice, 0);
        assertEq(accPercent1, 20, "Accelerator should be 20% after Bob stakes $200");
        assertFalse(unlocked1, "Should not be unlocked yet");

        // Check Alice's USDT balance before Charlie stakes
        uint256 aliceUsdtBeforeCharlie = usdt.balanceOf(alice);

        // Charlie stakes $500 in Pool 360
        vm.startPrank(charlie);
        usdt.approve(address(staking), 500 * 1e18);
        staking.stake(3, 500 * 1e18);
        vm.stopPrank();

        // Alice should have received 10% of $500 = $50 USDT commission immediately
        uint256 aliceUsdtAfterCharlie = usdt.balanceOf(alice);
        assertEq(aliceUsdtAfterCharlie - aliceUsdtBeforeCharlie, 50 * 1e18, "Alice should get $50 USDT commission from Charlie");

        // Check accelerator — Alice should be at 70% ($70/$100)
        (uint256 accPercent2, bool unlocked2, uint256 totalRef2) = staking.getAcceleratorStatus(alice, 0);
        assertEq(accPercent2, 70, "Accelerator should be 70% after Charlie stakes $500");
        assertFalse(unlocked2, "Should not be unlocked yet");

        // Dave registers Alice as referrer and stakes $300 → accelerator reaches 100%
        // ($200+$500+$300 = $1000 total referrals → 100% of Alice's $100 stake)
        vm.prank(dave);
        staking.setReferrer(alice);

        uint256 aliceVyrBeforeAuto = token.balanceOf(alice);

        vm.startPrank(dave);
        usdt.approve(address(staking), 300 * 1e18);
        staking.stake(3, 300 * 1e18);
        vm.stopPrank();

        // Alice's stake should be AUTO-LIQUIDATED
        // She should have received VYR (principal + earnings - 10% fee)
        uint256 aliceVyrAfterAuto = token.balanceOf(alice);
        assertGt(aliceVyrAfterAuto, aliceVyrBeforeAuto, "Alice should have received VYR from auto-liquidation");

        // Verify stake is marked as withdrawn
        (address sStaker, uint256 sPool, uint256 sUsdt, uint256 sStart, uint256 sEnd, bool sWithdrawn, uint256 sEarn) = staking.userStakes(alice, 0);
        assertTrue(sWithdrawn, "Alice's stake should be marked withdrawn after auto-liquidation");

        console.log("=== TEST 3: ACCELERATOR + USDT COMMISSION + AUTO-LIQUIDATE ===");
        console.log("Alice stake: $100 (Pool 360)");
        console.log("Bob referral: $200 -> Alice got $20 USDT + 20% accelerator");
        console.log("Charlie referral: $500 -> Alice got $50 USDT + 50% accelerator (total 70%)");
        console.log("Dave referral: $300 -> accelerator hit 100% -> AUTO-LIQUIDATED!");
        console.log("Alice total USDT commission: $70");
        console.log("Alice VYR received from auto-liquidation:", aliceVyrAfterAuto - aliceVyrBeforeAuto);
        console.log("Stake withdrawn:", sWithdrawn);
        console.log("PASS!");
    }

    // ════════════════════════════════════════════════════════════
    // TEST 4: Full Withdraw Flow
    // ════════════════════════════════════════════════════════════
    function test_Withdraw_After_Maturity() public {
        // Bob stakes $1,000 in Pool 30
        vm.startPrank(bob);
        usdt.approve(address(staking), 1_000 * 1e18);
        staking.stake(0, 1_000 * 1e18);

        uint256 vyrBefore = token.balanceOf(bob);

        // Fast forward 31 days
        vm.warp(block.timestamp + 31 days);

        // Withdraw
        staking.withdraw(0);

        uint256 vyrAfter = token.balanceOf(bob);
        assertGt(vyrAfter, vyrBefore, "Should receive VYR");

        // Verify he received PRINCIPAL + EARNINGS minus 10% fee
        // Earnings: $1000 * 0.11% * 31 days = $3.41 USDT
        // Total: $1000 + $3.41 = $1003.41 USDT → 1034.1 VYR
        // After 10% fee: 1034.1 * 0.9 = 930.69 VYR
        uint256 vyrEarned = vyrAfter - vyrBefore;
        assertApproxEqAbs(vyrEarned, 930_690_000_000_000_000_000, 1e17, "Should receive 90% of (principal + earnings)");

        console.log("=== TEST 4: WITHDRAW (principal + earnings - 10% fee) ===");
        console.log("Staked: $1000 USDT (Pool 30, 31 days)");
        console.log("Total: $1003.41 = 1034.1 VYR");
        console.log("After 10% fee: 930.69 VYR");
        console.log("VYR received:", vyrEarned);
        console.log("PASS!");

        vm.stopPrank();
    }

    // ════════════════════════════════════════════════════════════
    // TEST 5: Affiliate Commission
    // ════════════════════════════════════════════════════════════
    function test_Affiliate_Commission() public {
        // Alice stakes $100 in Pool 360 (qualifies for Level 1)
        vm.startPrank(alice);
        usdt.approve(address(staking), 100 * 1e18);
        staking.stake(3, 100 * 1e18);
        vm.stopPrank();

        // Bob registers Alice as referrer
        vm.prank(bob);
        staking.setReferrer(alice);

        // Bob stakes $1,000 in Pool 360
        vm.startPrank(bob);
        usdt.approve(address(staking), 1000 * 1e18);
        staking.stake(3, 1000 * 1e18);

        uint256 aliceVyrBefore = token.balanceOf(alice);

        // Fast forward 360 days
        vm.warp(block.timestamp + 361 days);

        // Bob withdraws — Alice should get 7% commission on Bob's profit
        staking.withdraw(0);

        uint256 aliceVyrAfter = token.balanceOf(alice);

        console.log("=== TEST 5: AFFILIATE COMMISSION ===");
        console.log("Alice (referrer) VYR before:", aliceVyrBefore);
        console.log("Alice (referrer) VYR after:", aliceVyrAfter);
        console.log("Commission earned:", aliceVyrAfter - aliceVyrBefore);
        assertGt(aliceVyrAfter, aliceVyrBefore, "Alice should earn commission");
        console.log("PASS!");

        vm.stopPrank();
    }
}
