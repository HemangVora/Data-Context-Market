const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Read the deployment info
  const deploymentPath = `./deployments/${hre.network.name}.json`;

  if (!fs.existsSync(deploymentPath)) {
    console.error(`No deployment found for network: ${hre.network.name}`);
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log("Verifying BAHack contract on BaseScan...");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("==============================================\n");

  try {
    await hre.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [],
    });

    console.log("\n==============================================");
    console.log("Contract verified successfully!");
    console.log(
      "View on BaseScan:",
      `https://sepolia.basescan.org/address/${contractAddress}`
    );
    console.log("==============================================");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("\nContract is already verified!");
      console.log(
        "View on BaseScan:",
        `https://sepolia.basescan.org/address/${contractAddress}`
      );
    } else {
      console.error("\nError verifying contract:", error.message);
      process.exit(1);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
