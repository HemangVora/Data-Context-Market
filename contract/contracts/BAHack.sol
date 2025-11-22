// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BAHack
 * @dev Emit events for off-chain indexing (no on-chain storage)
 * @notice This contract emits events for SQD/SubQuery indexing
 */
contract BAHack {
    // Events - these will be indexed by SQD
    event NumberStored(
        uint256 indexed number,
        address indexed by,
        uint256 timestamp
    );
    
    event TextStored(
        string text,
        address indexed by,
        uint256 timestamp
    );
    
    event DataStored(
        string key,
        string value,
        address indexed by,
        uint256 timestamp
    );
    
    event BalanceUpdated(
        address indexed user,
        uint256 balance,
        address indexed updatedBy,
        uint256 timestamp
    );
    
    event NumberIncremented(
        uint256 indexed previousValue,
        uint256 indexed newValue,
        uint256 incrementAmount,
        address indexed by,
        uint256 timestamp
    );
    
    /**
     * @dev Emit an event with a number value
     * @param _number value to emit
     */
    function storeNumber(uint256 _number) public {
        emit NumberStored(_number, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Emit an event with a text value
     * @param _text value to emit
     */
    function storeText(string memory _text) public {
        emit TextStored(_text, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Emit an event with a key-value pair
     * @param _key key to emit
     * @param _value value to emit
     */
    function storeData(string memory _key, string memory _value) public {
        emit DataStored(_key, _value, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Emit an event with balance update
     * @param _user address of the user
     * @param _balance new balance value
     */
    function updateBalance(address _user, uint256 _balance) public {
        emit BalanceUpdated(_user, _balance, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Emit an event for number increment
     * @param _previousValue the previous value
     * @param _incrementAmount value to add
     */
    function incrementNumber(uint256 _previousValue, uint256 _incrementAmount) public {
        uint256 newValue = _previousValue + _incrementAmount;
        emit NumberIncremented(
            _previousValue,
            newValue,
            _incrementAmount,
            msg.sender,
            block.timestamp
        );
    }
    
    /**
     * @dev Emit multiple data entries in a single transaction (batch operation)
     * @param _keys array of keys
     * @param _values array of values
     */
    function batchStoreData(
        string[] memory _keys,
        string[] memory _values
    ) public {
        require(_keys.length == _values.length, "Keys and values length mismatch");
        
        for (uint256 i = 0; i < _keys.length; i++) {
            emit DataStored(_keys[i], _values[i], msg.sender, block.timestamp);
        }
    }
    
    /**
     * @dev Emit multiple balance updates in a single transaction (batch operation)
     * @param _users array of user addresses
     * @param _balances array of balance values
     */
    function batchUpdateBalances(
        address[] memory _users,
        uint256[] memory _balances
    ) public {
        require(_users.length == _balances.length, "Users and balances length mismatch");
        
        for (uint256 i = 0; i < _users.length; i++) {
            emit BalanceUpdated(_users[i], _balances[i], msg.sender, block.timestamp);
        }
    }
}

