// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV5.sol";

contract MockERC20Q is IERC20 {
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

/// @title Tests the exact team mechanic:
/// - Unlock 11 levels: SUM of stakes >= $1,100 (accumulate $100 at a time) + 11 qualified directs ($100+ each)
contract SumQualificationTest is Test {
    VyronXStakingV5 staking;
    MockERC20Q usdt;
    MockERC20Q vyr;
    address owner = address(0x1111);
    address promoter = address(0x9001);

    function setUp() public {
        usdt = new MockERC20Q();
        vyr = new MockERC20Q();
        vyr.mint(address(this), 500_000_000e18);
        staking = new VyronXStakingV5(address(usdt), address(vyr), address(0xC011), owner);
        vyr.transfer(address(staking), 500_000_000e18);
        staking.setPoolActive(3, true); // Elite only
    }

    function _makeStaker(address who, address ref, uint256 amount) internal {
        usdt.mint(who, amount + 1e18);
        vm.startPrank(who);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(ref);
        staking.stake(3, amount);
        vm.stopPrank();
    }

    /// @notice Promoter accumulates $100 stakes (11x) → SUM $1,100 → qualifies L11
    function test_AccumulateTo1100_QualifiesL11() public {
        // 11 direct referrals each staking exactly $100 (qualified)
        for (uint8 i = 0; i < 11; i++) {
            _makeStaker(address(uint160(0xA000 + i)), promoter, 100e18);
        }
        // Promoter accumulates: $100 × 11 stakes = $1,100 total (never a single big stake)
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        for (uint8 i = 0; i < 11; i++) {
            staking.stake(3, 100e18); // 11 separate $100 stakes
        }
        vm.stopPrank();

        // Check qualification: SUM = $1,100, directs = 11 (each $100+)
        (uint256 totalStaked, uint256 qualifiedDirects) = staking.getAffiliateQualification(promoter);
        assertEq(totalStaked, 1100e18, "SUM must be $1,100");
        assertEq(qualifiedDirects, 11, "11 qualified directs ($100 each)");

    }

    /// @notice Direct with only $50 does NOT count as qualified
    function test_DirectBelow100_NotQualified() public {
        staking.setPoolActive(1, true); // Growth ($50 min)
        usdt.mint(address(0xA000), 100e18);
        vm.startPrank(address(0xA000));
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(promoter);
        staking.stake(1, 50e18); // $50 in Growth pool → total $50 < $100 → NOT qualified
        vm.stopPrank();
        (, uint256 qd) = staking.getAffiliateQualification(promoter);
        assertEq(qd, 0, "$50 direct must NOT count");
    }

    /// @notice Promoter with SUM $1,000 (10×$100) does NOT qualify L11 ($1,100 needed)
    function test_Sum1000_NotQualifiedForL11() public {
        // 11 qualified directs
        for (uint8 i = 0; i < 11; i++) {
            _makeStaker(address(uint160(0xA000 + i)), promoter, 100e18);
        }
        // But promoter himself only $1,000
        _makeStaker(promoter, owner, 1000e18);
        (uint256 ts, uint256 qd) = staking.getAffiliateQualification(promoter);
        assertEq(ts, 1000e18);
        assertEq(qd, 11);
        // AffiliateLevel L11 requires minStake 1100e18 → 1000 < 1100 fails
        (uint256 bps,, uint256 minDirects) = staking.affiliateLevels(10);
        (uint256 bps10, uint256 minStake10,) = staking.affiliateLevels(10);
        // L11 params: 700bps, $1,100, 11 directs
        assertEq(minStake10, 1100e18);
        assertEq(minDirects, 11);
        assertTrue(ts < minStake10, "must NOT qualify L11 with $1,000");
    }

    /// @notice Withdrawn stakes don't count toward SUM
    function test_WithdrawnStake_ExcludedFromSum() public {
        _makeStaker(promoter, owner, 1000e18);
        vm.warp(block.timestamp + 361 days);
        vm.prank(promoter);
        staking.withdraw(0);
        (uint256 ts,) = staking.getAffiliateQualification(promoter);
        assertEq(ts, 0, "withdrawn stake must NOT count");
    }

    /// @notice Multiple stakes accumulate: $100 + $200 + $800 = $1,100
    function test_MixedStakes_Accumulate() public {
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 100e18);
        staking.stake(3, 200e18);
        staking.stake(3, 800e18);
        vm.stopPrank();
        (uint256 ts,) = staking.getAffiliateQualification(promoter);
        assertEq(ts, 1100e18, "$100+$200+$800 = $1,100");
    }

    /// @notice DYNAMIC: stake EXPIRES → SUM drops → falls back to previous level automatically
    function test_StakeExpires_FallsBackToPreviousLevel() public {
        // 11 qualified directs ($100 each, Elite 360d)
        for (uint8 i = 0; i < 11; i++) {
            _makeStaker(address(uint160(0xA000 + i)), promoter, 100e18);
        }
        // Promoter: $1,000 in ELITE (360d, multi-stake allowed) + $100 more = $1,100 → L11 qualified
        usdt.mint(promoter, 2000e18);
        vm.startPrank(promoter);
        usdt.approve(address(staking), type(uint256).max);
        staking.setReferrer(owner);
        staking.stake(3, 500e18); // ELITE — unlimited simultaneous stakes
        staking.stake(3, 500e18);
        vm.warp(block.timestamp + 100 days); // stagger: this last stake expires 100d later
        staking.stake(3, 100e18);
        vm.stopPrank();

        (uint256 ts,) = staking.getAffiliateQualification(promoter);
        assertEq(ts, 1100e18, "L11 qualified: $1,100 active");

        // First two ELITE stakes expire (360d from t0); the $100 one was made at t0+100d
        vm.warp(block.timestamp + 261 days); // t0+100d+261d = t0+361d > 360d for first two; $100 stake ends at t0+460d
        (uint256 ts2,) = staking.getAffiliateQualification(promoter);
        assertEq(ts2, 100e18, "Expired stakes: only $100 remains active: back to L1");
    }

    /// @notice DYNAMIC: direct's stakes ALL expire → he stops counting as qualified → promoter drops
    function test_DirectStakesExpire_PromoterDrops() public {
        // 11 directs stake $100 Elite
        for (uint8 i = 0; i < 11; i++) {
            _makeStaker(address(uint160(0xA000 + i)), promoter, 100e18);
        }
        _makeStaker(promoter, owner, 1100e18);
        (, uint256 qd) = staking.getAffiliateQualification(promoter);
        assertEq(qd, 11, "11 qualified directs");

        // All directs' stakes expire after 360 days
        vm.warp(block.timestamp + 361 days);
        (, uint256 qd2) = staking.getAffiliateQualification(promoter);
        assertEq(qd2, 0, "all directs expired: 0 qualified: falls back");
    }
}