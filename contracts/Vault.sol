// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MockAaveLendingPool } from "./MockAavePool.sol";
import { PrincipalToken } from "./PrincipalToken.sol";
import { YieldToken } from "./YieldToken.sol";
import { Treasury } from "./Treasury.sol";

contract FundsVault is Ownable {
    IERC20 private immutable usdc;
    MockAaveLendingPool private aavePool;
    PrincipalToken private principalToken;
    YieldToken private yieldToken;
    Treasury private treasury;

    mapping(address user => uint256 amount) public userDeposits; 
    mapping(address user => mapping(address token => uint256 amount)) private tokenLockPeriod;
    mapping(address => uint256) public depositTimes;
    mapping(address => bool) public fundsClaimed;

    constructor(
       InitialSetup memory initialParams
    ) Ownable(initialParams._initialOwner) {
        usdc = IERC20(initialParams._usdc);
        aavePool = MockAaveLendingPool(initialParams._aavePool);
        treasury = Treasury(initialParams._treasury);
        principalToken = PrincipalToken(initialParams._principalToken);
        yieldToken = YieldToken(initialParams._yieldToken);
    }

    // --------------------------------------- EVENTS --------------------------------------
    event Deposited(uint256 depositedAmount, address depositor);
    event YieldHarvested(uint256 yieldAmount);
    event PrincipalWithdrew(uint256 amount, address recipient);
    event Transfer(address indexed from_, address indexed to_, uint256 indexed amount_);

    struct InitialSetup {
        address _initialOwner;
        address _usdc;
        address _aavePool;
        address _treasury;
        address _principalToken;
        address _yieldToken;
    }

    function deposit(uint256 amount, uint256 lockPeriod) external {
        if(usdc.balanceOf(msg.sender) <= 0 || usdc.balanceOf(msg.sender) < amount ) revert("Not Enough to deposit");
        if(amount <= 0) revert("Insufficient funds");
        usdc.transferFrom(msg.sender, address(this), amount);
        principalToken.mint(msg.sender, amount);
        // why does only 10% of the deposited amount is minted to the user ???
        yieldToken.mint(msg.sender, amount * 10 / 100); // 10% of deposit
        // approving mock aave pool to pull the funds
        usdc.approve(address(aavePool), amount);
        aavePool.deposit(address(usdc), amount, address(this), 0);
        emit Deposited(amount, msg.sender);

        depositTimes[msg.sender] = block.timestamp;
        userDeposits[msg.sender] += amount;
        tokenLockPeriod[msg.sender][address(usdc)] = lockPeriod;
        fundsClaimed[msg.sender] = false;
    }

    /**
     * @dev harvesting yield from the pool
     */
    function harvestYield() external onlyOwner returns(uint256) {
        // this function should be call by user not owner
        uint256 yieldAmount;
        unchecked {
            yieldAmount = aavePool.calculateYield(address(this));
        }
        // 10% of farmed yield goes to the platform, rest go to the user and paid merchant
        require(yieldAmount > 0, "No yield available");
        // either one of these functions could be commented out
        aavePool.distributeYield(address(this));
        emit YieldHarvested(yieldAmount);

        usdc.approve(address(treasury), yieldAmount);
        treasury.collectFee(yieldAmount);
        return yieldAmount;
    }

       /**
     * @dev user selling their YT for a token (USDT, DAI, USDC), this contract must holds some amount of the sellFor token.
     * @param amount - an amount to sell or burn
     * @param sellFor - a token user will get in return for selling their YT
     */
    function sellYieldTokensForTokens(uint256 amount, address sellFor) external {
        require(IERC20(address(yieldToken)).balanceOf(msg.sender) >= amount, "Insufficient YLD");
        uint256 userShares = (amount * 80) / 100; // 80% of YIELD TOKEN goes to the user, 20% to the PLATFORM
        uint256 platformShares = amount - userShares;
        yieldToken.burnFrom(msg.sender, amount); // Burning all the yield tokens
        // sending 80% of user shares to the user.
        IERC20(sellFor).transfer(msg.sender, amount);
        emit Transfer(msg.sender, address(0), userShares); 
    }

    /**
     * @dev user withdrawing their principal assets from the pool goes directly to the user
     */
    function withdrawPrincipal(uint256 wdAmount) external {
        uint256 lockPeriod = tokenLockPeriod[msg.sender][address(usdc)];
        require(
            block.timestamp >= (depositTimes[msg.sender] + lockPeriod),
            "90-day lockup not completed"
        );
        require(!fundsClaimed[msg.sender], "Already claimed");

        uint256 principalAmount = principalToken.balanceOf(msg.sender);
        require(principalAmount > 0, "No principal to withdraw");
        if(wdAmount > principalAmount) revert("Insufficients PT");

        principalToken.burn(msg.sender, wdAmount);
        userDeposits[msg.sender] -= wdAmount;
        aavePool.withdraw(address(usdc), principalAmount, msg.sender);
        emit PrincipalWithdrew(principalAmount, msg.sender);
        fundsClaimed[msg.sender] = true;
    }

    /**
     * @dev getting user funds back from the pool goes into treasury
     * @param user - user address
     */
    function claimFunds(address user) external onlyOwner returns(uint256 claimedAmount) {
        uint256 lockPeriod = tokenLockPeriod[user][address(usdc)];
        require(
            block.timestamp <= (depositTimes[user] + lockPeriod),
            "Lockup period expired"
        );
        require(!fundsClaimed[user], "Already claimed");

        uint256 amount = principalToken.balanceOf(user);
        require(amount > 0, "No funds to claim");

        principalToken.burn(user, amount);
        aavePool.withdraw(address(usdc), amount, address(treasury));
        emit PrincipalWithdrew(amount, address(treasury));
        fundsClaimed[user] = true;
        claimedAmount = amount;
    }

    /**
     * @dev depositing an initial funds into this contract, only owner can call this function
     * @param amount - an amount to deposit
     */
    function depositInitialFunds(uint256 amount) external onlyOwner returns(uint256 depositedAmount) {
        usdc.transferFrom(msg.sender, address(this), amount);
    }

    /**
     * @dev pay the purchasing item by user, only allow user to pay the merchant if their deposited amount are greather than the amount to pay the merchant. 
     * @param amountToPay_ - an amount to pay
     * @param merchant - a merchant wallet 
     */
    function payMerchant(uint256 amountToPay_, address merchant) external returns(uint256 paidAmount) {
        uint256 ytBalance = IERC20(address(yieldToken)).balanceOf(msg.sender);
        // user should not be allowed to purchase any merchant more than the amount they have deposited to keep protocol stable
        if(amountToPay_ >= ytBalance) revert("Insufficient funds to cover the payment");
        yieldToken.burnFrom(msg.sender, amountToPay_);
        bool isPaid = usdc.transfer(merchant, amountToPay_);
        if(!isPaid) revert("payment failed");
    }

    function getLockPeriod(address user) public view returns(uint256) {
        uint256 lockupPeriod = tokenLockPeriod[user][address(usdc)];
        return lockupPeriod; 
    }

    function getHoldings(address user) public view returns(uint256, uint256) {
         uint256 yt = IERC20(address(yieldToken)).balanceOf(user);
         uint256 pt = IERC20(address(principalToken)).balanceOf(user);
         return (yt, pt);
    }

    function getCurrentAPY() public pure returns(uint256) {
        return 10; // represents 10%
    }
}