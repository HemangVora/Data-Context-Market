// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MultiLogger {
    // Different event types for various actions
    event MessageLogged(
        address indexed sender,
        string message,
        uint256 timestamp
    );
    event CounterIncremented(address indexed sender, uint256 newValue);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Deposit(address indexed user, uint256 amount, uint256 balance);
    event Withdrawal(address indexed user, uint256 amount, uint256 balance);

    uint256 public counter;
    mapping(address => uint256) public balances;

    function log(string calldata message) external {
        emit MessageLogged(msg.sender, message, block.timestamp);
    }

    function increment() external {
        counter++;
        emit CounterIncremented(msg.sender, counter);
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value, balances[msg.sender]);
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount, balances[msg.sender]);
    }

    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}
