import { createHash } from "crypto";
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
