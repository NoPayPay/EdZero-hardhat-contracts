// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockAaveLendingPool {
    IERC20 public immutable usdc;
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public depositTimes;

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    function deposit(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external {
        require(asset == address(usdc), "Only USDC supported");
        usdc.transferFrom(msg.sender, address(this), amount);
        deposits[onBehalfOf] += amount;
        depositTimes[onBehalfOf] = block.timestamp;
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(asset == address(usdc), "Only USDC supported");
        require(deposits[msg.sender] >= amount, "Insufficient balance");
        deposits[msg.sender] -= amount;
        usdc.transfer(to, amount);
        return amount;
    }

    function calculateYield(address user) public view returns (uint256) {
        uint256 principal = deposits[user];
        uint256 timeElapsed = block.timestamp - depositTimes[user];
        uint256 annualYield = (principal * 10) / 100; // 10% annual
        uint256 dailyYield = annualYield / 365;
        return (dailyYield * timeElapsed) / 1 days;
    }

    function distributeYield(address to) external {
        if(deposits[to] <= 0) revert("Insufficient balance");
        uint256 calculatedYield = calculateYield(to);
        if(calculatedYield <= 0) revert("yield is zero");
        usdc.transfer(to, calculatedYield);
    }
}