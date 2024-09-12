import { assign, fromPromise, emit, createActor } from "xstate";
import {
  Context,
  Events,
  Input,
  Quote,
  QuoteParams,
} from "../interfaces/swap-machine.ex.interface";
import { IntentProcessorService } from "../services/intent-processor.service";
import { ApiService } from "../services/api.service";
import {
  Intent,
  SwapProgressEnum,
} from "../interfaces/swap-machine.in.interface";

const intentProcessorService = new IntentProcessorService(new ApiService());

export default {
  types: {} as {
    context: Context;
    events: Events;
    input: Input | { intentId: string };
    output: {
      quotes: Quote[];
    };
  },
  actions: {
    // Events actions
    emitQuotingEvent: emit(({ context }) => ({
      type: "FETCH_QUOTE_SUCCESS",
      data: context.output,
    })),
    // Error actions
    // Context actions
    updateIntent: assign({
      intent: (
        context: { intent: Intent },
        params: { intent: Partial<Intent> },
      ) => ({
        ...context.intent,
        ...params.intent,
      }),
    }),
    progressIntent: assign({
      intent: (
        context: { intent: Intent },
        event: { output: { state: SwapProgressEnum } },
      ) => ({
        ...context.intent,
        state: SwapProgressEnum.Confirming,
      }),
    }),
    failIntent: assign({
      intent: (context: { intent: Intent }) => ({
        ...context.intent,
        state: SwapProgressEnum.Failed,
      }),
    }),
    recoveringIntent: assign({
      intent: (
        context: { intent: Intent; event: { output: { intent: Intent } } },
        event: { output: { intent: Intent } },
      ) => {
        if (context.event?.output) {
          return context.event.output.intent;
        }
        return context.intent; // Fallback to current intent if no output
      },
      state: (context: {
        intent: Intent;
        event: { output: { state: SwapProgressEnum } };
      }) => {
        return context.event?.output?.state;
      },
    }),
    updateCallData: assign({
      intent: (
        context: { intent: Intent },
        event: { output: { callData: string } },
      ) => ({
        ...context.intent,
        callData: event?.output?.callData || null, // Use optional chaining and provide a fallback
      }),
    }),
  },
  actors: {
    recoverIntent: fromPromise(
      ({ input }: { input: Pick<Intent, "intentId"> }) =>
        intentProcessorService.initialize(input.intentId).then((data) => data),
    ),
    fetchQuotes: fromPromise(({ input }: { input: QuoteParams }) =>
      intentProcessorService
        .fetchQuotes(input)
        .then((data) => ({ quotes: data })),
    ),
    submitSwap: fromPromise(({ input }: { input: { intent: Input } }) =>
      intentProcessorService
        .prepareSwapCallData(input.intent)
        .then((callData) => ({
          callData,
        })),
    ),
    fetchIntent: fromPromise(({ input }: { input: { intentId: string } }) =>
      intentProcessorService.fetchIntent(input.intentId).then((data) => data),
    ),
  },
  guards: {
    hasValidForRecovering: ({ context }: { context: { intent: Intent } }) =>
      !!context.intent.intentId,
    hasValidForQuoting: ({ context }: { context: { intent: Intent } }) => {
      const intent = context.intent;
      return !!(intent?.assetIn && intent?.assetOut && intent?.amountIn);
    },
    hasValidForSubmitting: ({
      event,
    }: {
      event: { intent: Intent & { accountId: string } };
    }) => {
      const intent = event.intent;
      return !!(
        intent?.assetIn &&
        intent?.assetOut &&
        intent?.amountIn &&
        intent?.amountOut &&
        intent?.accountId
      );
    },
    hasValidForSwapping: ({ event }: { event: { hash: string } }) => {
      const hash = event.hash;
      return !!hash;
    },
  },
};
