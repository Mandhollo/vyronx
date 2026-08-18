// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/PresaleReferralV2.sol";

contract MockERC20 {
    string public name = "Mock";
    string public symbol = "MCK";
    uint256 public totalSupply;
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

/// @dev Minimal presale mock: buys tokens at fixed rate 100 VYR per USDT, sends to caller
contract MockPresale {
    MockERC20 public usdt;
    MockERC20 public vyr;
    uint256 public rate = 100; // VYR per USDT

    constructor(address _usdt, address _vyr) {
        usdt = MockERC20(_usdt);
        vyr = MockERC20(_vyr);
    }

    function buyWithUsdt(uint256 usdtAmount) external {
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "usdt pull");
        require(vyr.transfer(msg.sender, usdtAmount * rate), "vyr send");
    }
}

contract PresaleReferralV2Test is Test {
    PresaleReferralV2 wrapper;
    MockERC20 usdt;
    MockERC20 vyr;
    MockPresale presale;
    address owner = address(0x1111);
    address referrerW = address(0x2222);
    address buyer = address(0x3333);

    function setUp() public {
        usdt = new MockERC20();
        vyr = new MockERC20();
        presale = new MockPresale(address(usdt), address(vyr));
        vm.prank(owner);
        wrapper = new PresaleReferralV2(address(usdt), address(vyr), address(presale));

        // liquidity
        usdt.mint(buyer, 1000e18);
        vyr.mint(address(presale), 1_000_000e18);
        // owner funds USDT reserve: 100 USDT
        usdt.mint(owner, 100e18);
        vm.startPrank(owner);
        usdt.approve(address(wrapper), type(uint256).max);
        wrapper.fundReserve(100e18);
        vm.stopPrank();

        vm.startPrank(buyer);
        usdt.approve(address(wrapper), type(uint256).max);
        vm.stopPrank();
    }

    /// Happy path: buyer buys 100 USDT, referrer gets 10 USDT (not tokens)
    function test_BuyPaysReferrerInUsdt() public {
        vm.prank(buyer);
        wrapper.setReferrer(referrerW);

        uint256 buyerVyrBefore = vyr.balanceOf(buyer);
        uint256 refUsdtBefore = usdt.balanceOf(referrerW);

        vm.prank(buyer);
        wrapper.buyWithReferral(100e18);

        // Buyer: 100% tokens (10000 VYR @ rate 100), zero USDT back
        assertEq(vyr.balanceOf(buyer) - buyerVyrBefore, 10000e18, "buyer tokens");
        assertEq(usdt.balanceOf(buyer), 900e18, "buyer spent 100, kept 900");

        // Referrer: +10 USDT, zero VYR
        assertEq(usdt.balanceOf(referrerW) - refUsdtBefore, 10e18, "referrer USDT bonus");
        assertEq(vyr.balanceOf(referrerW), 0, "referrer got no tokens");

        // Earnings tracked in USDT
        (, uint256 earnings) = wrapper.getReferralInfo(referrerW);
        assertEq(earnings, 10e18, "earnings USDT");

        // Reserve drained by bonus
        assertEq(wrapper.reserveBalance(), 90e18, "reserve after");
    }

    /// Referrer set once, cannot change
    function test_ReferrerImmutable() public {
        vm.startPrank(buyer);
        wrapper.setReferrer(referrerW);
        vm.expectRevert("Referrer already set");
        wrapper.setReferrer(address(0x4444));
        vm.stopPrank();
    }

    /// No referrer -> revert
    function test_RevertNoReferrer() public {
        vm.prank(buyer);
        vm.expectRevert("No referrer set");
        wrapper.buyWithReferral(100e18);
    }

    /// Self-referral blocked
    function test_RevertSelfReferral() public {
        vm.prank(buyer);
        vm.expectRevert("Cannot refer self");
        wrapper.setReferrer(buyer);
    }

    /// Reserve empty -> purchase reverts BEFORE presale buy (bonus check ordering)
    /// Owner withdraws everything first
    function test_RevertInsufficientReserve() public {
        vm.prank(owner);
        wrapper.withdrawUSDT(owner, 100e18);

        vm.prank(buyer);
        wrapper.setReferrer(referrerW);

        vm.prank(buyer);
        vm.expectRevert("Insufficient USDT reserve");
        wrapper.buyWithReferral(100e18);
    }

    /// Owner can withdraw leftover reserve
    function test_OwnerWithdrawUsdt() public {
        vm.prank(owner);
        wrapper.withdrawUSDT(owner, 50e18);
        assertEq(usdt.balanceOf(owner), 50e18);
        assertEq(wrapper.reserveBalance(), 50e18);
    }

    /// Multiple purchases accumulate earnings
    function test_MultipleBuysAccumulate() public {
        usdt.mint(owner, 1000e18);
        vm.startPrank(owner);
        wrapper.fundReserve(1000e18); // big reserve
        vm.stopPrank();

        vm.prank(buyer);
        wrapper.setReferrer(referrerW);

        vm.startPrank(buyer);
        wrapper.buyWithReferral(100e18);
        wrapper.buyWithReferral(50e18);
        vm.stopPrank();

        (, uint256 earnings) = wrapper.getReferralInfo(referrerW);
        assertEq(earnings, 15e18, "10 + 5 USDT");
        assertEq(usdt.balanceOf(referrerW), 15e18);
    }

    /// Events emitted correctly
    function test_Events() public {
        vm.prank(buyer);
        wrapper.setReferrer(referrerW);

        vm.prank(buyer);
        vm.expectEmit(true, true, true, true);
        emit PresaleReferralV2.ReferralBonusPaid(buyer, referrerW, 10e18);
        wrapper.buyWithReferral(100e18);
    }
}
