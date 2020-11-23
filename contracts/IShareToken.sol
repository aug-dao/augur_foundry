pragma solidity =0.6.5;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

interface IShareToken is IERC1155 {
    function claimTradingProceeds(
        address _market,
        address _shareHolder,
        bytes32 _fingerprint
    ) external returns (uint256[] memory _outcomeFees);

    function getTokenId(address _market, uint256 _outcome)
        external
        pure
        returns (uint256 _tokenId);

    function getMarket(uint256 _tokenId)
        external
        view
        returns (address _marketAddress);

    function buyCompleteSets(
        address _market,
        address _account,
        uint256 _amount
    ) external returns (bool);

    function sellCompleteSets(
        address _market,
        address _holder,
        address _recipient,
        uint256 _amount,
        bytes32 _fingerprint
    ) external returns (uint256 _creatorFee, uint256 _reportingFee);
}
