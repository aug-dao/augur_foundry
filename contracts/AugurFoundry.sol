pragma solidity ^0.6.5;
import './ERC20Wrapper.sol';
import './IShareToken.sol';

pragma experimental ABIEncoderV2;

/**
 * @dev This is a factory that creates Wrappers around ERC1155 shareTokens generated by Augur
 * @author yashnaman
 * as shares on outcomes of a markets.
 * For every outcome there will be one wrapper.
 */
contract AugurFoundry is ERC1155Receiver, Context {
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
        address _augur
    ) public {
        cash = _cash;
        shareToken = _shareToken;
        augur = _augur;
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

    //TODO: Add permit + mint function
    //TODO: Add permit + mint + wrap function

    //mintWrap with the abilty to mint complete sets and wrap only some of them

    function mintAndWrap(
        uint256[] memory _tokenIds,
        uint256[] memory _wrappingAmounts,
        address _market,
        uint256 _numTicks,
        uint256 _mintAmount,
        address _account
    ) public {
        require(
            cash.transferFrom(
                _msgSender(),
                address(this),
                _mintAmount.sub(_numTicks)
            )
        );

        cash.approve(augur, _mintAmount.sub(_numTicks));
        shareToken.buyCompleteSets(_market, address(this), _mintAmount);

        //recreating the wrapMultiple tokens but the tokens are taken from address(this)
        // wrapMultipleTokens(_tokenIds, _account, _wrappingAmounts);
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            ERC20Wrapper erc20Wrapper = ERC20Wrapper(wrappers[_tokenIds[i]]);
            shareToken.safeTransferFrom(
                address(this),
                address(erc20Wrapper),
                _tokenIds[i],
                _wrappingAmounts[i],
                ''
            );
            erc20Wrapper.wrapTokens(_account, _wrappingAmounts[i]);
            if (_wrappingAmounts[i] < _mintAmount) {
                shareToken.safeTransferFrom(
                    address(this),
                    _msgSender(),
                    _tokenIds[i],
                    _wrappingAmounts[i].sub(_mintAmount),
                    ''
                );
            }
        }
    }

    function unWrapAndRedeem(
        uint256[] memory _tokenIds,
        address _market,
        address _recipient,
        uint256 _amount,
        bytes32 _fingerprint
    ) public {
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            unWrapTokens(_tokenIds[i], _amount, address(this));
        }
        shareToken.sellCompleteSets(
            _market,
            address(this),
            _recipient,
            _amount,
            _fingerprint
        );
    }

    //TODO: add unwrap and redeem with option for partial unwrap

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
        return
            bytes4(
                keccak256(
                    'onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)'
                )
            );
    }
}
