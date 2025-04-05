// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "MUSD") {
        _mint(msg.sender, 1_000_000 * 1e6); // Mint 1 juta USDC dengan 6 decimal
    }

    function decimals() public view override returns(uint8) {
        return 6;
    }
}