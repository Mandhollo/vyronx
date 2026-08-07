// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV3.sol";

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

contract VyronXStakingV3Test is Test {
    VyronXStakingV3 staking;
    MockERC20 usdt;
    MockERC20 vyr;
    address owner = address(0x1111);
    address promoter = address(0x2222);
    address investor = address(0x3333);

    function setUp() public {
        usdt = new MockERC20();
        vyr = new MockERC20();
        // mint USDT to investor
        usdt.mint(investor, 1000e18);
        // mint VYR to this test contract (for staking rewards)
        vyr.mint(address(this), 500_000_000e18);
        // deploy staking (msg.sender = owner here)
        address collector = address(0xC011);
        vm.prank(owner);
        staking = new VyronXStakingV3(address(usdt), address(vyr), collector, owner);
        // fund staking contract with VYR
        vyr.transfer(address(staking), 500_000_000e18);
        // open pool 360 (call as owner)
        vm.prank(owner);
        staking.setPoolActive(3, true);
        // open pool 0 too
        vm.prank(owner);
        staking.setPoolActive(0, true);
        // approve USDT for investor
        vm.startPrank(investor);
        usdt.approve(address(staking), type(uint256).max);
        vm.stopPrank();
    }

    function test_Voucher_ParticipatesInAccelerator() public {
        // owner creates voucher for promoter with value $1100
        vm.prank(owner);
        staking.createVoucher(promoter, 3, 1100e18, 0);
        assertEq(staking.getVoucherCount(), 1);

        // promoter redeems (auto-attaches to root as referrer)
        vm.prank(promoter);
        staking.redeemVoucher(0);
        assertEq(staking.getUserStakeCount(promoter), 1);

        // investor stakes $200 on pool 360, referred by promoter
        vm.startPrank(investor);
        staking.setReferrer(promoter);
        staking.stake(3, 200e18);
        vm.stopPrank();

        // promoter should have received $20 USDT (10% of $200)
        assertEq(usdt.balanceOf(promoter), 20e18, "promoter should have received 10% USDT commission");

        // accelerator should have progressed (200/1100*10 = ~1.8 → truncated to 1%)
        (uint256 pct,,, , ,) = staking.getAcceleratorStatus(promoter, 0);
        assertGt(pct, 0, "accelerator percent should be > 0");
    }

    function test_Voucher_NoYield() public {
        // create + redeem voucher
        vm.prank(owner);
        staking.createVoucher(promoter, 3, 1100e18, 0);
        vm.prank(promoter);
        staking.redeemVoucher(0);

        // fast forward 10 days
        vm.warp(block.timestamp + 10 days);

        // try to claim daily earnings — should revert
        vm.expectRevert("Voucher: no yield");
        vm.prank(promoter);
        staking.claimDailyEarnings(0);
    }

    function test_Voucher_NoPrincipalReturn() public {
        // create + redeem voucher
        vm.prank(owner);
        staking.createVoucher(promoter, 3, 1100e18, 0);
        vm.prank(promoter);
        staking.redeemVoucher(0);

        // fast forward 400 days (past lock)
        vm.warp(block.timestamp + 400 days);

        uint256 promoterVyrBefore = vyr.balanceOf(promoter);

        // try to withdraw — voucher pays nothing
        vm.prank(promoter);
        staking.withdraw(0);

        uint256 promoterVyrAfter = vyr.balanceOf(promoter);
        assertEq(promoterVyrAfter, promoterVyrBefore, "voucher should return no principal");
    }

    function test_Stake_YieldsAndPrincipal() public {
        // Regular stake should yield
        usdt.mint(investor, 1000e18);
        vm.startPrank(investor);
        staking.stake(3, 100e18);
        vm.stopPrank();

        // fast forward 10 days
        vm.warp(block.timestamp + 10 days);

        // (pendingEarnings, vyrValue) = staking.getPendingEarnings(investor, 0)
        (uint256 earningsUsdt,) = staking.getPendingEarnings(investor, 0);
        // 100 * 0.005 * 10 = 5 USDT
        assertEq(earningsUsdt, 5e18, "10 days earnings should be 5 USDT");
    }

    function test_RegularStake_PrincipalReturned() public {
        usdt.mint(investor, 1000e18);
        vm.prank(investor);
        staking.setReferrer(owner);

        vm.startPrank(investor);
        staking.stake(3, 100e18);
        vm.stopPrank();

        vm.warp(block.timestamp + 400 days);

        uint256 vyrBefore = vyr.balanceOf(investor);
        vm.prank(investor);
        staking.withdraw(0);
        uint256 vyrAfter = vyr.balanceOf(investor);

        assertGt(vyrAfter, vyrBefore, "regular stake should return principal");
    }

    function test_DailyClaim_Minimum() public {
        usdt.mint(investor, 1000e18);
        vm.prank(investor);
        staking.setReferrer(owner);
        vm.startPrank(investor);
        staking.stake(3, 100e18);
        vm.stopPrank();

        // day 1: earn 0.5 USDT — below $10 min
        vm.warp(block.timestamp + 1 days);
        vm.expectRevert("Min $10 to claim");
        vm.prank(investor);
        staking.claimDailyEarnings(0);

        // day 20: earn 10 USDT — can claim now
        vm.warp(block.timestamp + 20 days);
        vm.prank(investor);
        staking.claimDailyEarnings(0); // should succeed
    }

    function test_FeeIs4Percent() public {
        assertEq(staking.withdrawalFeeBps(), 400, "fee should be 4% (400 bps)");
    }

    function test_OwnerIsRootReferrer() public {
        assertEq(staking.rootReferrer(), owner, "owner should be MLM root");
    }

    function test_VoucherValueCannotBeZero() public {
        vm.prank(owner);
        vm.expectRevert("Value must be > 0");
        staking.createVoucher(promoter, 3, 0, 0);
    }
}
