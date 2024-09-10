import { createHash } from "crypto";
import { ParseDefuseAssetResult } from "src/interfaces/swap-machine.in.interfaces";
import { v4 as uuidv4 } from "uuid";

export async function sleep(timeout: number) {
  await new Promise((resolve) => setTimeout(resolve, timeout));
}

export function sha256(msg: string) {
  return createHash("sha256").update(msg).digest("hex");
}

export function generateIntentId(): string {
  return sha256(uuidv4());
}

export default function parseDefuseAsset(
  defuseAssetId: string,
): ParseDefuseAssetResult {
  try {
    const [blockchain, network, contractId] = defuseAssetId.split(":");
    return {
      blockchain,
      network,
      contractId,
    };
  } catch (e) {
    console.error("Failed to parse defuse asset id", e);
    return null;
  }
}
