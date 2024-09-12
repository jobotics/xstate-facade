import { createActor } from "xstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { SwapMachineFactory } from "./factories/swap-machine.factory";
import setup from "./setups/base.setup";
import swapMachineDefinition from "./definitions/base.definition";
import { MachineConfig } from "xstate";

// Assuming SwapContext and SwapEvent are your actual types
type SwapContext = any; // Replace with your actual context type
type SwapEvent = any; // Replace with your actual event type

const factory = new SwapMachineFactory(setup);
const swapMachine = factory.createMachine(
  swapMachineDefinition as MachineConfig<SwapContext, any, SwapEvent>,
);

const isInspectEnabled = process.env.VITE_INSPECT === "true";
if (isInspectEnabled) {
  const { inspect } = createBrowserInspector();
  const actor = createActor(swapMachine, {
    inspect,
  });
  actor.start();
}

export { swapMachine };
