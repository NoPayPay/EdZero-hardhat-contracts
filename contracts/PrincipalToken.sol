// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract PrincipalToken is ERC20, Ownable {
    address public fundsVault;

    constructor() ERC20("PrincipalToken", "PRT") Ownable(msg.sender){}

    modifier onlyFundsVault() {
        require(msg.sender == fundsVault, "Only FundsVault");
        _;
    }

    function mint(address to, uint256 amount) external onlyFundsVault {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyFundsVault {
        _burn(from, amount);
    }

    function setFundsVault(address _fundsVault) external onlyOwner {
        fundsVault = _fundsVault;
    }

     function decimals() public view override returns(uint8) {
        return 6;
    }
}