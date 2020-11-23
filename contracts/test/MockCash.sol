pragma solidity =0.6.5;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCash is ERC20 {
    constructor() public ERC20("Cash", "CASH") {}

    function mint(address _account, uint256 _amount) public {
        _mint(_account, _amount);
    }
}
