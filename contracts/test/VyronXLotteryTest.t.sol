// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXLottery.sol";
import "../src/MockUSDT.sol";
import "../src/mocks/MockLottery.sol";

contract VyronXLotteryTest is Test {
    VyronXLottery lottery;
    MockUSDT usdt;
    MockVYR vyr;
    MockRouter router;

    address owner = address(this);
    address payable[4] feeWallets;
    address payable buybackWallet;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave");
    address eve = makeAddr("eve");

    function setUp() public {
        usdt = new MockUSDT();
        vyr = new MockVYR();
        router = new MockRouter(address(usdt), address(vyr), 1000e18); // 1 USDT → 1000 VYR

        for (uint256 i = 0; i < 4; i++) {
            feeWallets[i] = payable(makeAddr(string(abi.encodePacked("wallet", vm.toString(i)))));
        }
        buybackWallet = payable(makeAddr("buyback"));

        lottery = new VyronXLottery(
            address(usdt), owner, feeWallets, buybackWallet,
            address(vyr), address(router)
        );

        address[5] memory users = [alice, bob, carol, dave, eve];
        for (uint256 i = 0; i < 5; i++) {
            usdt.mint(users[i], 100000e18);
            vm.startPrank(users[i]);
            usdt.approve(address(lottery), type(uint256).max);
            vm.stopPrank();
        }
    }

    // ════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ════════════════════════════════════════════════════

    function test_Constructor() public view {
        assertEq(address(lottery.usdt()), address(usdt));
        assertEq(lottery.owner(), owner);
        assertEq(lottery.walletShareBps(), 2000);
        assertEq(lottery.winner1ShareBps(), 5000);
        assertEq(lottery.winner2ShareBps(), 600);
        assertEq(lottery.winner3ShareBps(), 400);
        assertEq(lottery.buybackShareBps(), 2000);
        assertEq(lottery.nextRoundId(), 0);
        assertEq(lottery.currentRoundId(0), 0);
        assertEq(lottery.currentRoundId(1), 0);
        assertEq(lottery.currentRoundId(2), 0);
        assertEq(lottery.currentRoundId(3), 0);

        // Default ticket prices = $1
        assertEq(lottery.ticketPrice(0), 1e18);
        assertEq(lottery.ticketPrice(3), 1e18);

        // Default names
        string[4] memory names = lottery.getLotteryNames();
        assertEq(names[0], "Mega");
        assertEq(names[1], "Big");
        assertEq(names[2], "Medium");
        assertEq(names[3], "Small");
    }

    function test_RevertZeroUSDT() public {
        address payable[4] memory empty;
        vm.expectRevert("USDT zero");
        new VyronXLottery(address(0), owner, empty, buybackWallet, address(vyr), address(router));
    }

    // ════════════════════════════════════════════════════
    // ROUND MANAGEMENT
    // ════════════════════════════════════════════════════

    function test_OpenRound() public {
        lottery.openRound(0, 5000e18); // Mega prize $5000
        assertEq(lottery.currentRoundId(0), 1);
        assertEq(lottery.nextRoundId(), 1);

        VyronXLottery.RoundView memory r = lottery.getCurrentRound(0);
        assertEq(uint256(r.status), uint256(VyronXLottery.RoundStatus.Active));
        assertEq(r.prizeTarget, 5000e18);
        assertEq(r.lotteryType, 0);
    }

    function test_OpenMultipleTypesParallel() public {
        lottery.openRound(0, 10000e18); // Mega
        lottery.openRound(1, 5000e18);  // Big
        lottery.openRound(2, 1000e18);  // Medium
        lottery.openRound(3, 500e18);   // Small

        assertEq(lottery.currentRoundId(0), 1);
        assertEq(lottery.currentRoundId(1), 2);
        assertEq(lottery.currentRoundId(2), 3);
        assertEq(lottery.currentRoundId(3), 4);
        assertEq(lottery.nextRoundId(), 4);
    }

    function test_RevertOpenSameTypeTwice() public {
        lottery.openRound(0, 1000e18);
        vm.expectRevert("Type already active");
        lottery.openRound(0, 2000e18);
    }

    function test_ReopenAfterClose() public {
        lottery.openRound(0, 50e18); // threshold 100
        vm.prank(alice);
        lottery.buyTickets(0, 100); // triggers close

        assertEq(lottery.currentRoundId(0), 0); // freed after close
        lottery.openRound(0, 100e18); // new round
        assertEq(lottery.currentRoundId(0), 2);
    }

    function test_RevertOpenRoundNotOwner() public {
        vm.prank(alice);
        vm.expectRevert("Not owner");
        lottery.openRound(0, 1000e18);
    }

    function test_RevertInvalidType() public {
        vm.expectRevert("Invalid type");
        lottery.openRound(5, 1000e18);
    }

    function test_RoundCloseThreshold() public {
        lottery.openRound(0, 1000e18);
        // prize 1000, w1=50% → threshold = 2000
        assertEq(lottery.roundCloseThreshold(1), 2000e18);
    }

    function test_SetPrizeTarget() public {
        lottery.openRound(0, 1000e18);
        lottery.setPrizeTarget(0, 5000e18);
        VyronXLottery.RoundView memory r = lottery.getCurrentRound(0);
        assertEq(r.prizeTarget, 5000e18);
    }

    // ════════════════════════════════════════════════════
    // BUY TICKETS
    // ════════════════════════════════════════════════════

    function test_BuyTickets() public {
        lottery.openRound(0, 1000e18);
        vm.prank(alice);
        lottery.buyTickets(0, 5);

        VyronXLottery.RoundView memory r = lottery.getCurrentRound(0);
        assertEq(r.ticketCount, 5);
        assertEq(r.totalCollected, 5e18);
        assertEq(lottery.getUserTickets(1, alice), 5);
    }

    function test_BuyFromDifferentTypes() public {
        lottery.openRound(0, 100000e18);
        lottery.openRound(1, 100000e18);
        lottery.openRound(2, 100000e18);
        lottery.openRound(3, 100000e18);

        vm.prank(alice);
        lottery.buyTickets(0, 10); // Mega
        vm.prank(alice);
        lottery.buyTickets(2, 5);  // Medium

        assertEq(lottery.getUserTickets(1, alice), 10); // round 1 = Mega
        assertEq(lottery.getUserTickets(3, alice), 5);  // round 3 = Medium
    }

    function test_RevertBuyNoActive() public {
        vm.prank(alice);
        vm.expectRevert("No active round");
        lottery.buyTickets(0, 1);
    }

    function test_RevertBuyZero() public {
        lottery.openRound(0, 1000e18);
        vm.prank(alice);
        vm.expectRevert("Min 1 ticket");
        lottery.buyTickets(0, 0);
    }

    function test_UserHistoryMultiType() public {
        lottery.openRound(0, 100000e18);
        lottery.openRound(1, 100000e18);

        vm.startPrank(alice);
        lottery.buyTickets(0, 3); // Mega
        lottery.buyTickets(1, 2); // Big
        vm.stopPrank();

        VyronXLottery.TicketPurchase[] memory hist = lottery.getUserHistory(alice);
        assertEq(hist.length, 2);
        assertEq(hist[0].lotteryType, 0);
        assertEq(hist[0].ticketCount, 3);
        assertEq(hist[1].lotteryType, 1);
        assertEq(hist[1].ticketCount, 2);
    }

    // ════════════════════════════════════════════════════
    // AUTO-CLOSE & DISTRIBUTE
    // ════════════════════════════════════════════════════

    function test_AutoCloseOnThreshold() public {
        lottery.openRound(0, 100e18); // threshold = 200

        vm.prank(alice);
        lottery.buyTickets(0, 100);
        // Still active
        assertEq(uint256(lottery.getCurrentRound(0).status), 1);

        vm.prank(bob);
        lottery.buyTickets(0, 100); // total 200 → close
        assertEq(uint256(lottery.getCurrentRound(0).status), 0); // Inactive (freed)
        assertEq(lottery.totalRoundsCompleted(), 1);
    }

    function test_DistributionAmounts() public {
        lottery.openRound(0, 100e18); // threshold 200
        vm.prank(alice);
        lottery.buyTickets(0, 200); // triggers close

        uint256 pool = 200e18;
        uint256 w1 = (pool * 5000) / 10000; // 100
        uint256 w2 = (pool * 600) / 10000;  // 12
        uint256 w3 = (pool * 400) / 10000;  // 8
        uint256 bb = (pool * 2000) / 10000; // 40
        uint256 wl = (pool * 2000) / 10000; // 40

        VyronXLottery.RoundView memory r = lottery.getRound(1);
        assertEq(r.prize1, w1);
        assertEq(r.prize2, w2);
        assertEq(r.prize3, w3);
        assertEq(r.buybackAmount, bb);
        assertEq(r.walletPayoutTotal, wl);
    }

    function test_FeeWalletsReceiveShare() public {
        lottery.openRound(0, 100e18);
        vm.prank(alice);
        lottery.buyTickets(0, 200);

        uint256 perWallet = (200e18 * 2000) / 10000 / 4; // 10
        for (uint256 i = 0; i < 4; i++) {
            assertEq(usdt.balanceOf(feeWallets[i]), perWallet);
        }
    }

    function test_BuybackSwapsAndBurns() public {
        lottery.openRound(0, 100e18); // threshold 200
        vm.prank(alice);
        lottery.buyTickets(0, 200); // triggers close

        // Auto-buyback: 40 USDT → swap at rate 1000 → 40000 VYR → burn
        uint256 buybackUsdt = (200e18 * 2000) / 10000; // 40 USDT
        uint256 expectedVyrBurned = buybackUsdt * 1000e18 / 1e18; // 40000 VYR

        // VYR burned = totalSupply should have decreased (burn removes from supply)
        // But mockVYR minted then burned — net effect: 0 VYR in lottery, supply unchanged
        // The swap minted to lottery, burn called by lottery
        // Check: no VYR left in lottery
        assertEq(vyr.balanceOf(address(lottery)), 0, "VYR burned");

        // USDT went to router (swapped), not to buybackWallet
        // buybackWallet only gets fallback p2/p3 (no winner for those)
        // With 1 participant: w1=alice, w2/w3=null → p2+p3 go to buybackWallet
        uint256 p2 = (200e18 * 600) / 10000; // 12
        uint256 p3 = (200e18 * 400) / 10000; // 8
        assertEq(usdt.balanceOf(buybackWallet), p2 + p3, "fallback to buybackWallet");

        // Router holds the swapped USDT
        assertEq(usdt.balanceOf(address(router)), buybackUsdt, "router holds swapped USDT");
    }

    function test_BuybackFallbackWhenDisabled() public {
        lottery.setAutoBuybackEnabled(false);
        lottery.openRound(0, 100e18); // threshold 200
        vm.prank(alice);
        lottery.buyTickets(0, 200);

        // With auto disabled: buyback USDT (40) + p2 (12) + p3 (8) = 60 all go to buybackWallet
        uint256 buybackUsdt = (200e18 * 2000) / 10000; // 40
        uint256 p2 = (200e18 * 600) / 10000; // 12
        uint256 p3 = (200e18 * 400) / 10000; // 8
        assertEq(usdt.balanceOf(buybackWallet), buybackUsdt + p2 + p3);
    }

    function test_WinnerReceivesPrize() public {
        lottery.openRound(0, 100e18);
        vm.prank(alice);
        lottery.buyTickets(0, 200); // alice only participant → w1

        uint256 w1 = (200e18 * 5000) / 10000; // 100
        assertEq(usdt.balanceOf(alice), 100000e18 - 200e18 + w1);
    }

    function test_NoLeftoverUSDT() public {
        lottery.openRound(0, 100e18);
        vm.prank(alice);
        lottery.buyTickets(0, 200);
        assertEq(usdt.balanceOf(address(lottery)), 0, "No leftover");
    }

    // ════════════════════════════════════════════════════
    // PARALLEL CLOSE — two types close independently
    // ════════════════════════════════════════════════════

    function test_TwoTypesCloseIndependently() public {
        lottery.openRound(0, 50e18);  // Mega threshold 100
        lottery.openRound(1, 100e18); // Big threshold 200

        // Buy Mega only
        vm.prank(alice);
        lottery.buyTickets(0, 100); // Mega closes

        assertEq(lottery.totalRoundsCompleted(), 1);
        assertEq(lottery.currentRoundId(0), 0); // Mega freed
        assertEq(lottery.currentRoundId(1), 2); // Big still active

        // Buy Big
        vm.prank(bob);
        lottery.buyTickets(1, 200); // Big closes

        assertEq(lottery.totalRoundsCompleted(), 2);
        assertEq(lottery.currentRoundId(1), 0); // Big freed
    }

    // ════════════════════════════════════════════════════
    // WEIGHTED DRAW
    // ════════════════════════════════════════════════════

    function test_WeightedDraw3Participants() public {
        lottery.openRound(0, 500e18); // threshold 1000
        vm.prank(alice); lottery.buyTickets(0, 500);
        vm.prank(bob);   lottery.buyTickets(0, 300);
        vm.prank(carol); lottery.buyTickets(0, 200); // close

        VyronXLottery.RoundView memory r = lottery.getRound(1);
        assertNotEq(r.winner1, address(0));
        assertNotEq(r.winner2, address(0));
        assertNotEq(r.winner3, address(0));
        assertNotEq(r.winner1, r.winner2);
        assertNotEq(r.winner2, r.winner3);
        assertNotEq(r.winner1, r.winner3);
    }

    function test_4Participants3Winners() public {
        lottery.openRound(0, 250e18); // threshold 500
        vm.prank(alice); lottery.buyTickets(0, 125);
        vm.prank(bob);   lottery.buyTickets(0, 125);
        vm.prank(carol); lottery.buyTickets(0, 125);
        vm.prank(dave);  lottery.buyTickets(0, 125); // close

        VyronXLottery.RoundView memory r = lottery.getRound(1);
        assertNotEq(r.winner1, r.winner2);
        assertNotEq(r.winner1, r.winner3);
        assertNotEq(r.winner2, r.winner3);
    }

    // ════════════════════════════════════════════════════
    // ADMIN SETTINGS
    // ════════════════════════════════════════════════════

    function test_SetDistribution() public {
        lottery.setDistributionBps(1000, 2000, 6000, 500, 500);
        assertEq(lottery.walletShareBps(), 1000);
        assertEq(lottery.buybackShareBps(), 2000);
        assertEq(lottery.winner1ShareBps(), 6000);
        assertEq(lottery.winner2ShareBps(), 500);
        assertEq(lottery.winner3ShareBps(), 500);
    }

    function test_RevertInvalidDistribution() public {
        vm.expectRevert("Must sum 10000");
        lottery.setDistributionBps(1000, 2000, 5000, 500, 500);
    }

    function test_SetTicketPrice() public {
        lottery.setTicketPrice(0, 5e18); // Mega $5
        lottery.setTicketPrice(3, 1e18); // Small $1
        assertEq(lottery.ticketPrice(0), 5e18);
        assertEq(lottery.ticketPrice(3), 1e18);
    }

    function test_SetLotteryName() public {
        lottery.setLotteryName(0, "VyronX Mega Jackpot");
        lottery.setLotteryName(1, "Weekly Big");
        assertEq(lottery.lotteryNames(0), "VyronX Mega Jackpot");
        assertEq(lottery.lotteryNames(1), "Weekly Big");
    }

    function test_SetFeeWallets() public {
        address payable[4] memory nw;
        for (uint256 i = 0; i < 4; i++) nw[i] = payable(makeAddr(string(abi.encodePacked("n", vm.toString(i)))));
        lottery.setFeeWallets(nw, payable(makeAddr("nbb")));
        address[4] memory got = lottery.getFeeWallets();
        for (uint256 i = 0; i < 4; i++) assertEq(got[i], nw[i]);
    }

    function test_TransferOwnership() public {
        lottery.transferOwnership(alice);
        assertEq(lottery.owner(), alice);
    }

    function test_ForceCloseRound() public {
        lottery.openRound(0, 999999e18);
        vm.prank(alice);
        lottery.buyTickets(0, 50);

        lottery.forceCloseRound(0);
        assertEq(lottery.totalRoundsCompleted(), 1);
        assertEq(lottery.currentRoundId(0), 0);
    }

    function test_RecoverTokens() public {
        usdt.mint(address(this), 500e18);
        usdt.transfer(address(lottery), 100e18);
        lottery.recoverTokens(address(usdt), 100e18);
    }

    function test_GetAllCurrentRoundIds() public {
        lottery.openRound(0, 100000e18);
        lottery.openRound(2, 50000e18);
        uint256[4] memory ids = lottery.getAllCurrentRoundIds();
        assertEq(ids[0], 1);
        assertEq(ids[1], 0);
        assertEq(ids[2], 2);
        assertEq(ids[3], 0);
    }

    function test_GetTicketPrices() public {
        lottery.setTicketPrice(0, 10e18);
        uint256[4] memory prices = lottery.getTicketPrices();
        assertEq(prices[0], 10e18);
        assertEq(prices[1], 1e18);
    }

    receive() external payable {}
}
