import "dotenv/config";
import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeFunctionData, parseEventLogs } from "viem";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const AGENT_CARD_URL =
  "https://parallax-agent-production.up.railway.app/.well-known/agent-card.json";

// ABI for the register(string) overload + Registered event
const abi = [
  {
    inputs: [{ internalType: "string", name: "agentURI", type: "string" }],
    name: "register",
    outputs: [{ internalType: "uint256", name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "agentId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string",
        name: "agentURI",
        type: "string",
      },
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "Registered",
    type: "event",
  },
] as const;

async function main() {
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({
    name: "parallax-agent",
  });

  console.log(`\nERC-8004 Agent Registration`);
  console.log(`Registry:  ${IDENTITY_REGISTRY}`);
  console.log(`Network:   Base mainnet`);
  console.log(`Wallet:    ${account.address}`);
  console.log(`Agent URI: ${AGENT_CARD_URL}`);
  console.log(`---`);

  // Encode the register(string) call
  const data = encodeFunctionData({
    abi,
    functionName: "register",
    args: [AGENT_CARD_URL],
  });

  console.log(`Sending registration transaction...`);

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
  console.log(`\nRegistration complete! Your agent is now on-chain via ERC-8004.`);
  console.log(
    `The agentWallet is automatically set to ${account.address}`
  );
}

main().catch((err) => {
  console.error("Registration failed:", err.message || err);
  process.exit(1);
});
