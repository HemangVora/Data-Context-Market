// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract SimpleLogger {
    event MessageLogged(
        address indexed sender,
        string message,
        uint256 timestamp
    );
    event CounterIncremented(address indexed sender, uint256 newValue);

    uint256 public counter;

    function log(string calldata message) external {
        emit MessageLogged(msg.sender, message, block.timestamp);
    }

    function increment() external {
        counter++;
        emit CounterIncremented(msg.sender, counter);
    }
}
