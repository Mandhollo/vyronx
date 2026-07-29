// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title MockRouter — Minimal mock for testing token constructor
contract MockRouter {
    address private _factory;
    address private _weth;

    constructor(address factory_, address weth_) {
        _factory = factory_;
        _weth = weth_;
    }

    function factory() external view returns (address) {
        return _factory;
    }

    function WETH() external pure returns (address) {
        return 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    }
}

/// @title MockFactory — Minimal mock factory
contract MockFactory {
    function createPair(address, address) external pure returns (address) {
        return 0x0000000000000000000000000000000000001234; // dummy pair
    }
}
