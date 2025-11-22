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
  const deploymentBlock = deploymentInfo.blockNumber;

  console.log("Reading events from BAHack contract...");
  console.log("Contract Address:", contractAddress);
  console.log("Network:", hre.network.name);
  console.log("==============================================\n");

  // Get the contract
  const BAHack = await hre.ethers.getContractFactory("BAHack");
  const baHack = await BAHack.attach(contractAddress);

  // Get current block
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log(
    `Fetching events from block ${deploymentBlock} to ${currentBlock}...\n`
  );

  try {
    // Fetch all events
    const filters = {
      NumberStored: baHack.filters.NumberStored(),
      TextStored: baHack.filters.TextStored(),
      DataStored: baHack.filters.DataStored(),
      BalanceUpdated: baHack.filters.BalanceUpdated(),
      NumberIncremented: baHack.filters.NumberIncremented(),
    };

    let allEvents = [];

    for (const [eventName, filter] of Object.entries(filters)) {
      const events = await baHack.queryFilter(
        filter,
        deploymentBlock,
        currentBlock
      );

      for (const event of events) {
        allEvents.push({
          name: eventName,
          event: event,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
        });
      }
    }

    // Sort by block number
    allEvents.sort((a, b) => a.blockNumber - b.blockNumber);

    if (allEvents.length === 0) {
      console.log(
        "No events found. Try emitting some events using the interact script."
      );
      return;
    }

    console.log(`Found ${allEvents.length} event(s):\n`);
    console.log("==============================================");

    // Display events in a readable format
    for (const item of allEvents) {
      const { name, event, blockNumber, transactionHash } = item;

      console.log(`\n📍 Event: ${name}`);
      console.log(`   Block: ${blockNumber}`);
      console.log(`   Tx: ${transactionHash}`);

      // Decode based on event type
      switch (name) {
        case "NumberStored":
          console.log(`   📊 Number: ${event.args.number.toString()}`);
          console.log(`   👤 By: ${event.args.by}`);
          console.log(
            `   ⏰ Timestamp: ${new Date(
              Number(event.args.timestamp) * 1000
            ).toISOString()}`
          );
          break;

        case "TextStored":
          console.log(`   📝 Text: "${event.args.text}"`);
          console.log(`   👤 By: ${event.args.by}`);
          console.log(
            `   ⏰ Timestamp: ${new Date(
              Number(event.args.timestamp) * 1000
            ).toISOString()}`
          );
          break;

        case "DataStored":
          console.log(`   🔑 Key: "${event.args.key}"`);
          console.log(`   💾 Value: "${event.args.value}"`);
          console.log(`   👤 By: ${event.args.by}`);
          console.log(
            `   ⏰ Timestamp: ${new Date(
              Number(event.args.timestamp) * 1000
            ).toISOString()}`
          );
          break;

        case "BalanceUpdated":
          console.log(`   👤 User: ${event.args.user}`);
          console.log(
            `   💰 Balance: ${hre.ethers.formatEther(event.args.balance)} ETH`
          );
          console.log(`   🔄 Updated By: ${event.args.updatedBy}`);
          console.log(
            `   ⏰ Timestamp: ${new Date(
              Number(event.args.timestamp) * 1000
            ).toISOString()}`
          );
          break;

        case "NumberIncremented":
          console.log(`   📉 Previous: ${event.args.previousValue.toString()}`);
          console.log(`   📈 New Value: ${event.args.newValue.toString()}`);
          console.log(
            `   ➕ Increment: ${event.args.incrementAmount.toString()}`
          );
          console.log(`   👤 By: ${event.args.by}`);
          console.log(
            `   ⏰ Timestamp: ${new Date(
              Number(event.args.timestamp) * 1000
            ).toISOString()}`
          );
          break;
      }

      console.log(
        "   🔗 View on BaseScan:",
        `https://sepolia.basescan.org/tx/${transactionHash}`
      );
      console.log("---");
    }

    console.log("\n==============================================");
    console.log(`Total Events: ${allEvents.length}`);
    console.log("==============================================\n");
  } catch (error) {
    console.error("\nError reading events:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
