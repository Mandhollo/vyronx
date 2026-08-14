// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../MockUSDT.sol";

/// @notice Mock VYR token with burn support for testing
contract MockVYR {
    string public name = "Mock VYR";
    string public symbol = "mVYR";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function burn(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
    }
}

/// @notice Minimal mock PancakeSwap router that simulates USDT->VYR swap
contract MockRouter {
    address public usdt;
    address public vyr;
    uint256 public rate;

    constructor(address _usdt, address _vyr, uint256 _rate) {
        usdt = _usdt;
        vyr = _vyr;
        rate = _rate;
    }

    function factory() external pure returns (address) { return address(0); }
    function WETH() external pure returns (address) { return address(0); }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external {
        require(!failMode, "MockRouter: forced fail");
        require(path[0] == usdt && path[1] == vyr, "Bad path");
        // Pull USDT from caller (the lottery contract already approved)
        // Simple transfer since mock USDT has no restriction
        MockUSDT(path[0]).transferFrom(msg.sender, address(this), amountIn);
        uint256 vyrOut = amountIn * rate / 1e18;
        MockVYR(path[1]).mint(to, vyrOut);
    }

    function setRate(uint256 _rate) external { rate = _rate; }

    /// @notice Fail mode: reverts the swap to test try/catch fallback paths
    bool public failMode;
    function setFailMode(bool _fail) external { failMode = _fail; }
}
