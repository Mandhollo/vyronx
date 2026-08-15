// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV4.sol";


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
    VyronXStakingV4 staking;
    MockERC20 usdt;
    MockERC20 vyr;
    address owner = address(0x1111);

    // Uplines chain: top promoter with N directs, then 10 levels of single downlines
    // deepest member claims → top promoter should (or not) receive level-11 commission
    address topPromoter = address(0x9001);

    function setUp() public {
        usdt = new MockERC20();
        vyr = new MockERC20();
        vyr.mint(address(this), 500_000_000e18);
        staking = new VyronXStakingV4(address(usdt), address(vyr), address(0xC011), owner);
        vyr.transfer(address(staking), 500_000_000e18);
        staking.setPoolActive(3, true); // Elite (test contract is owner)
        staking.setVyrPrice(1e18);
    }

    function _makeStaker(address who, address ref, uint256 amount) internal {
        usdt.mint(who, amount + 1e18);
        vm.startPrank(who);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(ref);
        staking.stake(3, amount);
        vm.stopPrank();
    }

    /// @notice With 49 directs → top promoter does NOT receive level-11 commission
    function test_Level11_With49Directs_NoPay() public {
        _buildNetwork(48); // 48 extras + 1 chain-head = 49 total directs
        uint256 before = staking.totalReferralEarnings(topPromoter);
        // NOTE: promoter receives from levels 1-8 maybe (they qualify as directs grow),
        // but level 11 requires 50 directs. We test the deep claim adds nothing at Lv11.
        // Build: promoter + 49 directs (each direct is level-1 pay, not level 11)
        // The 11-deep chain member claims:
        vm.warp(block.timestamp + 3 days);
        address deepest = address(0x9100);
        vm.prank(deepest);
        staking.claimDailyEarnings(0);
        uint256 after_ = staking.totalReferralEarnings(topPromoter);
        emit log_named_uint("earned with 49 directs", after_ - before);
        // 7% of 5 yield = .05 → this is level-11 (7%) NOT level-10 (2%)
        // So with 49 directs the contract SHOULD have paid 0. It paid 1.05 = 7% → BUG CONFIRMED or level counting off
        assertEq(after_ - before, 0, "49 directs: promoter must NOT receive level-11 commission");
    }

    /// @notice With 50 directs → top promoter receives level-11 commission (7%)
    function test_Level11_With50Directs_Pays() public {
        _buildNetwork(49); // 49 extras + 1 chain-head = 50 total directs
        vm.warp(block.timestamp + 3 days);
        address deepest = address(0x9100);
        vm.prank(deepest);
        staking.claimDailyEarnings(0);
        uint256 earned = staking.totalReferralEarnings(topPromoter);
        assertGt(earned, 0, "50 directs: promoter MUST receive level-11 commission");
    }

    /// @dev Build: topPromoter (stake $1100) + N directs ($100 each) + 10-chain to deepest ($1000)
    function _buildNetwork(uint8 nDirects) internal {
        _makeStaker(topPromoter, owner, 1100e18); // max stake $1100 → qualifies all levels' stake req
        // N directs under promoter (level-1 members)
        for (uint8 i = 0; i < nDirects; i++) {
            _makeStaker(address(uint160(0xA000) + i), topPromoter, 100e18);
        }
        // Chain of 10 intermediates between promoter and deepest (so deepest is level 11)
        address prev = topPromoter;
        for (uint8 i = 0; i < 10; i++) {
            address mid = address(uint160(0x9200 + i));
            _makeStaker(mid, prev, 100e18);
            prev = mid;
        }
        // Deepest: level 11 below promoter, $1000 stake
        _makeStaker(address(0x9100), prev, 1000e18);
    }
}
