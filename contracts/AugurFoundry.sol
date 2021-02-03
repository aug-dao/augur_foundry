pragma solidity ^0.6.5;
import './ERC20Wrapper.sol';
import './IShareToken.sol';
import '@opengsn/gsn/contracts/interfaces/IKnowForwarderAddress.sol';
import '@opengsn/gsn/contracts/BaseRelayRecipient.sol';

pragma experimental ABIEncoderV2;

interface IDAILikePermit {
    function nonces(address) external returns (uint256);

    function permit(
        address holder,
        address spender,
        uint256 nonce,
        uint256 expiry,
        bool allowed,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

interface IMarket {
    function getNumTicks() external returns (uint256);
}

/**
 * @dev This is a factory that creates Wrappers around ERC1155 shareTokens generated by Augur
 * @author yashnaman
 * as shares on outcomes of a markets.
 * For every outcome there will be one wrapper.
 */

contract AugurFoundry is
    IKnowForwarderAddress,
    ERC1155Receiver,
    BaseRelayRecipient
{
    using SafeMath for uint256;
    IShareToken public immutable shareToken;
    IERC20 public immutable cash;
    address public immutable augur;

    mapping(uint256 => address) public wrappers;

    event WrapperCreated(uint256 indexed tokenId, address tokenAddress);

    /**@dev sets value for {shareToken} and {cash}
     * @param _shareToken address of shareToken associated with a augur universe
     *@param _cash DAI
     */
    //add trusted forwarder in the constructor and change _msgSender() to _msgSender()
    constructor(
        IShareToken _shareToken,
        IERC20 _cash,
        address _augur,
        address _trustedForwarder
    ) public {
        cash = _cash;
        shareToken = _shareToken;
        augur = _augur;
        trustedForwarder = _trustedForwarder;
        _cash.approve(_augur, uint256(-1));
    }

    function approveCashtoAugur() external {
        cash.approve(address(augur), uint256(-1));
    }

    function getTrustedForwarder() external view override returns (address) {
        return trustedForwarder;
    }

    function versionRecipient() external view override returns (string memory) {
        return '1';
    }

    /**@dev creates new ERC20 wrappers for a outcome of a market
     *@param _tokenId token id associated with a outcome of a market
     *@param _name a descriptive name mentioning market and outcome
     *@param _symbol symbol for the ERC20 wrapper
     *@param decimals decimals for the ERC20 wrapper
     */
    function newERC20Wrapper(
        uint256 _tokenId,
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) public {
        require(wrappers[_tokenId] == address(0), 'Wrapper already created');
        ERC20Wrapper erc20Wrapper =
            new ERC20Wrapper(
                address(this),
                shareToken,
                cash,
                _tokenId,
                _name,
                _symbol,
                _decimals
            );
        wrappers[_tokenId] = address(erc20Wrapper);
        emit WrapperCreated(_tokenId, address(erc20Wrapper));
    }

    /**@dev creates new ERC20 wrappers for multiple _tokenIds*/
    function newERC20Wrappers(
        uint256[] memory _tokenIds,
        string[] memory _names,
        string[] memory _symbols,
        uint8[] memory _decimals
    ) public {
        require(
            _tokenIds.length == _names.length &&
                _tokenIds.length == _symbols.length
        );
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            newERC20Wrapper(_tokenIds[i], _names[i], _symbols[i], _decimals[i]);
        }
    }

    /**@dev A function that wraps ERC1155s shareToken into ERC20s
     * Requirements:
     *
     * -  _msgSender() has setApprovalForAll to this contract
     * @param _tokenId token id associated with a outcome of a market
     * @param _account account the newly minted ERC20s will go to
     * @param _amount  amount of tokens to be wrapped
     */
    function wrapTokens(
        uint256 _tokenId,
        address _account,
        uint256 _amount
    ) public {
        ERC20Wrapper erc20Wrapper = ERC20Wrapper(wrappers[_tokenId]);
        shareToken.safeTransferFrom(
            _msgSender(),
            address(erc20Wrapper),
            _tokenId,
            _amount,
            ''
        );
        erc20Wrapper.wrapTokens(_account, _amount);
    }

    /**@dev wraps multiple tokens */
    function wrapMultipleTokens(
        uint256[] memory _tokenIds,
        address _account,
        uint256[] memory _amounts
    ) public {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            wrapTokens(_tokenIds[i], _account, _amounts[i]);
        }
    }

