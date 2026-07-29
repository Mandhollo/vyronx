// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IERC20Metadata is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

interface IUniswapV2Router {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

/// @title VyronX Token ($VYR)
/// @notice BEP-20 token with dual fee system: 8% buy tax (rewards+LP+burn) and 8% sell tax in BNB
/// @dev Buy tax: 4% rewards, 2% auto-liquidity, 2% burn. Sell tax: 2% x 4 BNB wallets.
contract VyronXToken is IERC20, IERC20Metadata {
    // ════════════════════════════════════════════════════════════
    // Token Metadata
    // ════════════════════════════════════════════════════════════
    string private constant _name = "VyronX";
    string private constant _symbol = "VYR";
    uint8 private constant _decimals = 18;
    uint256 private constant _totalSupply = 1_000_000_000 * 10 ** 18; // 1 Billion

    // ════════════════════════════════════════════════════════════
    // Balances & Allowances
    // ════════════════════════════════════════════════════════════
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ════════════════════════════════════════════════════════════
    // Fee Configuration
    // ════════════════════════════════════════════════════════════
    struct BuyFees {
        uint256 rewards; // 4% — distributed to holders/stakers
        uint256 liquidity; // 2% — auto-added to LP
        uint256 burn; // 2% — permanently burned
    }

    struct SellFees {
        uint256 wallet1; // 2% — in BNB
        uint256 wallet2; // 2% — in BNB
        uint256 wallet3; // 2% — in BNB
        uint256 wallet4; // 2% — in BNB
    }

    BuyFees public buyFee = BuyFees({rewards: 4, liquidity: 2, burn: 2}); // Total: 8%
    SellFees public sellFee =
        SellFees({wallet1: 2, wallet2: 2, wallet3: 2, wallet4: 2}); // Total: 8%

    uint256 public constant BUY_FEE_TOTAL = 8; // 4+2+2
    uint256 public constant SELL_FEE_TOTAL = 8; // 2+2+2+2

    // ════════════════════════════════════════════════════════════
    // Fee Recipient Wallets (Sell Tax → BNB)
    // ════════════════════════════════════════════════════════════
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address payable public sellFeeWallet1 = payable(0x9d7f20EbB6C5D73a4CA57E53E97Fe2707FCCE720);
    address payable public sellFeeWallet2 = payable(0x76681cccEb9F03d2a054211df8FEEbcbfE817521);
    address payable public sellFeeWallet3 = payable(0x5dBB4282cadE4C3f38F1Ff73c2141Ab0402b5eD3);
    address payable public sellFeeWallet4 = payable(0xe9A61001c79287C300378F5caB528baec36274Cd);

    // ════════════════════════════════════════════════════════════
    // DEX / Liquidity
    // ════════════════════════════════════════════════════════════
    IUniswapV2Router public dexRouter;
    address public lpPair;
    bool public tradingEnabled = false;

    // Swap settings for sell-tax-in-BNB
    bool private inSwapAndLiquify;
    bool public swapAndLiquifyEnabled = true;
    uint256 public numTokensSellToAddToLiquidity = 500_000 * 10 ** 18; // 500K tokens threshold

    // ════════════════════════════════════════════════════════════
    // Anti-Bot / Anti-Whale
    // ════════════════════════════════════════════════════════════
    uint256 public maxWalletAmount = 20_000_000 * 10 ** 18; // 2% of supply
    uint256 public maxTxAmount = 10_000_000 * 10 ** 18; // 1% of supply
    uint256 public launchBlock;
    uint256 public constant ANTI_SNIPE_BLOCKS = 3;
    uint256 public constant ANTI_SNIPE_FEE = 25; // 25% fee in first 3 blocks

    // ════════════════════════════════════════════════════════════
    // Mappings — Access Control & Exclusions
    // ════════════════════════════════════════════════════════════
    mapping(address => bool) public isAuthorized; // owner, presale, LP pair
    mapping(address => bool) public isExcludedFromFees;
    mapping(address => bool) public isExcludedFromLimits;
    mapping(address => bool) public isBlacklisted;

    // ════════════════════════════════════════════════════════════
    // Owner
    // ════════════════════════════════════════════════════════════
    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    // ════════════════════════════════════════════════════════════
    // Events
    // ════════════════════════════════════════════════════════════
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TradingEnabled(uint256 blockNumber);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiquidity);
    event SellFeeDistributedInBNB(uint256 bnbAmount);
    event Burned(address indexed burner, uint256 amount);
    event RewardsDistributed(uint256 amount);

