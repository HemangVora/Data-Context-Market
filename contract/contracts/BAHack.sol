// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BAHack
 * @dev Emit events for off-chain indexing (no on-chain storage)
 * @notice This contract emits events for SQD/SubQuery indexing
 */
contract BAHack {
    // Event for upload data
    event DataUploaded(
        string Id,
        string description,
        uint256 priceUSDC,
        string payAddress,
        uint256 timestamp
    );

    /**
     * @dev Upload data and emit event
     * @param _textId unique identifier for the text/data
     * @param _description description of the data
     * @param _priceUSDC price in USDC (6 decimals)
     * @param _payAddress address to receive payment
     */
    function upload(
        string memory _textId,
        string memory _description,
        uint256 _priceUSDC,
        string memory _payAddress
    ) public {
        emit DataUploaded(
            _textId,
            _description,
            _priceUSDC,
            _payAddress,
            block.timestamp
        );
    }
}
