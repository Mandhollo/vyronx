// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PresaleReferral — Wrapper that adds 10% referral bonus on top of presale purchases
/// @notice Buyer receives 100% normal tokens. Referrer receives 10% EXTRA bonus from reserve.
/// @dev Must be authorized in Token contract (setAuthorized) so it can forward tokens while trading is locked.
interface IVyronXPresale {
    function buyWithUsdt(uint256 usdtAmount) external;
}

contract PresaleReferral is Ownable, ReentrancyGuard {
    IERC20 public immutable usdt;
    IERC20 public immutable vyrToken;
    IVyronXPresale public immutable presale;

    uint256 public constant REFERRAL_BONUS_BPS = 1000; // 10% in basis points

    mapping(address => address) public referrer;            // buyer -> referrer (set once)
    mapping(address => uint256) public referralEarnings;    // referrer -> total VYR earned

    event ReferralRegistered(address indexed buyer, address indexed referrer);
    event BoughtWithReferral(address indexed buyer, uint256 usdtAmount, uint256 tokensReceived, address indexed referrer);
    event ReferralBonusPaid(address indexed buyer, address indexed referrer, uint256 bonus);
    event ReserveFunded(uint256 amount);
    event ReserveWithdrawn(address indexed to, uint256 amount);

    constructor(
        address _usdt,
        address _vyrToken,
        address _presale
    ) Ownable(msg.sender) {
        require(_usdt != address(0) && _vyrToken != address(0) && _presale != address(0), "Zero address");
        usdt = IERC20(_usdt);
        vyrToken = IERC20(_vyrToken);
        presale = IVyronXPresale(_presale);
    }

    // ════════════════════════════════════════════════════════════
    // Referral Registration
    // ════════════════════════════════════════════════════════════

    /// @notice Register a referrer. Can only be called ONCE per buyer, before first purchase.
    /// @param _referrer The wallet address of the person who shared the referral link
    function setReferrer(address _referrer) external {
        require(_referrer != address(0), "Zero referrer");
        require(_referrer != msg.sender, "Cannot refer self");
        require(referrer[msg.sender] == address(0), "Referrer already set");
        referrer[msg.sender] = _referrer;
        emit ReferralRegistered(msg.sender, _referrer);
    }

    // ════════════════════════════════════════════════════════════
    // Buy with Referral Bonus
    // ════════════════════════════════════════════════════════════

    /// @notice Buy VYR tokens via presale with referral bonus.
    ///         Buyer receives 100% normal tokens. Referrer receives 10% EXTRA from reserve.
    /// @param usdtAmount Amount of USDT to spend (18 decimals)
    function buyWithReferral(uint256 usdtAmount) external nonReentrant {
        require(usdtAmount > 0, "Zero amount");

        address ref = referrer[msg.sender];
        require(ref != address(0), "No referrer set");

        // Measure VYR balance before buy
        uint256 balBefore = vyrToken.balanceOf(address(this));

        // Pull USDT from buyer to wrapper
        require(usdt.transferFrom(msg.sender, address(this), usdtAmount), "USDT pull failed");

        // Approve presale to spend our USDT
        require(usdt.approve(address(presale), usdtAmount), "USDT approve failed");

        // Execute buy through presale — tokens arrive at wrapper
        presale.buyWithUsdt(usdtAmount);

        // Measure how many tokens the presale sent us
        uint256 balAfter = vyrToken.balanceOf(address(this));
        uint256 tokensReceived = balAfter - balBefore;
        require(tokensReceived > 0, "No tokens received from presale");

        // Send 100% of purchased tokens to buyer
        require(vyrToken.transfer(msg.sender, tokensReceived), "Buyer transfer failed");

        // Calculate 10% bonus for referrer (from reserve)
        uint256 bonus = (tokensReceived * REFERRAL_BONUS_BPS) / 10000;
        require(vyrToken.balanceOf(address(this)) >= bonus, "Insufficient bonus reserve");
        require(vyrToken.transfer(ref, bonus), "Referrer bonus failed");

        referralEarnings[ref] += bonus;

        emit BoughtWithReferral(msg.sender, usdtAmount, tokensReceived, ref);
        emit ReferralBonusPaid(msg.sender, ref, bonus);
    }

    // ════════════════════════════════════════════════════════════
    // Admin — Reserve Management
    // ════════════════════════════════════════════════════════════

    /// @notice Owner funds the bonus reserve with VYR tokens
    function fundReserve(uint256 amount) external onlyOwner {
        require(vyrToken.transferFrom(msg.sender, address(this), amount), "Fund failed");
        emit ReserveFunded(amount);
    }

    /// @notice Owner withdraws VYR tokens from reserve (e.g. unused bonus tokens)
    function withdrawVYR(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(vyrToken.transfer(to, amount), "Withdraw failed");
        emit ReserveWithdrawn(to, amount);
    }

    /// @notice Owner withdraws any USDT that may be stuck (shouldn't accumulate, safety valve)
    function withdrawUSDT(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(usdt.transfer(to, amount), "USDT withdraw failed");
    }

    // ════════════════════════════════════════════════════════════
    // View Functions
    // ════════════════════════════════════════════════════════════

    /// @notice Get referral info for a user
    function getReferralInfo(address user) external view returns (address ref, uint256 earnings) {
        return (referrer[user], referralEarnings[user]);
    }

    /// @notice Remaining VYR available for paying bonuses
    function reserveBalance() external view returns (uint256) {
        return vyrToken.balanceOf(address(this));
    }
}
