// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXAuction.sol";
import "../src/MockUSDT.sol";
import "../src/mocks/MockLottery.sol";

/// @notice Mock Staking V4 oracle (only vyrPriceInUsdt is read)
contract MockOracle {
    uint256 public vyrPriceInUsdt = 1e18; // 1 VYR = 1 USDT
    function setPrice(uint256 p) external { vyrPriceInUsdt = p; }
}

contract VyronXAuctionTest is Test {
    VyronXAuction auction;
    MockUSDT usdt;
    MockVYR vyr;
    MockRouter router;
    MockOracle oracle;

    address owner = address(this);
    address payable[4] feeWallets;
    address payable buybackWallet;
    address payable mlmWallet;
    address payable treasuryWallet;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint256 constant PRIZE = 100e18; // meta $100 = 100 lances

    function setUp() public {
        usdt = new MockUSDT();
        vyr = new MockVYR();
        router = new MockRouter(address(usdt), address(vyr), 1000e18); // 1 USDT -> 1000 VYR
        oracle = new MockOracle();

        for (uint256 i = 0; i < 4; i++) {
            feeWallets[i] = payable(makeAddr(string(abi.encodePacked("wallet", vm.toString(i)))));
        }
        buybackWallet = payable(makeAddr("buyback"));
        mlmWallet = payable(makeAddr("mlm"));
        treasuryWallet = payable(makeAddr("treasury"));

        auction = new VyronXAuction(
            address(usdt), owner, address(vyr), address(router), address(oracle),
            feeWallets, mlmWallet, treasuryWallet, buybackWallet
        );

        // fund prize pool + give users USDT
        usdt.mint(address(this), 1_000_000e18);
        usdt.approve(address(auction), type(uint256).max);
        auction.fundPrizePool(10_000e18);

        address[3] memory users = [alice, bob, carol];
        for (uint256 i = 0; i < 3; i++) {
            usdt.mint(users[i], 100_000e18);
            vyr.mint(users[i], 1_000_000e18);
            vm.startPrank(users[i]);
            usdt.approve(address(auction), type(uint256).max);
            vyr.approve(address(auction), type(uint256).max);
            vm.stopPrank();
        }
    }

    //  helpers 
    function _open(uint256 prize, uint256 delay) internal returns (uint256 id) {
        vm.prank(owner);
        auction.openAuction(prize, block.timestamp, delay);
        return auction.nextAuctionId();
    }

    function _bid(address who, uint256 id) internal {
        vm.prank(who);
        auction.placeBid(id);
    }

    function _buy(address who, uint256 n) internal {
        vm.prank(who);
        auction.buyBidPackUSDT(n);
    }

    function _endTime(uint256 id) internal view returns (uint256) {
        (,,,,,, uint256 end,,,,) = auction.getAuction(id);
        return end;
    }

    function _bidCount(uint256 id) internal view returns (uint256) {
        (,, uint256 bc,,,,,,,,) = auction.getAuction(id);
        return bc;
    }

    // 
    // CONSTRUCTOR + DEFAULTS
    // 

    function test_Constructor_Defaults() public view {
        assertEq(auction.bidPrice(), 1e18, "bid price $1");
        assertEq(auction.priceIncrement(), 1e16, "increment $0.01");
        assertEq(auction.buybackShareBps(), 4000);
        assertEq(auction.prizePoolShareBps(), 2500);
        assertEq(auction.walletShareBps(), 2000);
        assertEq(auction.mlmShareBps(), 1500);
        assertEq(auction.weeklyWinLimit(), 3);
        assertEq(auction.vyBonusBps(), 1000, "10% VYR bonus");
        assertEq(auction.autoBuybackEnabled(), true);
        uint16[6] memory t = auction.getTimerSeconds();
        assertEq(t[0], 20); assertEq(t[1], 15); assertEq(t[2], 10);
        assertEq(t[3], 7);  assertEq(t[4], 5);  assertEq(t[5], 3);
        assertEq(auction.availablePrizeFunds(), 10_000e18);
    }

    function test_Constructor_RevertZeroAddresses() public {
        vm.expectRevert("USDT zero");
        new VyronXAuction(address(0), owner, address(vyr), address(router), address(oracle),
            feeWallets, mlmWallet, treasuryWallet, buybackWallet);
        vm.expectRevert("Owner zero");
        new VyronXAuction(address(usdt), address(0), address(vyr), address(router), address(oracle),
            feeWallets, mlmWallet, treasuryWallet, buybackWallet);
        vm.expectRevert("VYR zero");
        new VyronXAuction(address(usdt), owner, address(0), address(router), address(oracle),
            feeWallets, mlmWallet, treasuryWallet, buybackWallet);
        vm.expectRevert("Oracle zero");
        new VyronXAuction(address(usdt), owner, address(vyr), address(router), address(0),
            feeWallets, mlmWallet, treasuryWallet, buybackWallet);
    }

    // 
    // BID PACKS  USDT
    // 

    function test_BuyBidPack_USDT() public {
        uint256 balBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        auction.buyBidPackUSDT(25);
        assertEq(auction.bidBalance(alice), 25);
        assertEq(balBefore - usdt.balanceOf(alice), 25e18, "paid $25");
    }

    function test_BuyBidPack_USDT_RevertZero() public {
        vm.prank(alice);
        vm.expectRevert("Min 1 bid");
        auction.buyBidPackUSDT(0);
    }

    // 
    // BID PACKS  VYR (unilevel balance path)
    // 

    function test_BuyBidPack_VYR_BonusAndBurn() public {
        // oracle 1:1 → 10 VYR = $10 = 10 bids + 10% bonus = 11 bids
        // burnShareBps default 10000 → ALL VYR burned
        uint256 supplyBefore = vyr.totalSupply();
        uint256 treasuryBefore = vyr.balanceOf(treasuryWallet);
        vm.prank(alice);
        auction.buyBidPackWithVYR(10e18);
        assertEq(auction.bidBalance(alice), 11, "10 + 10% bonus");
        assertEq(supplyBefore - vyr.totalSupply(), 10e18, "100% burned (default)");
        assertEq(vyr.balanceOf(treasuryWallet) - treasuryBefore, 0, "nothing to treasury");
        assertEq(auction.totalVyrBurned(), 10e18);
        assertEq(vyr.balanceOf(alice), 1_000_000e18 - 10e18);
    }

    function test_BuyBidPack_VYR_BurnShare50() public {
        // owner sets 50% burn → half burned, half treasury
        vm.prank(owner);
        auction.setBurnShareBps(5000);
        uint256 supplyBefore = vyr.totalSupply();
        uint256 treasuryBefore = vyr.balanceOf(treasuryWallet);
        vm.prank(alice);
        auction.buyBidPackWithVYR(10e18);
        assertEq(supplyBefore - vyr.totalSupply(), 5e18, "half burned");
        assertEq(vyr.balanceOf(treasuryWallet) - treasuryBefore, 5e18, "half treasury");
    }

    function test_BurnShare_Bounds() public {
        vm.prank(owner);
        vm.expectRevert("Max 10000");
        auction.setBurnShareBps(10001);
        vm.prank(alice);
        vm.expectRevert("Not owner");
        auction.setBurnShareBps(5000);
    }

    // ════════════════════════════════════════════════════
    // SCHEDULED START (data e horário)
    // ════════════════════════════════════════════════════

    function test_ScheduledStart_BidBeforeStart_Reverts() public {
        vm.prank(owner);
        auction.openAuction(PRIZE, block.timestamp + 1 days, 3600); // starts tomorrow
        uint256 id = auction.nextAuctionId();
        _buy(alice, 5);
        vm.prank(alice);
        vm.expectRevert("Not started yet");
        auction.placeBid(id);
    }

    function test_ScheduledStart_BidAfterStart_Works() public {
        vm.prank(owner);
        auction.openAuction(PRIZE, block.timestamp + 1 days, 3600);
        uint256 id = auction.nextAuctionId();
        _buy(alice, 5);
        vm.warp(block.timestamp + 1 days); // reached start
        vm.prank(alice);
        auction.placeBid(id);
        (,, uint256 bc,,,,,,,,) = auction.getAuction(id);
        assertEq(bc, 1);
    }

    function test_ScheduledStart_FinalizeBeforeStart_Reverts() public {
        vm.prank(owner);
        auction.openAuction(PRIZE, block.timestamp + 1 days, 3600);
        uint256 id = auction.nextAuctionId();
        vm.warp(block.timestamp + 2 hours);
        vm.expectRevert("Not started yet");
        auction.finalize(id);
    }

    function test_ScheduledStart_StartInPast_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Start in the past");
        auction.openAuction(PRIZE, block.timestamp - 1, 3600);
    }

    function test_ScheduledStart_TooFarAhead_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Start max 30d ahead");
        auction.openAuction(PRIZE, block.timestamp + 31 days, 3600);
    }

    function test_BuyBidPack_VYR_DifferentPrice() public {
        oracle.setPrice(2e18); // 1 VYR = 2 USDT -> 10 VYR = $20 = 22 bids
        vm.prank(alice);
        auction.buyBidPackWithVYR(10e18);
        assertEq(auction.bidBalance(alice), 22);
    }

    function test_BuyBidPack_VYR_Dust_Reverts() public {
        oracle.setPrice(1e6); // 1 VYR = $0.000001 -> 1000 wei VYR = dust
        vm.prank(alice);
        vm.expectRevert("Dust VYR");
        auction.buyBidPackWithVYR(1000);
    }

    // 
    // AUCTION LIFECYCLE
    // 

    function test_OpenAuction_LocksPrize() public {
        uint256 availBefore = auction.availablePrizeFunds();
        uint256 lockedBefore = auction.lockedPrizeFunds();
        uint256 id = _open(PRIZE, 3600);
        assertEq(auction.lockedPrizeFunds() - lockedBefore, PRIZE);
        assertEq(availBefore - auction.availablePrizeFunds(), PRIZE);
        (uint256 prize, uint256 price, uint256 bc,, address win,,, uint256 fin, uint256 paid, bool claimed,) = auction.getAuction(id);
        assertEq(prize, PRIZE);
        assertEq(price, 1e16, "starts $0.01");
        assertEq(bc, 0);
        assertEq(win, address(0));
        assertEq(fin, 0); assertEq(paid, 0); assertFalse(claimed);
    }

    function test_OpenAuction_Unfunded_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Fund prize pool first");
        auction.openAuction(999_999_999e18, block.timestamp, 3600);
    }

    function test_CancelAuction_PrizeReturns() public {
        uint256 id = _open(PRIZE, 3600);
        vm.prank(owner);
        auction.cancelAuction(id);
        (, , , , , , , , , , VyronXAuction.Status st) = auction.getAuction(id);
        assertEq(uint(st), uint(VyronXAuction.Status.Cancelled));
        assertEq(auction.lockedPrizeFunds(), 0);
        assertEq(auction.availablePrizeFunds(), 10_000e18, "full refund to pool");
        assertEq(auction.getActiveAuctionIds().length, 0);
    }

    function test_CancelAuction_WithBids_Reverts() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 1);
        _bid(alice, id);
        vm.prank(owner);
        vm.expectRevert("Has bids");
        auction.cancelAuction(id);
    }

    function test_Finalize_NoBids_PrizeReturns() public {
        uint256 id = _open(PRIZE, 3600);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);
        (, , , , address win, , , , , , ) = auction.getAuction(id);
        assertEq(win, address(0), "no winner");
        assertEq(auction.lockedPrizeFunds(), 0);
        assertEq(auction.availablePrizeFunds(), 10_000e18);
    }

    function test_SingleBid_Wins() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 5);
        _bid(alice, id);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);
        (, , , , address win, , , , , , ) = auction.getAuction(id);
        assertEq(win, alice);
        assertEq(auction.getWinsThisWeek(alice), 1);
        assertEq(auction.totalBidsPlaced(), 1);
    }

    function test_ClaimPrize_PaysAndReceives() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 5);
        _bid(alice, id);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);

        uint256 aliceBefore = usdt.balanceOf(alice);
        vm.prank(alice);
        auction.claimPrize(id);
        // paid final price $0.02 (start $0.01 + 1 bid increment), received prize $100
        assertEq(usdt.balanceOf(alice) - aliceBefore, PRIZE - 2e16);
        (, , , , , , , , uint256 paid, bool claimed, ) = auction.getAuction(id);
        assertEq(paid, 2e16);
        assertTrue(claimed);
        assertEq(auction.lockedPrizeFunds(), 0, "prize unlocked");
    }

    function test_ClaimPrize_NotWinner_Reverts() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 5);
        _bid(alice, id);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);
        vm.prank(bob);
        vm.expectRevert("Not winner");
        auction.claimPrize(id);
    }

    function test_ClaimPrize_Double_Reverts() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 5);
        _bid(alice, id);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);
        vm.prank(alice);
        auction.claimPrize(id);
        vm.prank(alice);
        vm.expectRevert("Already claimed");
        auction.claimPrize(id);
    }

    function test_ExpireUnclaimed_PrizeReturnsToPool() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 5);
        _bid(alice, id);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);
        // winner never claims
        vm.warp(block.timestamp + 7 days + 1);
        auction.expireUnclaimed(id);
        assertEq(auction.lockedPrizeFunds(), 0);
        // pool = 10_000 initial + 25% of $1 bid revenue + expired prize back - ... = 10_000 + 0.25 + 100 - 100
        assertEq(auction.availablePrizeFunds(), 10_000e18 + 25e16, "pool restored + 25% bid revenue");
    }

    // 
    // DYNAMIC TIMER  20/15/10/7/5/3
    // 

    function test_Timer_Tier20_Under20Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        _bid(alice, id); // 1 lance = 1% da meta
        assertEq(_endTime(id) - block.timestamp, 20, "1% -> 20s");
        assertEq(auction.currentTimerWindow(id), 20);
    }

    function test_Timer_Tier15_At20Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 20; i++) _bid(alice, id); // 20 lances = 20%
        assertEq(auction.currentTimerWindow(id), 15, "20% -> 15s");
        assertEq(_endTime(id) - block.timestamp, 15);
    }

    function test_Timer_Tier10_At40Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 40; i++) _bid(alice, id);
        assertEq(auction.currentTimerWindow(id), 10, "40% -> 10s");
    }

    function test_Timer_Tier7_At60Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 60; i++) _bid(alice, id);
        assertEq(auction.currentTimerWindow(id), 7, "60% -> 7s");
    }

    function test_Timer_Tier5_At80Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 80; i++) _bid(alice, id);
        assertEq(auction.currentTimerWindow(id), 5, "80% -> 5s");
    }

    function test_Timer_Tier3_At100Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 110);
        for (uint256 i = 0; i < 100; i++) _bid(alice, id);
        assertEq(auction.currentTimerWindow(id), 3, "100% -> 3s");
        // beyond 100% stays at 3s
        _bid(alice, id);
        assertEq(auction.currentTimerWindow(id), 3, ">100% -> 3s");
    }

    function test_Timer_Boundary_Exactly19Percent() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 19; i++) _bid(alice, id); // 19% ainda  tier 20s
        assertEq(auction.currentTimerWindow(id), 20);
    }

    function test_Timer_PriceIncrement() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 3);
        _bid(alice, id);
        _bid(alice, id);
        _bid(alice, id);
        (, uint256 price,,,,,,,,,) = auction.getAuction(id);
        assertEq(price, 4e16, "$0.01 start + 3x$0.01 = $0.04");
    }

    function test_PlaceBid_AfterExpiry_Reverts() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 5);
        vm.warp(_endTime(id) + 1);
        vm.prank(alice);
        vm.expectRevert("Expired");
        auction.placeBid(id);
    }

    function test_PlaceBid_NoCredits_Reverts() public {
        uint256 id = _open(PRIZE, 3600);
        vm.prank(alice);
        vm.expectRevert("No bid credits");
        auction.placeBid(id);
    }

    // 
    // REVENUE SPLIT  40/25/20/15
    // 

    function test_Finalize_SplitExact_WithFallback() public {
        vm.prank(owner);
        auction.setAutoBuyback(false); // buyback -> fallback wallet
        uint256 id = _open(PRIZE, 3600);

        _buy(alice, 100);
        for (uint256 i = 0; i < 100; i++) _bid(alice, id);
        vm.warp(_endTime(id) + 1);

        uint256 buybackBefore = usdt.balanceOf(buybackWallet);
        uint256 mlmBefore = usdt.balanceOf(mlmWallet);
        uint256[4] memory wBefore;
        for (uint256 i = 0; i < 4; i++) wBefore[i] = usdt.balanceOf(feeWallets[i]);
        uint256 poolBefore = auction.availablePrizeFunds();
        uint256 lockedBefore = auction.lockedPrizeFunds();

        auction.finalize(id);

        uint256 revenue = 100e18;
        assertEq(usdt.balanceOf(buybackWallet) - buybackBefore, revenue * 4000 / 10000, "40% fallback");
        assertEq(usdt.balanceOf(mlmWallet) - mlmBefore, revenue * 1500 / 10000, "15% MLM");
        for (uint256 i = 0; i < 4; i++) {
            assertEq(usdt.balanceOf(feeWallets[i]) - wBefore[i], revenue * 500 / 10000, "5% each wallet");
        }
        assertEq(auction.availablePrizeFunds() - poolBefore, revenue * 2500 / 10000, "25% pool");
        assertEq(auction.lockedPrizeFunds(), lockedBefore, "prize still locked until claim");
        assertEq(auction.totalUsdtRevenue(), revenue);
    }

    function test_Finalize_BuybackSwapAndBurn() public {
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 100; i++) _bid(alice, id);
        vm.warp(_endTime(id) + 1);

        uint256 supplyBefore = vyr.totalSupply();
        uint256 treasuryBefore = vyr.balanceOf(treasuryWallet);

        auction.finalize(id);

        // 40 USDT × rate 1000 = 40000 VYR out; burnShareBps=10000 → ALL burned
        assertEq(auction.totalBuybackUsdt(), 40e18, "40% swapped");
        assertEq(auction.totalVyrBurned(), 40_000e18, "100% of 40k burned");
        assertEq(vyr.balanceOf(treasuryWallet) - treasuryBefore, 0, "nothing to treasury");
        // burned reduces supply: minted 40k, burned 40k → net supply unchanged
        assertEq(vyr.totalSupply() - supplyBefore, 0);
        assertEq(vyr.balanceOf(address(auction)), 0, "no VYR stuck");
    }

    function test_Finalize_Buyback_BurnShare25() public {
        vm.prank(owner);
        auction.setBurnShareBps(2500); // 25% burned / 75% treasury
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 100);
        for (uint256 i = 0; i < 100; i++) _bid(alice, id);
        vm.warp(_endTime(id) + 1);

        uint256 treasuryBefore = vyr.balanceOf(treasuryWallet);
        auction.finalize(id);

        // 40k VYR out → 10k burned / 30k treasury
        assertEq(auction.totalVyrBurned(), 10_000e18, "25% burned");
        assertEq(vyr.balanceOf(treasuryWallet) - treasuryBefore, 30_000e18, "75% treasury");
        assertEq(vyr.balanceOf(address(auction)), 0, "no VYR stuck");
    }

    function test_Finalize_BuybackSwapFails_Fallback() public {
        router.setFailMode(true); // router reverts the swap -> try/catch -> fallback
        uint256 id = _open(PRIZE, 3600);
        _buy(alice, 10);
        for (uint256 i = 0; i < 10; i++) _bid(alice, id);
        vm.warp(_endTime(id) + 1);

        uint256 buybackBefore = usdt.balanceOf(buybackWallet);
        auction.finalize(id);
        assertEq(usdt.balanceOf(buybackWallet) - buybackBefore, 4e18, "10 bids x40% = $4 fallback");
    }

    // 
    // WEEKLY WIN LIMIT
    // 

    function test_WeeklyWinLimit_BlocksFourthWin() public {
        _buy(alice, 500);
        for (uint256 w = 0; w < 3; w++) {
            uint256 id = _open(PRIZE, 3600);
            _bid(alice, id);
            vm.warp(_endTime(id) + 1);
            auction.finalize(id);
            vm.prank(alice);
            auction.claimPrize(id);
        }
        assertEq(auction.getWinsThisWeek(alice), 3);

        uint256 id4 = _open(PRIZE, 3600);
        vm.prank(alice);
        vm.expectRevert("Weekly win limit");
        auction.placeBid(id4);
    }

    function test_WeeklyWinLimit_NextWeekResets() public {
        _buy(alice, 500);
        for (uint256 w = 0; w < 3; w++) {
            uint256 id = _open(PRIZE, 3600);
            _bid(alice, id);
            vm.warp(_endTime(id) + 1);
            auction.finalize(id);
            vm.prank(alice);
            auction.claimPrize(id);
        }
        vm.warp(block.timestamp + 8 days);
        assertEq(auction.getWinsThisWeek(alice), 0, "new week");
        uint256 id4 = _open(PRIZE, 3600);
        _bid(alice, id4); // ok
        assertEq(auction.getWinsThisWeek(alice), 0, "not finalized yet");
    }

    function test_WeeklyWinLimit_Zero_Unlimited() public {
        vm.prank(owner);
        auction.setWeeklyWinLimit(0);
        _buy(alice, 500);
        for (uint256 w = 0; w < 5; w++) {
            uint256 id = _open(PRIZE, 3600);
            _bid(alice, id);
            vm.warp(_endTime(id) + 1);
            auction.finalize(id);
            vm.prank(alice);
            auction.claimPrize(id);
        }
        assertEq(auction.getWinsThisWeek(alice), 5);
    }

    // 
    // PAUSE + ADMIN CONFIG
    // 

    function test_Pause_BlocksBidsAndPacks() public {
        vm.prank(owner);
        auction.setPaused(true);
        vm.prank(alice);
        vm.expectRevert("Paused");
        auction.buyBidPackUSDT(1);
        vm.prank(alice);
        vm.expectRevert("Paused");
        auction.buyBidPackWithVYR(1e18);
    }

    function test_SetBidPrice_Bounds() public {
        vm.prank(owner);
        vm.expectRevert("Bid $0.01-$100");
        auction.setBidPrice(1e15);
        vm.prank(owner);
        auction.setBidPrice(2e18);
        assertEq(auction.bidPrice(), 2e18);
    }

    function test_SetDistribution_MustSum10000() public {
        vm.prank(owner);
        vm.expectRevert("Must sum 10000");
        auction.setDistribution(4000, 2500, 2000, 1000);
        vm.prank(owner);
        auction.setDistribution(5000, 2500, 1500, 1000);
        assertEq(auction.buybackShareBps(), 5000);
    }

    function test_SetTimerSeconds_Bounds() public {
        uint16[6] memory bad = [uint16(0), 15, 10, 7, 5, 3];
        vm.prank(owner);
        vm.expectRevert("1s-3600s");
        auction.setTimerSeconds(bad);
        uint16[6] memory good = [uint16(30), 20, 15, 10, 5, 2];
        vm.prank(owner);
        auction.setTimerSeconds(good);
        uint16[6] memory t = auction.getTimerSeconds();
        assertEq(t[0], 30); assertEq(t[5], 2);
    }

    function test_OnlyOwner_Guards() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        auction.openAuction(PRIZE, block.timestamp, 3600);
        vm.prank(alice);
        vm.expectRevert("Not owner");
        auction.setBidPrice(2e18);
        vm.prank(alice);
        vm.expectRevert("Not owner");
        auction.setPaused(true);
    }

    function test_TransferOwnership() public {
        vm.prank(owner);
        auction.transferOwnership(alice);
        assertEq(auction.owner(), alice);
        vm.prank(alice);
        auction.setPaused(true); // alice can now admin
        assertTrue(auction.paused());
    }

    // 
    // E2E  multi-user war + full settlement
    // 

    function test_E2E_BiddingWar_Settlement() public {
        vm.prank(owner);
        auction.setAutoBuyback(false);
        uint256 id = _open(1000e18, 3600); // meta $1000

        _buy(alice, 300); _buy(bob, 300); _buy(carol, 300);
        // war: 250 bids total alternating — bob bids LAST
        for (uint256 i = 0; i < 100; i++) {
            _bid(alice, id);
            _bid(bob, id);
            if (i < 25) _bid(carol, id);
        }
        // 100 + 100 + 25 = 225 bids = $225 = 22.5% of $1000 goal -> tier 15s
        assertEq(_bidCount(id), 225);
        assertEq(auction.currentTimerWindow(id), 15);
        (, uint256 price, , address last, , , , , , , ) = auction.getAuction(id);
        assertEq(price, 226e16, "$0.01 + 225x$0.01 = $2.26");
        assertEq(last, bob);

        uint256 buybackBefore = usdt.balanceOf(buybackWallet);
        uint256 mlmBefore = usdt.balanceOf(mlmWallet);
        vm.warp(_endTime(id) + 1);
        auction.finalize(id);

        assertEq(usdt.balanceOf(buybackWallet) - buybackBefore, 90e18, "40% of $225");
        assertEq(usdt.balanceOf(mlmWallet) - mlmBefore, 33.75e18, "15% of $225");

        uint256 bobBefore = usdt.balanceOf(bob);
        vm.prank(bob);
        auction.claimPrize(id);
        // bob: +$1000 prize - $2.26 final price
        assertEq(usdt.balanceOf(bob) - bobBefore, 1000e18 - 226e16);
        assertEq(auction.lockedPrizeFunds(), 0);
    }

    function test_E2E_MultipleParallelAuctions() public {
        uint256 id1 = _open(50e18, 3600);  // meta $50
        uint256 id2 = _open(200e18, 3600); // meta $200
        _buy(alice, 60); _buy(bob, 60);

        // alice takes id1 to 100% of goal (50 bids -> tier 3s -> end1 comes fast)
        for (uint256 i = 0; i < 50; i++) _bid(alice, id1);
        assertEq(auction.currentTimerWindow(id1), 3, "100% of goal -> 3s");
        // bob's single bid on id2 gets a full 20s window -> end2 far away
        _bid(bob, id2);
        assertEq(auction.currentTimerWindow(id2), 20);

        vm.warp(_endTime(id1) + 1);
        auction.finalize(id1);
        (, , , , address w1, , , , , , ) = auction.getAuction(id1);
        assertEq(w1, alice);

        // PROOF id2 is still alive: bob can place another bid after id1 finalized
        _bid(bob, id2);
        assertTrue(_endTime(id2) > block.timestamp, "id2 alive and timer reset");
        vm.prank(alice);
        auction.claimPrize(id1);
    }

    function test_Revert_InvalidAuction() public {
        vm.expectRevert("Not active");
        auction.finalize(999);
        vm.prank(alice);
        vm.expectRevert("Not active");
        auction.placeBid(999);
    }

    // ════════════════════════════════════════════════════
    // METADATA (image + title)
    // ════════════════════════════════════════════════════

    function test_Meta_SetAndRead() public {
        uint256 id = _open(PRIZE, 3600);
        vm.prank(owner);
        auction.setAuctionMeta(id, "iPhone 17 Pro", "https://vyronx.io/img/prizes/iphone.png");
        (string memory title, string memory image) = auction.getAuctionMeta(id);
        assertEq(title, "iPhone 17 Pro");
        assertEq(image, "https://vyronx.io/img/prizes/iphone.png");
    }

    function test_Meta_EditableAfterSet() public {
        uint256 id = _open(PRIZE, 3600);
        vm.startPrank(owner);
        auction.setAuctionMeta(id, "Old", "https://old.png");
        auction.setAuctionMeta(id, "New Title", "https://new.png");
        vm.stopPrank();
        (string memory title, string memory image) = auction.getAuctionMeta(id);
        assertEq(title, "New Title");
        assertEq(image, "https://new.png");
    }

    function test_Meta_InvalidId_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Invalid id");
        auction.setAuctionMeta(999, "X", "https://x.png");
    }

    function test_Meta_UrlTooLong_Reverts() public {
        uint256 id = _open(PRIZE, 3600);
        string memory longUrl = new string(300);
        vm.prank(owner);
        vm.expectRevert("URL too long");
        auction.setAuctionMeta(id, "X", longUrl);
    }

    function test_Meta_OnlyOwner() public {
        uint256 id = _open(PRIZE, 3600);
        vm.prank(alice);
        vm.expectRevert("Not owner");
        auction.setAuctionMeta(id, "Hack", "https://evil.png");
    }
}
