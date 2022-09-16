// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20{

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_){}

    function mint(address _account, uint256 _amount) public{
        _mint(_account, _amount);        
    }
}