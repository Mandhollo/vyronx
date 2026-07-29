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
    address constant PCS_TESTNET_ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        address deployer = vm.addr(pk);

        console.log("=== VYRONX FULL DEPLOY ===");

        // 1. Deploy Token
        VyronXToken token = new VyronXToken(PCS_TESTNET_ROUTER);
        console.log("TOKEN:", address(token));

        // 2. Deploy MockUSDT
        MockUSDT usdt = new MockUSDT();
        console.log("USDT:", address(usdt));

        // 3. Deploy Presale
        VyronXPresale presale = new VyronXPresale(
            address(token), address(usdt),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer)
        );
        console.log("PRESALE:", address(presale));

        // 4. Deploy Staking
        VyronXStaking staking = new VyronXStaking(address(usdt), address(token), payable(deployer));
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
        t.transfer(address(presale), 300_000_000 * 10**18);
        t.approve(address(staking), 500_000_000 * 10**18);
        staking.fundRewardPool(500_000_000 * 10**18);

        // 7. Configure presale phases
        presale.setPhase(0, 1, 20, 75_000_000);
        presale.setPhase(1, 2, 15, 75_000_000);
        presale.setPhase(2, 3, 10, 75_000_000);
        presale.setPhase(3, 4, 5, 75_000_000);
        presale.setCurrentPhase(0);
        presale.startPresale();

        // 8. Open all staking pools
        staking.setPoolActive(0, true);
        staking.setPoolActive(1, true);
        staking.setPoolActive(2, true);
        staking.setPoolActive(3, true);

        // 9. Mint test USDT
        usdt.mint(deployer, 1_000_000 * 10**6);

        console.log("=== DEPLOY COMPLETE ===");

        vm.stopBroadcast();
    }
}
