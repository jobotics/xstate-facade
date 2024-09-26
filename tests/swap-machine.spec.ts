import { describe, it, expect, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import { Events, quoteMachine, QuoteParams, swapMachine } from "../src";
import { mockInput, mockQuote, mockQuotes } from "../src/mocks/entity.mock";
import {
  SolverQuote,
  SwapProgressEnum,
} from "../src/interfaces/swap-machine.in.interface";
import { IntentProcessorServiceMock } from "../src/mocks/intent-processor.service.mock";
import { sleep } from "../src/utils/utils";

describe("swapMachine", () => {
  it("should initialize with Idle state", () => {
    const actor = createActor(swapMachine).start();
    expect(actor.getSnapshot().value).toEqual({
      Swapping: "Idle",
    });
    actor.stop();
  });

  it("should initialize with default inputs parameters when none provided", () => {
    const actor = createActor(swapMachine).start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intent).toMatchObject({});
    expect(snapshot.context.quotes).toMatchObject([]);
    expect(snapshot.context.bestQuote).toMatchObject({});

    actor.stop();
  });

  it("should emulate UPDATE_QUOTES from quoteMachine", async () => {
    const intentProcessorServiceMock = new IntentProcessorServiceMock();

    // Create actors for both quoteMachine and swapMachine
    const quoteActor = createActor(
      quoteMachine.provide({
        actors: {
          fetchQuotes: fromPromise(
            async ({ input }: { input: Partial<QuoteParams> }) => {
              return intentProcessorServiceMock.fetchQuotes(input);
            },
          ),
        },
      }),
    ).start();

    const swapActor = createActor(swapMachine).start();

    const subscription = quoteActor.on("QUOTES_UPDATED", (event) => {
      const quotes = (event as Events).data as SolverQuote[];
      if (quotes.length > 0) {
        swapActor.send({
          type: "UPDATE_QUOTES",
          data: quotes,
        });
      }
    });

    // Trigger the quote fetching process
    quoteActor.send({
      type: "SET_PARAMS",
      data: {
        assetIn: mockInput!.assetIn!,
        assetOut: mockInput!.assetOut!,
        amountIn: mockInput!.amountIn!,
      },
    });

    await sleep(500);

    const snapshot = swapActor.getSnapshot();

    // Assertions to verify the quotes are updated in swapMachine
    expect(snapshot.context.quotes).toEqual(expect.any(Array));
    expect(snapshot.context.quotes.length).toBeGreaterThan(0);

    // Cleanup
    subscription.unsubscribe();
    quoteActor.stop();
    swapActor.stop();
  });

  it.skip("should transition to Signing state and prepare message to sign", async () => {
    const intentProcessorServiceMock = new IntentProcessorServiceMock();
    const actor = createActor(swapMachine).start();

    await sleep(0);

    let snapshot = actor.getSnapshot();

    expect(snapshot.context.intent).toBeDefined();
    expect(snapshot.context.intent).toEqual(expect.objectContaining(mockQuote));
    expect(snapshot.value).toEqual({
      Swapping: "Signing",
      Quoting: expect.any(Object),
    });
    expect(snapshot.context.signedMessage).toEqual({
      message: "Login with NEAR",
      recipient: "swap-defuse.near",
      nonce: expect.any(Buffer),
    });

    const signature = "mocked_signature";

    actor.send({
      type: "SUBMIT_SWAP",
      signature,
    });

    snapshot = actor.getSnapshot();

    expect(snapshot.context.signature).toBe(signature);

    expect(snapshot.value).toEqual({
      Swapping: "Broadcasting",
      Quoting: expect.any(Object),
    });

    actor.stop();
  });

  it.skip("should approve quote with signature and transition to Broadcasting state", async () => {
    const intentProcessorServiceMock = new IntentProcessorServiceMock();
    const actor = createActor(
      swapMachine.provide({
        actors: {
          fetchQuotes: fromPromise(
            async ({ input }: { input: Partial<QuoteParams> }) => {
              const quotes =
                await intentProcessorServiceMock.fetchQuotes(input);
              return quotes;
            },
          ),
          signMessage: fromPromise(async ({ input }) => {
            const signedMessage =
              await intentProcessorServiceMock.prepareSignMessage(input);
            return { signature: "mocked_signature", message: signedMessage };
          }),
        },
      }),
      {
        input: mockInput,
      },
    ).start();

    await sleep(0);

    actor.send({
      type: "SUBMIT_SWAP",
    });

    const snapshot = actor.getSnapshot();

    expect(snapshot.context.intent).toBeDefined();
    expect(snapshot.context.intent).toEqual(expect.objectContaining(mockQuote));
    expect(snapshot.value).toEqual({
      Swapping: "Signing",
      Quoting: expect.any(Object),
    });

    expect(snapshot.context.signedMessage).toBeDefined();
    expect(snapshot.context.signedMessage).toEqual({
      message: "Login with NEAR",
      recipient: "swap-defuse.near",
      nonce: expect.any(Buffer),
    });

    actor.stop();
  });

  it.skip("should transition to Submitting state on swap submission", async () => {
    const actor = createActor(swapMachine).start();

    // Set initial intent
    actor.send({
      type: "SET_INTENT",
      intent: mockQuote,
    });

    await sleep(2000);

    // Act: Submit swap
    actor.send({ type: "SUBMIT_SWAP", intent: mockInput });

    // Assert: Ensure transition to Submitting state
    const snapshot = actor.getSnapshot();

    expect(snapshot.context.state).toBe(SwapProgressEnum.Submitting);

    actor.stop();
  });

  it.skip("should handle swap submission failure and retry", async () => {
    let submissionAttempts = 0;
    const actor = createActor(
      swapMachine.provide({
        actors: {
          submitSwap: fromPromise(({ input }) => {
            submissionAttempts++;
            return submissionAttempts === 1
              ? Promise.reject({
                  intentId: input.intent.intentId,
                  result: false,
                })
              : Promise.resolve({
                  intentId: input.intent.intentId,
                  result: true,
                });
          }),
        },
      }),
    ).start();

    // Act: Submit swap and expect failure
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentId: "0" });
    await sleep(200);
    expect(actor.getSnapshot().value).toBe("Failed");

    // Retry submission
    actor.send({ type: "RETRY_INTENT", intentId: "0" });

    // Assert: Ensure transition to Submitting state after retry
    expect(actor.getSnapshot().context.intents["0"].state).toBe(
      SwapProgress.Submitting,
    );

    actor.stop();
  });

  it.skip("should transition to Confirming state after successful submission", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Submit swap
    await sleep(200); // wait for quote
    actor.send({ type: "SUBMIT_SWAP", intentId: "0" });
    await sleep(200); // wait for submission to complete

    // Assert: Transition to Confirming state
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Confirming);

    actor.stop();
  });

  it.skip("should handle swap confirmation failure and retry", async () => {
    let confirmationAttempts = 0;
    const actor = createActor(
      swapMachine.provide({
        actors: {
          confirmSwap: fromPromise(({ input }) => {
            confirmationAttempts++;
            return confirmationAttempts === 1
              ? Promise.reject({ intentId: input.intentId, result: false })
              : Promise.resolve({ intentId: input.intentId, result: true });
          }),
        },
      }),
    ).start();

    // Act: Submit swap and wait for confirmation failure
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentId: "0" });
    await sleep(200);
    expect(actor.getSnapshot().value).toBe("Failed");

    // Retry confirmation
    actor.send({ type: "RETRY_INTENT", intentId: "0" });

    // Assert: Ensure transition to Confirming state after retry
    expect(actor.getSnapshot().context.intents["0"].state).toBe(
      SwapProgress.Submitting,
    );

    actor.stop();
  });

  it.skip("should finalize in Confirmed state", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Submit swap and wait for final confirmation
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentId: "0" });
    await sleep(1500);

    // Assert: Ensure final state is Confirmed
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Confirmed);

    actor.stop();
  });
});
