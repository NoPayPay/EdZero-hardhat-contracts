// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";


contract Treasury is Ownable {
    IERC20 public usdc;

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    function collectFee(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
    }

    function transferUSDC(address to, uint256 amount) external onlyOwner {
        usdc.transfer(to, amount);
    }

    function distribute(address to, uint256 amount) external onlyOwner {
        usdc.transfer(to, amount);
    }
}