    /**@dev A function that burns ERC20s and gives back ERC1155s
     * Requirements:
     *
     * - _msgSender() has more than _amount of ERC20 tokens associated with _tokenId.
     * - if the market has finalized then it is  advised that you call claim() on ERC20Wrapper
     * contract associated with the winning outcome
     * @param _tokenId token id associated with a outcome of a market
     * @param _amount amount of tokens to be unwrapped
     * @param _recipient account the ERC1155 will be transferred to
     */
    function unWrapTokens(
        uint256 _tokenId,
        uint256 _amount,
        address _recipient
    ) public {
        ERC20Wrapper erc20Wrapper = ERC20Wrapper(wrappers[_tokenId]);
        erc20Wrapper.unWrapTokens(_msgSender(), _amount, _recipient);
    }

    /**@dev unwraps multiple tokens */
    function unWrapMultipleTokens(
        uint256[] memory _tokenIds,
        uint256[] memory _amounts,
        address _recipient
    ) public {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            unWrapTokens(_tokenIds[i], _amounts[i], _recipient);
        }
    }

    function permit(
        uint256 _expiry,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal {
        uint256 nonce = IDAILikePermit(address(cash)).nonces(_msgSender());
        IDAILikePermit(address(cash)).permit(
            _msgSender(),
            address(this),
            nonce,
            _expiry,
            true,
            _v,
            _r,
            _s
        );
    }

    /**
     * @notice A Helper function to Buy some amount of complete sets for a market with ETH (on Augur ETH)
     ** Requirements:
     *
     * - msg.value should be equal to _amount * numTicks of the _market
     * @param _market The market to purchase complete sets in
     * @param _account The account receiving the complete sets
     * @param _amount The number of complete sets to purchase
     * @return Bool True
     */
    function buyCompleteSets(
        address _market,
        address _account,
        uint256 _amount
    ) public returns (bool) {
        uint256 numTicks = IMarket(_market).getNumTicks();
        require(
            cash.transferFrom(
                _msgSender(),
                address(this),
                _amount.mul(numTicks)
            )
        );
        require(shareToken.buyCompleteSets(_market, _account, _amount));
    }

    /**
     * @notice A Helper function to permit to spend to DAI and Buy some amount of complete sets for a market
     ** Requirements:
     *
     * - msg.value should be equal to _amount * numTicks of the _market
     * @param _market The market to purchase complete sets in
     * @param _account The account receiving the complete sets
     * @param _amount The number of complete sets to purchase
     * @return Bool True
     */
    function PermitAndBuyCompleteSets(
        address _market,
        address _account,
        uint256 _amount,
        uint256 _expiry,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external returns (bool) {
        permit(_expiry, _v, _r, _s);
        buyCompleteSets(_market, _account, _amount);
    }

    function claim(uint256 _tokenId) external {
        ERC20Wrapper erc20Wrapper = ERC20Wrapper(wrappers[_tokenId]);
        erc20Wrapper.claim(_msgSender());
    }

    /**
        @dev Handles the receipt of a single ERC1155 token type. This function is
        called at the end of a `safeTransferFrom` after the balance has been updated.
        To accept the transfer, this must return
        `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))`
        (i.e. 0xf23a6e61, or its own function selector).
        @param operator The address which initiated the transfer (i.e. _msgSender())
        @param from The address which previously owned the token
        @param id The ID of the token being transferred
        @param value The amount of tokens being transferred
        @param data Additional data with no specified format
        @return `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"))` if transfer is allowed
    */
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4) {
        operator;
        from;
        id;
        value;
        data;
        return (
            bytes4(
                keccak256(
                    'onERC1155Received(address,address,uint256,uint256,bytes)'
                )
            )
        );
    }

    /**
        @dev Handles the receipt of a multiple ERC1155 token types. This function
        is called at the end of a `safeBatchTransferFrom` after the balances have
        been updated. To accept the transfer(s), this must return
        `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`
        (i.e. 0xbc197c81, or its own function selector).
        @param operator The address which initiated the batch transfer (i.e. _msgSender())
        @param from The address which previously owned the token
        @param ids An array containing ids of each token being transferred (order and length must match values array)
        @param values An array containing amounts of each token being transferred (order and length must match ids array)
        @param data Additional data with no specified format
        @return `bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))` if transfer is allowed
    */
    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override returns (bytes4) {
        operator;
        from;
        ids;
        values;
        data;
        return
            bytes4(
                keccak256(
                    'onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)'
                )
            );
    }
}
