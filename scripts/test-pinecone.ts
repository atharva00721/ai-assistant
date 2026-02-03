import { describePineconeIndexStats } from "../src/pinecone-client.js";

async function main() {
  console.log("Testing Pinecone connection...");

  try {
    const stats = await describePineconeIndexStats();
    console.log("✅ Pinecone connection OK. Index stats:");
    console.dir(stats, { depth: null });
  } catch (error) {
    console.error("❌ Pinecone connection failed.");
    console.error(error);
    process.exitCode = 1;
  }
}

await main();

