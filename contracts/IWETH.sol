pragma solidity ^0.6.2;

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;

    function approve(address _spender, uint256 _value)
        external
        returns (bool success);

    function balanceOf(address _owner) external view returns (uint256 balance);
}
