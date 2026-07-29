// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VyronXToken} from "../src/VyronXToken.sol";
import {VyronXPresale} from "../src/VyronXPresale.sol";
import {VyronXStaking} from "../src/VyronXStaking.sol";

/// @title Deploy VyronX Ecosystem
/// @notice Deploys all 3 contracts in the correct order with proper configuration
contract DeployVyronX is Script {
    // BSC Addresses
    address constant PANCAKE_ROUTER_MAINNET = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address constant PANCAKE_ROUTER_TESTNET = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    address constant USDT_MAINNET = 0x55d398326f99059fF775485246999027B3197955; // BSC USDT (18 decimals)
    address constant USDT_TESTNET = 0x337610D27c682E347c13C18Ef2DFF3E1a6E6E4e8;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bool isTestnet = vm.envBool("TESTNET");

        vm.startBroadcast(deployerPrivateKey);

        address router = isTestnet ? PANCAKE_ROUTER_TESTNET : PANCAKE_ROUTER_MAINNET;
        address usdtAddress = isTestnet ? USDT_TESTNET : USDT_MAINNET;

        console.log("=== VyronX Deployment ===");
        console.log("Network:", isTestnet ? "BSC Testnet" : "BSC Mainnet");
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        // 1. Deploy Token
        VyronXToken token = new VyronXToken(router);
        console.log("[1/3] VyronXToken deployed:", address(token));

        // 2. Deploy Presale
        VyronXPresale presale = new VyronXPresale(
            address(token),
            usdtAddress,
            payable(0x8806A9abeC0A14085d6cFe43441Ecb2E77F89144), // marketing
            payable(0xE00D756D93f76473f446734A83146C9BEBBBf7c4), // LP
            payable(0xa06f4d2A219e58586797cBD1265cd0C12b3b0522), // buyback
            payable(0xa20281c0CdE24c65BdF54964d4Be86e43565451F), // tech
            payable(0x9d7f20EbB6C5D73a4CA57E53E97Fe2707FCCE720), // dev1
            payable(0x76681cccEb9F03d2a054211df8FEEbcbfE817521), // dev2
            payable(0x5dBB4282cadE4C3f38F1Ff73c2141Ab0402b5eD3), // dev3
            payable(0xe9A61001c79287C300378F5caB528baec36274Cd)  // dev4
        );
        console.log("[2/3] VyronXPresale deployed:", address(presale));

        // 3. Deploy Staking
        VyronXStaking staking = new VyronXStaking(
            usdtAddress,
            address(token),
            0x77f30746492a6761C8E44A94397cc51F4313E48a // USDT collector wallet
        );
        console.log("[3/3] VyronXStaking deployed:", address(staking));

        // 4. Post-deploy configuration
        console.log("=== Post-Deploy Configuration ===");

        // Authorize presale + staking on token
        token.setAuthorized(address(presale), true);
        token.setAuthorized(address(staking), true);
        console.log("[CFG] Authorized presale + staking on token");

        // Exclude from fees
        token.setExcludedFromFees(address(presale), true);
        token.setExcludedFromFees(address(staking), true);
        console.log("[CFG] Excluded presale + staking from fees");

        // Exclude from limits
        token.setExcludedFromLimits(address(presale), true);
        token.setExcludedFromLimits(address(staking), true);
        console.log("[CFG] Excluded presale + staking from limits");

        // Transfer presale allocation (300M) to presale contract
        uint256 presaleAllocation = 300_000_000 * 10 ** 18;
        token.transfer(address(presale), presaleAllocation);
        console.log("[CFG] Transferred 300M VYR to presale contract");

        // Approve staking contract to pull 500M VYR from deployer
        uint256 stakingAllocation = 500_000_000 * 10 ** 18;
        token.approve(address(staking), stakingAllocation);
        console.log("[CFG] Approved staking contract for 500M VYR");

        // Fund staking reward pool (pulls tokens from deployer via transferFrom)
        staking.fundRewardPool(stakingAllocation);
        console.log("[CFG] Funded staking reward pool with 500M VYR");

        // Configure presale phases
        presale.setPhase(0, 1, 20, 75_000_000);   // Phase 1: $0.01, 20% bonus, 75M tokens
        presale.setPhase(1, 2, 15, 75_000_000);   // Phase 2: $0.02, 15% bonus, 75M tokens
        presale.setPhase(2, 3, 10, 75_000_000);   // Phase 3: $0.03, 10% bonus, 75M tokens
        presale.setPhase(3, 4, 5, 75_000_000);    // Phase 4: $0.04, 5% bonus, 75M tokens
        presale.setCurrentPhase(0);
        console.log("[CFG] Configured 4 presale phases");

        vm.stopBroadcast();

        // Summary
        console.log("=== Deployment Summary ===");
        console.log("Token:  ", address(token));
        console.log("Presale:", address(presale));
        console.log("Staking:", address(staking));
        console.log("");
        console.log("Remaining with deployer: 200M VYR (LP allocation)");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Start presale: presale.startPresale()");
        console.log("2. Create LP on PancakeSwap with 200M VYR + raised BNB");
        console.log("3. Enable trading: token.enableTrading()");
        console.log("4. Open staking pools: staking.setPoolActive(id, true)");
    }
}
