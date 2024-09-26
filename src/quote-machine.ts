import { setup, emit, fromPromise, assign } from "xstate";
import {
  SolverQuote,
  StateActionAny,
} from "./interfaces/swap-machine.in.interface";
import { Context, Events, Input } from "./interfaces/swap-machine.ex.interface";
import { IntentProcessorService } from "./services/intent-processor.service";
import { ApiService } from "./services/api.service";

const intentProcessorService = new IntentProcessorService(new ApiService());

export const quoteMachine = setup({
  types: {
    context: {} as Pick<Context, "intent" | "quotes">,
    events: {} as Events,
    input: {} as Input,
  },
  actions: {
    emitSuccessQuoting: emit(({ context }) => ({
      type: "QUOTES_UPDATED",
      data: context.quotes,
    })),
    emitFailerQuoting: emit({
      type: "QUOTES_FETCH_FAILED",
    }),
    updateQuotes: assign({
      quotes: ({ event }) => (event.output as SolverQuote[]) || [],
    }),
    updateIntent: assign({
      intent: ({ event, context }) => ({
        ...context.intent,
        ...(event.data as Partial<Input>),
      }),
    }),
  },
  actors: {
    fetchQuotes: fromPromise(async ({ input }: { input: Partial<Input> }) => {
      return intentProcessorService.fetchQuotes(input).then((data) => data);
    }),
  },
}).createMachine({
  context: ({ input }: { input: Partial<Input> }) => ({
    intent: {
      assetIn: input?.assetIn ?? undefined,
      assetOut: input?.assetOut ?? undefined,
      amountIn: input?.amountIn ?? undefined,
    },
    quotes: [],
  }),
  id: "quote_machine",
  initial: "Quoting",
  states: {
    Quoting: {
      on: {
        SET_PARAMS: {
          actions: "updateIntent",
          target: "Quoting",
          description: "Change quoting params.",
        },
      },
      after: {
        "500": {
          target: "Quoting",
        },
      },
      invoke: {
        id: "fetchQuotes",
        input: ({ context }) => context.intent,
        onDone: {
          actions: [
            { type: "updateQuotes" },
            { type: "emitSuccessQuoting" },
          ] as StateActionAny,
        },
        onError: {
          actions: {
            type: "emitFailerQuoting",
          } as StateActionAny,
        },
        src: "fetchQuotes",
      },
      description:
        "Polling the solver bus and receiving proposals through POST requests. \n\nLater, we plan to switch to two-way communication using WebSockets.\n\nResult:\n\n- Update \\[context\\] with list of quotes;",
    },
  },
});
