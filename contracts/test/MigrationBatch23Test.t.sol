// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/VyronXStakingV5.sol";

/// @dev Simulates EXACTLY the admin button payload: the 23 on-chain V4 vouchers
///      with their on-chain referrers, migrated in ONE migrateVoucherBatch call.
contract MigrationBatch23Test is Test {
    VyronXStakingV5 staking;
    MockERC20M usdt;
    MockERC20M vyr;
    address constant OWNER = address(0x77619322427f006b14DA3Dbb25F9eb420372f7c7);
    address constant MOTHER = 0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c;

    function setUp() public {
        usdt = new MockERC20M();
        vyr = new MockERC20M();
        vyr.mint(address(this), 1_000_000_000e18);
        staking = new VyronXStakingV5(address(usdt), address(vyr), address(0xC011), OWNER);
        vyr.transfer(address(staking), 500_000_000e18);
    }

    function test_MigrateAll23_InOneTx() public {
        address[] memory recipients = new address[](23);
        uint256[] memory poolIds = new uint256[](23);
        uint256[] memory values = new uint256[](23);
        address[] memory referrers = new address[](23);

        recipients[0] = 0xFfAF2525F659aC7Da49dfCd4D15b12eFc578539c; referrers[0] = OWNER;                                   // Conta Mãe
        recipients[1] = 0xEd324c73fae8bCbC3318123a025ec47A41E20b71; referrers[1] = MOTHER;                                  // Thiago
        recipients[2] = 0xB863C989b252749f89d14086fabB40E5f17ab77D; referrers[2] = 0xEd324c73fae8bCbC3318123a025ec47A41E20b71; // Ind. Thiago
        recipients[3] = 0x5b4b91aA04e2722ebAF4A6090970c1c92BEe1090; referrers[3] = MOTHER;                                  // Promotor 3
        recipients[4] = 0xd7A8484fD713D28870FCd4ad198fAB9e3ffDedB1; referrers[4] = MOTHER;                                  // Deployer
        recipients[5] = 0xB783cC9C7785caf201d77167eCB60f381AAca9d9; referrers[5] = MOTHER;                                  // Promotor 5
        recipients[6] = 0x470a2608fa72f823d4C32Bf32f3ea318fb995c6E; referrers[6] = MOTHER;                                  // Promotor 6
        recipients[7] = 0x11B9aF1e89C2c51aB39be59Ea248Cb6a495Cb84e; referrers[7] = MOTHER;                                  // Promotor 7
        recipients[8] = 0x301892e42aE40327856bb676B1e7c2e4C4B7392c; referrers[8] = 0x11B9aF1e89C2c51aB39be59Ea248Cb6a495Cb84e; // Ind. Promotor 7
        recipients[9] = 0x28c438cb3Ab95B6dEE755A3f3570943b52C7b0F4; referrers[9] = MOTHER;                                  // Promotor 8
        recipients[10] = 0x3b791FF255AD221475e5551FfE0FB605b9753257; referrers[10] = MOTHER;                                // Promotor 9
        recipients[11] = 0xC06cedf252139469B797b719B97C0541dab7aC77; referrers[11] = MOTHER;                                // Promotor 10
        recipients[12] = 0x9D173220DA490ea1374F818106707D6a749fe700; referrers[12] = MOTHER;                                // Promotor 11
        recipients[13] = 0x8986e36a8814b3783c0C4034654708115349b356; referrers[13] = MOTHER;                                // Promotor 12
        recipients[14] = 0x3A23c096eab6bB2Fc09921eb22998Ae37E9C2F7b; referrers[14] = 0x28c438cb3Ab95B6dEE755A3f3570943b52C7b0F4; // Ind. Promotor 8
        recipients[15] = 0xE42Ea653Be137954b0bFF7193c06A363CEccbB3b; referrers[15] = MOTHER;                                // Promotor 13
        recipients[16] = 0xF077609b70baF4eA503E54D1731d65eB4eBB149e; referrers[16] = MOTHER;                                // Promotor 14
        recipients[17] = 0x9Db81f4E9CdD28C1497cC147bE36055A8859E034; referrers[17] = MOTHER;                                // Promotor 15
        recipients[18] = 0x9A38A4b356536302fdF80A114C70cbC5a9A3E8d1; referrers[18] = MOTHER;                                // Promotor 16
        recipients[19] = 0xa3Ebe62F3493DEfe02F828183796d26b39312C51; referrers[19] = MOTHER;                                // Promotor 17
        recipients[20] = 0x76a5cbf390Cb72AC820857FAA7f8F5a9152B579C; referrers[20] = MOTHER;                                // Promotor 18
        recipients[21] = 0xd784b8c7B8ADCF81dEEAbB75883656a39728C4B0; referrers[21] = MOTHER;                                // Promotor 19
        recipients[22] = 0xe9A61001c79287C300378F5caB528baec36274Cd; referrers[22] = MOTHER;                                // Promotor 20

        for (uint256 i = 0; i < 23; i++) {
            poolIds[i] = 3;
            values[i] = 1100e18;
        }

        vm.prank(address(this)); // deployer is owner here; on mainnet ownership transferred to 0x7761
        staking.migrateVoucherBatch(recipients, poolIds, values, referrers);

        // Verify all 23 migrated with correct tree
        assertEq(staking.getVoucherCount(), 23, "23 vouchers");
        assertEq(staking.referrer(0xEd324c73fae8bCbC3318123a025ec47A41E20b71), MOTHER, "Thiago under Mother");
        assertEq(staking.referrer(0xB863C989b252749f89d14086fabB40E5f17ab77D), 0xEd324c73fae8bCbC3318123a025ec47A41E20b71, "Ind. Thiago under Thiago");
        // 21 directs under Mother (23 - Mother - Thiago... actually 20 here + check owner)
        // Mother has directs: Thiago + 18 promotores + 2 indicados? Referral tree preserved:
        (, uint256 motherDirects) = staking.getAffiliateQualification(MOTHER);
        // Each voucher $1,100 >= $100 -> all qualified directs
        assertEq(motherDirects, 19, "Mother: Thiago+Prom3+Deployer+P5..P20 = 19 qualified directs");
        assertTrue(staking.hasActivePool360(MOTHER), "Mother 360-enabled via voucher");
    }
}

contract MockERC20M is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= allowance[from][msg.sender]; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount; return true;
    }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
}
