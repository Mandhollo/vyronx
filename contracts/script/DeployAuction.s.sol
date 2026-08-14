// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/VyronXAuction.sol";

/// @notice Deploy VyronXAuction (penny auction) to BSC mainnet.
///         After deploy, owner MUST (via admin panel buttons):
///         1. Token: setExcludedFromFees(auction, true) + setAuthorized + setExcludedFromLimits
///         2. Fund the prize pool with USDT (fundPrizePool)
///         3. Open first auction
contract DeployAuction is Script {
    address constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address constant VYR_TOKEN = 0xBFa4E255745e784bc3A449a2C507f5C29877cD66;
    address constant PCS_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address constant STAKING_V4 = 0xeAEAd8DAe5234Ef82B40F308006faB2c7FFF3A9A; // vyrPriceInUsdt oracle (verified: 1e18)

    address constant OWNER = 0x77619322427f006b14DA3Dbb25F9eb420372f7c7;

    address payable constant FEE_W0 = payable(0x9d7f20EbB6C5D73a4CA57E53E97Fe2707FCCE720);
    address payable constant FEE_W1 = payable(0x76681cccEb9F03d2a054211df8FEEbcbfE817521);
    address payable constant FEE_W2 = payable(0x5dBB4282cadE4C3f38F1Ff73c2141Ab0402b5eD3);
    address payable constant FEE_W3 = payable(0xe9A61001c79287C300378F5caB528baec36274Cd);

    // Owner wallet as default for all three — CHANGEABLE ANY TIME via admin panel buttons
    address payable constant BUYBACK_WALLET = payable(0x77619322427f006b14DA3Dbb25F9eb420372f7c7);
    address payable constant MLM_WALLET = payable(0x77619322427f006b14DA3Dbb25F9eb420372f7c7);
    address payable constant TREASURY_WALLET = payable(0x77619322427f006b14DA3Dbb25F9eb420372f7c7);

    function run() external {
        vm.broadcast();
        address payable[4] memory feeWallets = [FEE_W0, FEE_W1, FEE_W2, FEE_W3];
        VyronXAuction auction = new VyronXAuction(
            USDT, OWNER, VYR_TOKEN, PCS_ROUTER, STAKING_V4,
            feeWallets, MLM_WALLET, TREASURY_WALLET, BUYBACK_WALLET
        );
        console.log("VyronXAuction deployed at:", address(auction));
    }
}
