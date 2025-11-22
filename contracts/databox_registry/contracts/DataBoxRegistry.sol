// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DataBoxRegistry
 * @dev Registry for Filecoin data with pricing information
 * @notice Stores and retrieves data metadata including description, price, and payment address
 */
contract DataBoxRegistry {
    // Struct to store data information
    struct DataInfo {
        string description;
        uint256 priceUSDC;
        string payAddress;
        uint256 timestamp;
    }

    // Mapping from PieceCID to DataInfo
    mapping(string => DataInfo) public dataRegistry;

    // Event for upload data
    event DataUploaded(
        string indexed pieceCid,
        string description,
        uint256 priceUSDC,
        string payAddress,
        uint256 timestamp
    );

    /**
     * @dev Register data and store in mapping
     * @param _pieceCid unique PieceCID identifier from Filecoin
     * @param _description description of the data
     * @param _priceUSDC price in USDC (6 decimals)
     * @param _payAddress address to receive payment
     */
    function register_upload(
        string memory _pieceCid,
        string memory _description,
        uint256 _priceUSDC,
        string memory _payAddress
    ) public {
        // Check if data already exists
        require(
            bytes(dataRegistry[_pieceCid].description).length == 0,
            "Data with this PieceCID already registered"
        );

        // Store data in mapping
        dataRegistry[_pieceCid] = DataInfo({
            description: _description,
            priceUSDC: _priceUSDC,
            payAddress: _payAddress,
            timestamp: block.timestamp
        });

        // Emit event for off-chain indexing
        emit DataUploaded(
            _pieceCid,
            _description,
            _priceUSDC,
            _payAddress,
            block.timestamp
        );
    }

    /**
     * @dev Get data information by PieceCID
     * @param _pieceCid the PieceCID to look up
     * @return description description of the data
     * @return priceUSDC price in USDC (6 decimals)
     * @return payAddress address to receive payment
     * @return timestamp when the data was registered
     */
    function getData(string memory _pieceCid)
        public
        view
        returns (
            string memory description,
            uint256 priceUSDC,
            string memory payAddress,
            uint256 timestamp
        )
    {
        DataInfo memory data = dataRegistry[_pieceCid];
        require(
            bytes(data.description).length > 0,
            "Data with this PieceCID not found"
        );

        return (
            data.description,
            data.priceUSDC,
            data.payAddress,
            data.timestamp
        );
    }

    /**
     * @dev Check if a PieceCID is registered
     * @param _pieceCid the PieceCID to check
     * @return true if registered, false otherwise
     */
    function isRegistered(string memory _pieceCid) public view returns (bool) {
        return bytes(dataRegistry[_pieceCid].description).length > 0;
    }
}
