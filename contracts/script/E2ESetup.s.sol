// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
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

/// @title E2E Test Setup — Deploys MockUSDT + reconfigures Presale/Staking
contract E2ESetup is Script {
    // Existing deployed contracts
    address constant TOKEN = 0xeadd2EfE2e912E8bDb55401854B8c2cdbaBefC36;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        address deployer = vm.addr(pk);
        console.log("Deployer:", deployer);

        // 1. Deploy MockUSDT
        MockUSDT usdt = new MockUSDT();
        console.log("MockUSDT:", address(usdt));

        // 2. Deploy new Presale pointing to MockUSDT
        VyronXPresale presale = new VyronXPresale(
            TOKEN,
            address(usdt),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer), payable(deployer),
            payable(deployer), payable(deployer)
        );
        console.log("New Presale:", address(presale));

        // 3. Deploy new Staking pointing to MockUSDT
        VyronXStaking staking = new VyronXStaking(
            address(usdt),
            TOKEN,
            payable(deployer)
        );
        console.log("New Staking:", address(staking));

        // 4. Authorize + exclude from fees
        IToken token = IToken(TOKEN);
        token.setAuthorized(address(presale), true);
        token.setAuthorized(address(staking), true);
        token.setExcludedFromFees(address(presale), true);
        token.setExcludedFromFees(address(staking), true);
        token.setExcludedFromLimits(address(presale), true);
        token.setExcludedFromLimits(address(staking), true);

        // 5. Transfer tokens (deployer has 200M available)
        token.transfer(address(presale), 100_000_000 * 10**18);
        token.approve(address(staking), 100_000_000 * 10**18);
        staking.fundRewardPool(100_000_000 * 10**18);

        // 6. Configure presale phases
        presale.setPhase(0, 1, 20, 75_000_000);
        presale.setPhase(1, 2, 15, 75_000_000);
        presale.setPhase(2, 3, 10, 75_000_000);
        presale.setPhase(3, 4, 5, 75_000_000);
        presale.setCurrentPhase(0);
        presale.startPresale();

        // 7. Open all staking pools
        staking.setPoolActive(0, true);
        staking.setPoolActive(1, true);
        staking.setPoolActive(2, true);
        staking.setPoolActive(3, true);

        // 8. Mint test USDT to deployer
        usdt.mint(deployer, 1_000_000 * 10**6);

        console.log("=== SETUP COMPLETE ===");

        vm.stopBroadcast();
    }
}
