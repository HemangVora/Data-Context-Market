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

  console.log("Interacting with BAHack contract at:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("==============================================\n");

  // Get the contract
  const BAHack = await hre.ethers.getContractFactory("BAHack");
  const baHack = await BAHack.attach(contractAddress);

  // Get the signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Using account:", signer.address);

  try {
    // // Example 1: Emit a number event
    // console.log("\n1. Emitting NumberStored event...");
    // const numberTx = await baHack.storeNumber(42);
    // const numberReceipt = await numberTx.wait();
    // console.log("Transaction hash:", numberTx.hash);
    // console.log("Block number:", numberReceipt.blockNumber);
    // console.log("Gas used:", numberReceipt.gasUsed.toString());

    // // Example 2: Emit a text event
    // console.log("\n2. Emitting TextStored event...");
    // const textTx = await baHack.storeText("Hello, Base Sepolia!");
    // const textReceipt = await textTx.wait();
    // console.log("Transaction hash:", textTx.hash);
    // console.log("Block number:", textReceipt.blockNumber);
    // console.log("Gas used:", textReceipt.gasUsed.toString());

    // // Example 3: Emit a key-value data event
    // console.log("\n3. Emitting DataStored event...");
    // const dataTx = await baHack.storeData("projectName", "BA-hack");
    // const dataReceipt = await dataTx.wait();
    // console.log("Transaction hash:", dataTx.hash);
    // console.log("Block number:", dataReceipt.blockNumber);
    // console.log("Gas used:", dataReceipt.gasUsed.toString());

    // // Example 4: Emit a balance update event
    // console.log("\n4. Emitting BalanceUpdated event...");
    // const balanceTx = await baHack.updateBalance(
    //   signer.address,
    //   hre.ethers.parseEther("10.5")
    // );
    // const balanceReceipt = await balanceTx.wait();
    // console.log("Transaction hash:", balanceTx.hash);
    // console.log("Block number:", balanceReceipt.blockNumber);
    // console.log("Gas used:", balanceReceipt.gasUsed.toString());

    // // Example 5: Emit an increment event
    // console.log("\n5. Emitting NumberIncremented event...");
    // const incrementTx = await baHack.incrementNumber(42, 8);
    // const incrementReceipt = await incrementTx.wait();
    // console.log("Transaction hash:", incrementTx.hash);
    // console.log("Block number:", incrementReceipt.blockNumber);
    // console.log("Gas used:", incrementReceipt.gasUsed.toString());

    // // Example 6: Batch emit data events
    console.log("\n6. Emitting multiple DataStored events (batch)...");
    const batchDataTx = await baHack.batchStoreData(
      ["key1", "key2", "key3"],
      ["value1", "value2", "value3"]
    );
    const batchDataReceipt = await batchDataTx.wait();
    console.log("Transaction hash:", batchDataTx.hash);
    console.log("Block number:", batchDataReceipt.blockNumber);
    console.log("Events emitted:", batchDataReceipt.logs.length);
    console.log("Gas used:", batchDataReceipt.gasUsed.toString());

    console.log("\n==============================================");
    console.log("All events emitted successfully!");
    console.log("==============================================");
    console.log("\nThese events can now be indexed by SQD/SubQuery.");
    console.log("View your transactions on BaseScan to see the events.");
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
