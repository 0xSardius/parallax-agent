import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeFunctionData } from "viem";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const AGENT_REGISTRATION_URL =
  "https://parallax-agent-production.up.railway.app/.well-known/agent-registration.json";
const AGENT_ID = 17653n;

const abi = [
  {
    inputs: [{ internalType: "string", name: "agentURI", type: "string" }],
    name: "register",
    outputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
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

const command = process.argv[2]; // "register" or "update-uri"

async function main() {
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({
    name: "parallax-agent",
  });

  console.log(`\nERC-8004 Agent Identity`);
  console.log(`Registry:  ${IDENTITY_REGISTRY}`);
  console.log(`Network:   Base mainnet`);
  console.log(`Wallet:    ${account.address}`);
  console.log(`Agent URI: ${AGENT_REGISTRATION_URL}`);
  console.log(`---`);

  let data: `0x${string}`;

  if (command === "update-uri") {
    console.log(`Updating agentURI for agent #${AGENT_ID}...`);
    data = encodeFunctionData({
      abi,
      functionName: "setAgentURI",
      args: [AGENT_ID, AGENT_REGISTRATION_URL],
    });
  } else {
    console.log(`Registering new agent...`);
    data = encodeFunctionData({
      abi,
      functionName: "register",
      args: [AGENT_REGISTRATION_URL],
    });
  }

  const result = await cdp.evm.sendTransaction({
    address: account.address,
    transaction: {
      to: IDENTITY_REGISTRY as `0x${string}`,
      data,
      value: 0n,
    },
    network: "base",
  });

  console.log(`Transaction hash: ${result.transactionHash}`);
  console.log(
    `Basescan: https://basescan.org/tx/${result.transactionHash}`
  );

  if (command === "update-uri") {
    console.log(`\nAgent URI updated on-chain!`);
  } else {
    console.log(`\nRegistration complete! Agent is now on-chain via ERC-8004.`);
    console.log(
      `The agentWallet is automatically set to ${account.address}`
    );
  }
}

main().catch((err) => {
  console.error("ERC-8004 operation failed:", err.message || err);
  process.exit(1);
});
