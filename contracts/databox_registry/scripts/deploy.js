const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying DataBoxRegistry contract...");

  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get account balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  // Deploy the DataBoxRegistry contract
  const DataBoxRegistry = await hre.ethers.getContractFactory("DataBoxRegistry");
  const dataBoxRegistry = await DataBoxRegistry.deploy();

  await dataBoxRegistry.waitForDeployment();

  const contractAddress = await dataBoxRegistry.getAddress();
  console.log("DataBoxRegistry contract deployed to:", contractAddress);

  // Wait for a few block confirmations
  console.log("Waiting for block confirmations...");
  await dataBoxRegistry.deploymentTransaction().wait(5);

  console.log("\n==============================================");
  console.log("Deployment Summary:");
  console.log("==============================================");
  console.log("Contract Address:", contractAddress);
  console.log("Deployer Address:", deployer.address);
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", hre.network.config.chainId);
  console.log("==============================================");

  // Verify on BaseScan if not on local network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\nVerifying contract on BaseScan...");
    console.log("Please wait for verification to complete...");

    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("Contract verified successfully!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract is already verified!");
      } else {
        console.log("Error verifying contract:", error.message);
        console.log("You can verify manually later with:");
        console.log(
          `npx hardhat verify --network ${hre.network.name} ${contractAddress}`
        );
      }
    }
  }

  // Save deployment info to a file
  const deploymentInfo = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    contractAddress: contractAddress,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: await hre.ethers.provider.getBlockNumber(),
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  fs.writeFileSync(
    `${deploymentsDir}/${hre.network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(
    `\nDeployment info saved to ${deploymentsDir}/${hre.network.name}.json`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
