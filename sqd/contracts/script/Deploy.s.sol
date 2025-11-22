// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/MultiLogger.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        MultiLogger logger = new MultiLogger();

        console.log("MultiLogger deployed at:", address(logger));

        vm.stopBroadcast();
    }
}
