import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeFunctionData } from "viem";

const PINATA_API = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_JWT = process.env.PINATA_JWT;

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const AGENT_ID = 17653n;
const AGENT_URL =
  "https://parallax-agent-production.up.railway.app";
const AGENT_WALLET = "0x13bE67822Ea3B51bFa477A6b73DFc2C25D12359A";

const abi = [
  {
    inputs: [
      { internalType: "uint256", name: "agentId", type: "uint256" },
      { internalType: "string", name: "newURI", type: "string" },
    ],
    name: "setAgentURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Same metadata structure as server.ts /.well-known/agent-registration.json
// but with a fixed updatedAt so the content hash is stable
function buildRegistrationMetadata() {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: "Parallax",
    description:
      "x402 intelligence orchestration agent. Chains multiple x402-paid DeFi and market data endpoints into compound intelligence reports. 54 endpoints across 10 providers — DeFi, rug detection, Twitter sentiment, Farcaster social, NFTs, wallet analysis. Standard reports $0.15 USDC, premium deep analysis $1.50 USDC. Pays and receives on Base.",
    image: `${AGENT_URL}/logo.png`,
    agentType: "orchestrator",
    tags: ["defi", "intelligence", "x402", "base", "market-data", "analytics"],
    categories: ["data-analysis", "defi", "research"],
    active: true,
    x402Support: true,
    services: [
      {
        name: "A2A",
        endpoint: `${AGENT_URL}/.well-known/agent-card.json`,
        version: "1.0.0",
        a2aSkills: ["intelligence-report", "deep-intelligence-report"],
      },
      {
        name: "web",
        endpoint: AGENT_URL,
      },
      {
        name: "agentWallet",
        endpoint: `eip155:8453:${AGENT_WALLET}`,
      },
    ],
    registrations: [
      {
        agentId: 17653,
        agentRegistry:
          "eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
      },
    ],
    supportedTrust: ["reputation"],
    updatedAt: 1740528000, // 2025-02-26T00:00:00Z — fixed for content-addressing
  };
}

async function main() {
  if (!PINATA_JWT) {
    console.error("Missing PINATA_JWT env var. Get a free key at https://app.pinata.cloud/developers/api-keys");
    process.exit(1);
  }

  // Step 1: Build metadata
  const metadata = buildRegistrationMetadata();
  console.log("\n1. Built registration metadata");
  console.log(`   Fields: ${Object.keys(metadata).length}`);

  // Step 2: Pin to IPFS via Pinata
  console.log("\n2. Pinning to IPFS via Pinata...");
  const pinResponse = await fetch(PINATA_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: "parallax-agent-registration",
      },
    }),
  });

  if (!pinResponse.ok) {
    const err = await pinResponse.text();
    console.error(`Pinata error (${pinResponse.status}): ${err}`);
    process.exit(1);
  }

  const { IpfsHash: cid } = (await pinResponse.json()) as { IpfsHash: string };
  const ipfsUri = `ipfs://${cid}`;
  const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;

  console.log(`   CID:     ${cid}`);
  console.log(`   IPFS:    ${ipfsUri}`);
  console.log(`   Gateway: ${gatewayUrl}`);

  // Step 3: Update on-chain agentURI to IPFS
  console.log("\n3. Updating on-chain agentURI...");
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({
    name: "parallax-agent",
  });

  console.log(`   Wallet:  ${account.address}`);
  console.log(`   Agent:   #${AGENT_ID}`);
  console.log(`   New URI: ${ipfsUri}`);

  const data = encodeFunctionData({
    abi,
    functionName: "setAgentURI",
    args: [AGENT_ID, ipfsUri],
  });

  const result = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: {
      to: IDENTITY_REGISTRY as `0x${string}`,
      data,
      value: 0n,
    },
    network: "base",
  });

  console.log(`   Tx:      ${result.transactionHash}`);
  console.log(`   Basescan: https://basescan.org/tx/${result.transactionHash}`);

  // Summary
  console.log("\n--- Done ---");
  console.log(`IPFS CID:    ${cid}`);
  console.log(`IPFS URI:    ${ipfsUri}`);
  console.log(`Gateway:     ${gatewayUrl}`);
  console.log(`On-chain tx: https://basescan.org/tx/${result.transactionHash}`);
  console.log(`\nRe-run this script whenever metadata changes to pin a new version.`);
}

main().catch((err) => {
  console.error("Pin metadata failed:", err.message || err);
  process.exit(1);
});
