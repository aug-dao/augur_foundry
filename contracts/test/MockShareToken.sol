pragma solidity =0.6.5;
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "../IWETH.sol";

//Made specifically for the unit tests
contract MockShareToken is ERC1155 {
    IWETH wETH;
    uint256 public constant amount = 1 ether;
    uint256 public constant tokenId = 1;
    uint256[] outcomeFees = [1, 2, 3];

    constructor(string memory _uri, address _wETH) public ERC1155(_uri) {
        wETH = IWETH(_wETH);
    }

    function mint(
        address _account,
        uint256 _tokenId,
        uint256 _amount
    ) public {
        _mint(_account, _tokenId, _amount, "");
    }

    function getMarket(uint256 _tokenId) external pure returns (address) {
        return address(0);
    }

    //make sure you have transferred enough weth to this contract before calling this function
    //(before calling claim function on erc20Wrapper)
    function claimTradingProceeds(
        address _market,
        address _shareHolder,
        bytes32 _fingerprint
    ) external returns (uint256[] memory _outcomeFees) {
        _burn(msg.sender, tokenId, balanceOf(msg.sender, tokenId));
        wETH.transfer(msg.sender, amount);
        return outcomeFees;
    }
}
