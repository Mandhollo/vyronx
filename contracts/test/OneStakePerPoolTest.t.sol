// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV5.sol";

contract MockERC20O is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= allowance[from][msg.sender]; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
}

contract OneStakePerPoolTest is Test {
    VyronXStakingV5 staking;
    MockERC20O usdt;
    MockERC20O vyr;
    address user = address(0x9999);
    address owner = address(0x1111);

    function setUp() public {
        usdt = new MockERC20O();
        vyr = new MockERC20O();
        vyr.mint(address(this), 500_000_000e18);
        staking = new VyronXStakingV5(address(usdt), address(vyr), address(0xC011), owner);
        vyr.transfer(address(staking), 500_000_000e18);
        staking.setPoolActive(0, true); // Starter
        staking.setPoolActive(3, true); // Elite
        usdt.mint(user, 10_000e18);
        vm.startPrank(user);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        vm.stopPrank();
    }

    /// Second ACTIVE stake in Starter (capped pool) is blocked
    function test_SecondActiveStake_SamePool_Blocked() public {
        vm.startPrank(user);
        staking.stake(0, 100e18); // Starter max
        vm.expectRevert("Active stake exists in this pool");
        staking.stake(0, 50e18); // second active -> revert
        vm.stopPrank();
    }

    /// After the previous stake is WITHDRAWN, a new stake in the same pool is allowed
    function test_NewStakeAfterWithdrawal_Allowed() public {
        vm.startPrank(user);
        staking.stake(0, 100e18);
        vm.warp(block.timestamp + 31 days); // lock ends
        staking.withdraw(0);
        staking.stake(0, 100e18); // OK — previous withdrawn
        vm.stopPrank();
    }

    /// Elite (no ceiling) allows MULTIPLE simultaneous stakes
    function test_Elite_MultipleSimultaneousStakes() public {
        vm.startPrank(user);
        staking.stake(3, 1000e18);
        staking.stake(3, 2000e18);
        staking.stake(3, 500e18);
        vm.stopPrank();
        // 3 active Elite stakes coexist
        (, uint256 pid3, uint256 amt3,,,,, ) = staking.userStakes(user, 2);
        assertEq(pid3, 3);
        assertEq(amt3, 500e18);
    }

    /// Different pools are independent: Starter active + Growth active is fine
    function test_DifferentPools_Independent() public {
        staking.setPoolActive(1, true); // Growth
        vm.startPrank(user);
        staking.stake(0, 100e18); // Starter
        staking.stake(1, 250e18); // Growth — different pool, allowed
        vm.stopPrank();
    }
}