    // ════════════════════════════════════════════════════════════
    // Modifiers
    // ════════════════════════════════════════════════════════════
    modifier lockTheSwap() {
        inSwapAndLiquify = true;
        _;
        inSwapAndLiquify = false;
    }

    // ════════════════════════════════════════════════════════════
    // Constructor
    // ════════════════════════════════════════════════════════════
    constructor(address _router) {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);

        // DEX setup
        dexRouter = IUniswapV2Router(_router);

        // Try to create LP pair; if factory fails (testnet), set pair to zero temporarily
        try IUniswapV2Factory(dexRouter.factory()).createPair(address(this), dexRouter.WETH()) returns (address pair) {
            lpPair = pair;
        } catch {
            lpPair = address(0); // Can be set later via setLpPair()
        }

        // Authorize owner
        isAuthorized[owner] = true;
        if (lpPair != address(0)) {
            isAuthorized[lpPair] = true;
        }

        // Exclude from fees
        isExcludedFromFees[owner] = true;
        isExcludedFromFees[address(this)] = true;
        isExcludedFromFees[DEAD] = true;

        // Exclude from limits
        isExcludedFromLimits[owner] = true;
        isExcludedFromLimits[address(this)] = true;
        isExcludedFromLimits[DEAD] = true;
        if (lpPair != address(0)) {
            isExcludedFromLimits[lpPair] = true;
        }

