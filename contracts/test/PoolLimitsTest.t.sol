// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV5.sol";

contract MockERC20L is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
}

contract PoolLimitsTest is Test {
    VyronXStakingV5 staking;
    MockERC20L usdt;
    MockERC20L vyr;
    address user = address(0x9999);
    address owner = address(0x1111);

    function setUp() public {
        usdt = new MockERC20L();
        vyr = new MockERC20L();
        vyr.mint(address(this), 500_000_000e18);
        staking = new VyronXStakingV5(address(usdt), address(vyr), address(0xC011), owner);
        vyr.transfer(address(staking), 500_000_000e18);
        staking.setPoolActive(0, true); // Starter
        staking.setPoolActive(1, true); // Growth
        staking.setPoolActive(2, true); // Pro
        staking.setPoolActive(3, true); // Elite
        usdt.mint(user, 1_000_000e18);
        vm.startPrank(user);
        usdt.approve(address(staking), type(uint256).max);
        vm.stopPrank();
    }

    function _stake(uint256 poolId, uint256 amount) internal {
        vm.prank(user);
        staking.stake(poolId, amount);
    }

    // ── STARTER: $50 min, $100 max ──
    function test_Starter_Min50_OK() public { _stake(0, 50e18); }
    function test_Starter_Below50_Revert() public {
        vm.expectRevert("Below pool minimum");
        _stake(0, 49.99e18);
    }
    function test_Starter_Max100_OK() public { _stake(0, 100e18); }
    function test_Starter_Above100_Revert() public {
        vm.expectRevert("Above pool maximum");
        _stake(0, 100.01e18);
    }

    // ── GROWTH: $50 min, $250 max ──
    function test_Growth_Min50_OK() public { _stake(1, 50e18); }
    function test_Growth_Below50_Revert() public {
        vm.expectRevert("Below pool minimum");
        _stake(1, 49.99e18);
    }
    function test_Growth_Max250_OK() public { _stake(1, 250e18); }
    function test_Growth_Above250_Revert() public {
        vm.expectRevert("Above pool maximum");
        _stake(1, 250.01e18);
    }

    // ── PRO: $50 min, $500 max ──
    function test_Pro_Min50_OK() public { _stake(2, 50e18); }
    function test_Pro_Below50_Revert() public {
        vm.expectRevert("Below pool minimum");
        _stake(2, 49.99e18);
    }
    function test_Pro_Max500_OK() public { _stake(2, 500e18); }
    function test_Pro_Above500_Revert() public {
        vm.expectRevert("Above pool maximum");
        _stake(2, 500.01e18);
    }

    // ── ELITE: $100 min, NO MAX ──
    function test_Elite_Min100_OK() public { _stake(3, 100e18); }
    function test_Elite_Below100_Revert() public {
        vm.expectRevert("Below pool minimum");
        _stake(3, 99.99e18);
    }
    function test_Elite_NoMax_HugeStake() public { _stake(3, 1_000_000e18); }

    // ── Setter: owner can change limits ──
    function test_SetPoolLimits() public {
        staking.setPoolLimits(0, 10e18, 200e18);
        _stake(0, 10e18); // new min works
        vm.expectRevert("Above pool maximum");
        _stake(0, 201e18);
    }

    function test_SetPoolLimits_Unlimited() public {
        staking.setPoolLimits(0, 10e18, 0); // max=0 → unlimited
        _stake(0, 999_999e18);
    }

    function test_SetPoolLimits_NotOwner() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("Not owner");
        staking.setPoolLimits(0, 10e18, 200e18);
    }
}
