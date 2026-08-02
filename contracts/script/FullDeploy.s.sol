// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VyronXToken} from "../src/VyronXToken.sol";
import {MockUSDT} from "../src/MockUSDT.sol";
import {VyronXPresale} from "../src/VyronXPresale.sol";
import {VyronXStaking} from "../src/VyronXStaking.sol";

interface IToken {
    function setAuthorized(address, bool) external;
    function setExcludedFromFees(address, bool) external;
    function setExcludedFromLimits(address, bool) external;
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
}

/// @title Full Fresh Deploy — All contracts from scratch
contract FullDeploy is Script {
    address constant PCS_MAINNET_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E; // PancakeSwap mainnet

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address deployer = vm.addr(pk);

        console.log("=== VYRONX FULL DEPLOY ===");

        // 1. Deploy Token
        VyronXToken token = new VyronXToken(PCS_MAINNET_ROUTER);
        console.log("TOKEN:", address(token));

        // 2. Use REAL USDT on mainnet (0x55d398326f99059fF775485246999027B3197955)
        //    OR deploy MockUSDT for testnet
        address usdtAddress = 0x55d398326f99059fF775485246999027B3197955; // BSC Mainnet USDT
        console.log("USDT:", usdtAddress);

        // 3. Deploy Presale
        VyronXPresale presale = new VyronXPresale(
            address(token), usdtAddress,
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer)
        );
        console.log("PRESALE:", address(presale));

        // 4. Deploy Staking
        VyronXStaking staking = new VyronXStaking(usdtAddress, address(token), payable(deployer));
        console.log("STAKING:", address(staking));

        // 5. Configure
        IToken t = IToken(address(token));
        t.setAuthorized(address(presale), true);
        t.setAuthorized(address(staking), true);
        t.setExcludedFromFees(address(presale), true);
        t.setExcludedFromFees(address(staking), true);
        t.setExcludedFromLimits(address(presale), true);
        t.setExcludedFromLimits(address(staking), true);

        // 6. Transfer tokens (deployer has 1B)
        // 300M → Presale contract
        t.transfer(address(presale), 300_000_000 * 10**18);
        // 500M → Staking contract
        t.approve(address(staking), 500_000_000 * 10**18);
        staking.fundRewardPool(500_000_000 * 10**18);
        // 200M → LP wallet (for PancakeSwap liquidity)
        t.transfer(0xE00D756D93f76473f446734A83146C9BEBBBf7c4, 200_000_000 * 10**18);

        // 7. Configure presale wallets (correct addresses)
        presale.setDistributionWallets(
            payable(0x8806A9abeC0A14085d6cFe43441Ecb2E77F89144),  // Marketing 10%
            payable(0xE00D756D93f76473f446734A83146C9BEBBBf7c4),  // LP 15%
            payable(0xa06f4d2A219e58586797cBD1265cd0C12b3b0522),  // Buyback 15%
            payable(0xa20281c0CdE24c65BdF54964d4Be86e43565451F)   // Tech 20%
        );
        presale.setDevWallets(
            payable(0x9d7f20EbB6C5D73a4CA57E53E97Fe2707FCCE720),  // Collaborators 10%
            payable(0x76681cccEb9F03d2a054211df8FEEbcbfE817521),  // Infrastructure 10%
            payable(0x5dBB4282cadE4C3f38F1Ff73c2141Ab0402b5eD3),  // Development 10%
            payable(0xe9A61001c79287C300378F5caB528baec36274Cd)   // Marketing 10%
        );

        // 8. Configure staking wallets
        staking.setFeeWallet(0xCA45A82266FbFAc591D1EC0ae356b7C5bDB65D00);
        staking.setUsdtCollector(0x77f30746492a6761C8E44A94397cc51F4313E48a);

        // 9. Configure presale phases ($0.01 and $0.02, no bonus)
        // setPhase(phaseId, priceInCents, bonusPercent, allocation)
        // $0.01 = 1 cent, $0.02 = 2 cents
        presale.setPhase(0, 1, 0, 150_000_000);
        presale.setPhase(1, 2, 0, 150_000_000);
        presale.setCurrentPhase(0);
        presale.startPresale();

        // 10. Open all staking pools
        staking.setPoolActive(0, true);
        staking.setPoolActive(1, true);
        staking.setPoolActive(2, true);
        staking.setPoolActive(3, true);

        // 11. No mint needed on mainnet — USDT already exists
        // usdt.mint(deployer, 1_000_000 * 10**18); // testnet only

        console.log("=== DEPLOY COMPLETE ===");

        vm.stopBroadcast();
    }
}