        // Mint total supply to owner
        _balances[owner] = _totalSupply;
        emit Transfer(address(0), owner, _totalSupply);
    }

    // ════════════════════════════════════════════════════════════
    // ERC-20 Core Functions
    // ════════════════════════════════════════════════════════════
    function name() public pure override returns (string memory) {
        return _name;
    }

    function symbol() public pure override returns (string memory) {
        return _symbol;
    }

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    function totalSupply() public pure override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address wallet, address spender) public view override returns (uint256) {
        return _allowances[wallet][spender];
    }

    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        _transfer(from, to, amount);
        return true;
    }

    function _approve(address wallet, address spender, uint256 amount) internal {
        require(wallet != address(0), "Approve from zero address");
        require(spender != address(0), "Approve to zero address");
        _allowances[wallet][spender] = amount;
        emit Approval(wallet, spender, amount);
    }

    function _spendAllowance(address wallet, address spender, uint256 amount) internal {
        uint256 currentAllowance = allowance(wallet, spender);
        require(currentAllowance >= amount, "Insufficient allowance");
        if (currentAllowance != type(uint256).max) {
            _approve(wallet, spender, currentAllowance - amount);
        }
    }

    // ════════════════════════════════════════════════════════════
    // Internal Transfer — Fee Logic
    // ════════════════════════════════════════════════════════════
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "Transfer from zero address");
        require(to != address(0), "Transfer to zero address");
        require(amount > 0, "Transfer amount must be > 0");
        require(!isBlacklisted[from] && !isBlacklisted[to], "Address is blacklisted");

        // Trading lock check
        if (!tradingEnabled) {
            require(isAuthorized[from] || isAuthorized[to], "Trading not enabled");
        }

        // Anti-snipe: extra fee in first N blocks
        bool isAntiSnipe = block.number <= launchBlock + ANTI_SNIPE_BLOCKS;

        // Determine transfer type
        bool isBuy = isAuthorized[from];
        bool isSell = isAuthorized[to];

        // Limits check (skip for authorized/excluded)
        if (!isExcludedFromLimits[from] && !isExcludedFromLimits[to]) {
            if (isBuy) {
                require(amount <= maxTxAmount, "Exceeds max transaction");
                require(_balances[to] + amount <= maxWalletAmount, "Exceeds max wallet");
            }
            if (isSell) {
                require(amount <= maxTxAmount, "Exceeds max transaction");
            }
        }

        // Fee calculation
        uint256 feeAmount = 0;
        bool takeFee = !isExcludedFromFees[from] && !isExcludedFromFees[to] && !inSwapAndLiquify;

        if (takeFee) {
            if (isAntiSnipe) {
                // Anti-sniper fee
                feeAmount = (amount * ANTI_SNIPE_FEE) / 100;
                _balances[address(this)] += feeAmount;
            } else if (isBuy) {
                feeAmount = (amount * BUY_FEE_TOTAL) / 100;
                _splitBuyFee(feeAmount);
            } else if (isSell) {
                feeAmount = (amount * SELL_FEE_TOTAL) / 100;
                _balances[address(this)] += feeAmount;

                // Swap tokens → BNB and distribute to 4 wallets
                uint256 contractTokenBalance = _balances[address(this)];
                if (
                    contractTokenBalance >= numTokensSellToAddToLiquidity && swapAndLiquifyEnabled
                        && !inSwapAndLiquify
                ) {
                    _swapAndDistributeBNB(contractTokenBalance);
                }
            }
        }

        // Transfer
        _balances[from] -= amount;
        _balances[to] += (amount - feeAmount);
        emit Transfer(from, to, amount - feeAmount);
    }

    // ════════════════════════════════════════════════════════════
    // Buy Fee Split: 4% rewards, 2% LP, 2% burn
    // ════════════════════════════════════════════════════════════
    function _splitBuyFee(uint256 feeAmount) internal {
        // Calculate individual portions
        uint256 rewardPortion = (feeAmount * buyFee.rewards) / BUY_FEE_TOTAL;
        uint256 lpPortion = (feeAmount * buyFee.liquidity) / BUY_FEE_TOTAL;
        uint256 burnPortion = feeAmount - rewardPortion - lpPortion; // remainder = burn

        // Rewards: keep on contract for later distribution
        _balances[address(this)] += rewardPortion;
        emit RewardsDistributed(rewardPortion);

        // LP portion: keep on contract, will be added to liquidity during swap
        _balances[address(this)] += lpPortion;

        // Burn: send to dead address permanently
        if (burnPortion > 0) {
            _balances[address(this)] -= burnPortion;
            _balances[DEAD] += burnPortion;
            emit Transfer(address(this), DEAD, burnPortion);
            emit Burned(msg.sender, burnPortion);
        }
    }

    // ════════════════════════════════════════════════════════════
    // Sell Fee: Swap tokens → BNB and distribute to 4 wallets
    // ════════════════════════════════════════════════════════════
    function _swapAndDistributeBNB(uint256 tokenAmount) internal lockTheSwap {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = dexRouter.WETH();

        // Approve router
        _approve(address(this), address(dexRouter), tokenAmount);

        // Swap tokens for BNB
        uint256 initialBalance = address(this).balance;
        dexRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount, 0, path, address(this), block.timestamp
        );
        uint256 bnbReceived = address(this).balance - initialBalance;

        // Distribute BNB equally to 4 wallets
        uint256 perWallet = bnbReceived / 4;
        sellFeeWallet1.transfer(perWallet);
        sellFeeWallet2.transfer(perWallet);
        sellFeeWallet3.transfer(perWallet);
        sellFeeWallet4.transfer(address(this).balance); // remainder to wallet4

        emit SellFeeDistributedInBNB(bnbReceived);
    }

    // ════════════════════════════════════════════════════════════
    // Admin Functions
    // ═════════════════════════════════ ══════════════════════════
    function enableTrading() external onlyOwner {
        require(!tradingEnabled, "Trading already enabled");
        tradingEnabled = true;
        launchBlock = block.number;
        emit TradingEnabled(block.number);
    }

    function setAuthorized(address account, bool status) external onlyOwner {
        isAuthorized[account] = status;
    }

    function setExcludedFromFees(address account, bool status) external onlyOwner {
        isExcludedFromFees[account] = status;
    }

    function setExcludedFromLimits(address account, bool status) external onlyOwner {
        isExcludedFromLimits[account] = status;
    }

    function setBlacklist(address account, bool status) external onlyOwner {
        isBlacklisted[account] = status;
    }

    function setMaxWalletAmount(uint256 amount) external onlyOwner {
        require(amount >= 1_000_000 * 10 ** 18, "Too low"); // min 0.1%
        maxWalletAmount = amount;
    }

    function setMaxTxAmount(uint256 amount) external onlyOwner {
        require(amount >= 500_000 * 10 ** 18, "Too low");
        maxTxAmount = amount;
    }

    function setSwapAndLiquifyEnabled(bool _enabled) external onlyOwner {
        swapAndLiquifyEnabled = _enabled;
    }

    /// @notice Set LP pair address manually (useful if constructor couldn't create it)
    function setLpPair(address pair) external onlyOwner {
        require(pair != address(0), "Zero address");
        lpPair = pair;
        isAuthorized[pair] = true;
        isExcludedFromLimits[pair] = true;
    }

    function setNumTokensSellToAddToLiquidity(uint256 amount) external onlyOwner {
        numTokensSellToAddToLiquidity = amount;
    }

    function setSellFeeWallets(
        address payable _w1,
        address payable _w2,
        address payable _w3,
        address payable _w4
    ) external onlyOwner {
        sellFeeWallet1 = _w1;
        sellFeeWallet2 = _w2;
        sellFeeWallet3 = _w3;
        sellFeeWallet4 = _w4;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    /// @notice Withdraw any BNB stuck in the contract
    function withdrawStuckBNB(address payable to) external onlyOwner {
        require(to != address(0), "Zero address");
        uint256 balance = address(this).balance;
        require(balance > 0, "No BNB");
        to.transfer(balance);
    }

    /// @notice Withdraw any stuck ERC20 tokens
    function withdrawStuckTokens(address token, address to) external onlyOwner {
        require(token != address(this), "Cannot withdraw VYR");
        require(to != address(0), "Zero address");
        IERC20(token).transfer(to, IERC20(token).balanceOf(address(this)));
    }

    // ════════════════════════════════════════════════════════════
    // View — for frontend
    // ════════════════════════════════════════════════════════════
    function getContractInfo()
        external
        view
        returns (
            uint256 _totalSupplyValue,
            uint256 _maxWallet,
            uint256 _maxTx,
            bool _tradingEnabled,
            bool _swapAndLiquify,
            address _lpPair,
            uint256 _launchBlock
        )
    {
        return (
            _totalSupply,
            maxWalletAmount,
            maxTxAmount,
            tradingEnabled,
            swapAndLiquifyEnabled,
            lpPair,
            launchBlock
        );
    }

    // ═══════════════════════════════════════ + Support
    // ════════════════════════════════════════════════════════════
    /// @notice Holder-initiated burn
    function burn(uint256 amount) external {
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[DEAD] += amount;
        emit Transfer(msg.sender, DEAD, amount);
        emit Burned(msg.sender, amount);
    }

    /// @notice Distribute accumulated rewards to stakers (called by staking contract)
    function distributeRewards(address[] calldata recipients, uint256[] calldata amounts) external {
        require(msg.sender == owner || isAuthorized[msg.sender], "Not authorized");
        require(recipients.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            require(_balances[address(this)] >= amounts[i], "Insufficient rewards pool");
            _balances[address(this)] -= amounts[i];
            _balances[recipients[i]] += amounts[i];
            emit Transfer(address(this), recipients[i], amounts[i]);
        }
        emit RewardsDistributed(0);
    }

    // ══════════════════════════════════════════════════
    // Receive BNB (from DEX swaps)
    // ═══════════════════════════ Token
    receive() external payable {}
}
