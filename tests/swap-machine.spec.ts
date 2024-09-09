import { describe, it, expect, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import { swapMachine } from "../src";
import { mockInput, mockIntentId, mockQuote } from "../src/mocks/mocks";
import { SwapProgressEnum } from "../src/interfaces/swap-machine.in.interfaces";

describe("swapMachine", () => {
  // Arrange
  const sleep = async (timeout: number) => {
    await new Promise((resolve) => setTimeout(resolve, timeout));
  };

  it("should initialize with Idle state", () => {
    const actor = createActor(swapMachine).start();
    expect(actor.getSnapshot().value).toHaveProperty("Idle");
    actor.stop();
  });

  it("should initialize with default inputs parameters when none provided", () => {
    const actor = createActor(swapMachine).start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intent).toMatchObject({});

    actor.stop();
  });

  it("should initialize with provided inputs and transition through states", async () => {
    const actor = createActor(swapMachine, {
      input: { intentId: mockIntentId },
    }).start();

    await sleep(2000);

    const snapshot = actor.getSnapshot();

    // Check if the intent is initialized
    expect(snapshot.context.intent).toBeDefined();
    expect(snapshot.context.intent.intentId).toBe(mockIntentId);

    // Check if the state is correct
    expect(snapshot.value).toEqual({
      Idle: expect.objectContaining({
        recover: "done",
        quote: "polling",
        input: {},
      }),
    });

    // Check if the intent has been recovered
    expect(snapshot.context.intent.assetIn).toBeDefined();
    expect(snapshot.context.intent.assetOut).toBeDefined();
    expect(snapshot.context.intent.amountIn).toBeDefined();
    expect(snapshot.context.state).toBe(SwapProgressEnum.Confirmed);

    actor.stop();
  });

  it("should handle input and set intent", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Set intent
    actor.send({
      type: "SET_INTENT",
      intent: mockQuote,
    });

    await sleep(2000);

    // Assert: Check context
    const snapshot = actor.getSnapshot();

    expect(snapshot.context.intent).toBeDefined();
    expect(snapshot.context.quotes).toBeInstanceOf(Array);

    if (snapshot.context.quotes.length > 0) {
      expect(snapshot.context.quotes[0]).toHaveProperty("solver_id");
      expect(snapshot.context.quotes[0]).toHaveProperty("amount_out");
    }

    expect(snapshot.context.state).toBe(SwapProgressEnum.Quoted);

    actor.stop();
  });

  it.skip("should fetch quotes and transition to Quoted state", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Start quote fetching
    actor.send({
      type: "FETCH_QUOTE",
      intentId: "0",
    });

    // Assert: Wait for quote to be fetched
    await sleep(200);
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Quoted);

    actor.stop();
  });

  it.skip("should transition to Submitting state on swap submission", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Submit swap
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentId: "0" });

    // Assert: Ensure transition to Submitting state
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Submitting);

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

  it.skip("should periodically refetch quotes", async () => {
    const actor = createActor(swapMachine).start();
    let quoteFoundCount = 0;

    actor.subscribe((state) => {
      if (state.context.intents["0"].state === SwapProgress.Quoted) {
        quoteFoundCount++;
      }
    });

    // Act: Wait for two quote fetch cycles
    await sleep(5500);

    // Assert: Ensure two quote fetches occurred
    expect(quoteFoundCount).toBeGreaterThanOrEqual(2);

    actor.stop();
  }, 6000);
});
