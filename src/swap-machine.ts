import { assign, fromPromise, emit, createActor } from "xstate";
import { QuoteParams } from "./interfaces/swap-machine.ex.interface";
import { IntentProcessorService } from "./services/intent-processor.service";
import { ApiService } from "./services/api.service";
import {
  Intent,
  SwapProgressEnum,
} from "./interfaces/swap-machine.in.interface";
import { createBrowserInspector } from "@statelyai/inspect";
import { SwapMachineFactory } from "./factories/swap-machine.factory";
import setup from "./setups/base.setup";
import swapMachineDefinition from "./definitions/base.definition";

const factory = new SwapMachineFactory(setup);
const swapMachine = factory.createMachine(swapMachineDefinition);

const isInspectEnabled = process.env.VITE_INSPECT === "true";
if (isInspectEnabled) {
  const { inspect } = createBrowserInspector();
  const actor = createActor(swapMachine, {
    inspect,
  });
  actor.start();
}

export { swapMachine };
