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

contract Level11DirectsTest is Test {
    VyronXStakingV5 staking;
    MockERC20 usdt;
    MockERC20 vyr;
    address owner = address(0x1111);
    address topPromoter = address(0x9001);

    function setUp() public {
        usdt = new MockERC20();
        vyr = new MockERC20();
        vyr.mint(address(this), 500_000_000e18);
        staking = new VyronXStakingV5(address(usdt), address(vyr), address(0xC011), owner);
        vyr.transfer(address(staking), 500_000_000e18);
        staking.setPoolActive(3, true); // Elite (test contract is owner=msg.sender)
    }

    function _makeStaker(address who, address ref, uint256 amount) internal {
        usdt.mint(who, amount + 1e18);
        vm.startPrank(who);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(ref);
        staking.stake(3, amount);
        vm.stopPrank();
    }

    /// @notice With 10 directs total → top promoter does NOT receive level-11 commission
    function test_Level11_With10Directs_NoPay() public {
        _buildNetwork(9); // 9 extras + 1 chain-head = 10 total directs
        vm.warp(block.timestamp + 3 days);
        address deepest = address(0x9100);
        vm.prank(deepest);
        staking.claimDailyEarnings(0);
        uint256 earned = staking.totalReferralEarnings(topPromoter);
        emit log_named_uint("earned with 10 directs", earned);
        assertEq(earned, 0, "10 directs: promoter must NOT receive level-11 commission");
    }

    /// @notice With 11 directs total → top promoter receives level-11 commission (7%)
    function test_Level11_With11Directs_Pays() public {
        _buildNetwork(10); // 10 extras + 1 chain-head = 11 total directs
        vm.warp(block.timestamp + 3 days);
        address deepest = address(0x9100);
        vm.prank(deepest);
        staking.claimDailyEarnings(0);
        uint256 earned = staking.totalReferralEarnings(topPromoter);
        emit log_named_uint("earned with 11 directs", earned);
        // $1000 * 0.5% * 3d = $15 yield; Lv11 = 7% → $1.05
        assertGt(earned, 0, "11 directs: promoter MUST receive level-11 commission");
        assertEq(earned, 1.05e18, "11 directs: Lv11 commission = 7% of $15 = $1.05");
    }

    /// @notice Owner can update a level via setter
    function test_SetAffiliateLevel() public {
        staking.setAffiliateLevel(10, 700, 1100e18, 11);
        (uint256 bps, uint256 minStake, uint256 minDirects) = staking.affiliateLevels(10);
        assertEq(bps, 700);
        assertEq(minStake, 1100e18);
        assertEq(minDirects, 11);
        // non-owner reverts
        vm.prank(address(0xBEEF));
        vm.expectRevert("Not owner");
        staking.setAffiliateLevel(0, 100, 100e18, 0);
    }

    /// @dev Build: topPromoter (stake $1100) + N directs ($100 each) + 10-chain to deepest ($1000)
    function _buildNetwork(uint8 nDirects) internal {
        _makeStaker(topPromoter, owner, 1100e18); // $1100 max stake → qualifies all stake reqs
        for (uint8 i = 0; i < nDirects; i++) {
            _makeStaker(address(uint160(0xA000 + i)), topPromoter, 100e18);
        }
        // Chain of 10 intermediates: promoter → m0 → m1 → ... → m9 → deepest
        address prev = topPromoter;
        for (uint8 i = 0; i < 10; i++) {
            address mid = address(uint160(0x9200 + i));
            _makeStaker(mid, prev, 100e18);
            prev = mid;
        }
        _makeStaker(address(0x9100), prev, 1000e18); // deepest = level 11 from promoter
    }
}
