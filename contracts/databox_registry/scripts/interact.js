const hre = require("hardhat");
const fs = require("fs");

async function main() {
  // Read the deployment info
  const deploymentPath = `./deployments/${hre.network.name}.json`;

  if (!fs.existsSync(deploymentPath)) {
    console.error(`No deployment found for network: ${hre.network.name}`);
    console.error(
      `Please deploy the contract first using: npm run deploy:${hre.network.name}`
    );
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contractAddress = deploymentInfo.contractAddress;

  console.log("Interacting with DataBoxRegistry contract at:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("==============================================\n");

  // Get the contract
  const DataBoxRegistry = await hre.ethers.getContractFactory("DataBoxRegistry");
  const dataBoxRegistry = await DataBoxRegistry.attach(contractAddress);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  try {
    // Register upload
    console.log("\nRegistering upload...");
    const uploadTx = await dataBoxRegistry.register_upload(
      "bafkzcibciacdwydlhwglaeicrliqxxywcbrrol63q3ybv55yw7edjylmqq5pumq",
      "Sample data description for indexing",
      1000000, // 1 USDC (6 decimals)
      "0x1234567890123456789012345678901234567890"
    );
    const uploadReceipt = await uploadTx.wait();
    console.log("Transaction hash:", uploadTx.hash);
    console.log("Block number:", uploadReceipt.blockNumber);
    console.log("Events emitted:", uploadReceipt.logs.length);
    console.log("Gas used:", uploadReceipt.gasUsed.toString());

    console.log("\n==============================================");
    console.log("Data registered successfully!");
    console.log("==============================================");
    console.log("\nEvent details:");
    console.log("- PieceCID: bafkzcibciacdwydlhwglaeicrliqxxywcbrrol63q3ybv55yw7edjylmqq5pumq");
    console.log("- Description: Sample data description for indexing");
    console.log("- Price: 1 USDC");
    console.log("- Pay Address: 0x1234567890123456789012345678901234567890");
    console.log("\nThis event can now be indexed by SQD/SubQuery.");
  } catch (error) {
    console.error("\nError during interaction:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
