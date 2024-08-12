import { describe, it, expect } from "vitest";
import { createActor, fromPromise } from "xstate";
import { swapMachine, SwapProgress } from "./swap-machine";

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

  it("should set intent context correctly", () => {
    const actor = createActor(swapMachine).start();

    // Act: Set intent
    actor.send({
      type: "SET_INTENT",
      intent: {
        intentID: "1",
        assetIn: "ETH",
        assetOut: "USDT",
        amountIn: "0.5",
        initiator: "user.near",
      },
    });

    // Assert: Check context
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.current).toBe("1");
    expect(snapshot.context.intents["1"]).toEqual({
      intentID: "1",
      assetIn: "ETH",
      assetOut: "USDT",
      amountIn: "0.5",
      initiator: "user.near",
    });

    actor.stop();
  });

  it("should fetch quotes and transition to Quoted state", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Start quote fetching
    actor.send({
      type: "FETCH_QUOTE",
      intentID: "0",
    });

    // Assert: Wait for quote to be fetched
    await sleep(200);
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Quoted);

    actor.stop();
  });

  it("should periodically refetch quotes", async () => {
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

  it("should refetch quotes on failure", async () => {
    const actor = createActor(
      swapMachine.provide({
        actors: {
          fetchQuotes: fromPromise(() => Promise.reject({ result: false })),
        },
      }),
    ).start();

    let pollingCount = 0;

    actor.subscribe((state) => {
      if (state.context.intents["0"].state === SwapProgress.FetchingQuote) {
        pollingCount++;
      }
    });

    // Act: Wait for a polling cycle
    await sleep(750);

    // Assert: Ensure polling reoccurred after failure
    expect(pollingCount).toBeGreaterThanOrEqual(1);

    actor.stop();
  });

  it("should transition to Submitting state on swap submission", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Submit swap
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentID: "0" });

    // Assert: Ensure transition to Submitting state
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Submitting);

    actor.stop();
  });

  it("should handle swap submission failure and retry", async () => {
    let submissionAttempts = 0;
    const actor = createActor(
      swapMachine.provide({
        actors: {
          submitSwap: fromPromise(({ input }) => {
            submissionAttempts++;
            return submissionAttempts === 1
              ? Promise.reject({
                  intentID: input.intent.intentID,
                  result: false,
                })
              : Promise.resolve({
                  intentID: input.intent.intentID,
                  result: true,
                });
          }),
        },
      }),
    ).start();

    // Act: Submit swap and expect failure
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentID: "0" });
    await sleep(200);
    expect(actor.getSnapshot().value).toBe("Failed");

    // Retry submission
    actor.send({ type: "RETRY_INTENT", intentID: "0" });

    // Assert: Ensure transition to Submitting state after retry
    expect(actor.getSnapshot().context.intents["0"].state).toBe(
      SwapProgress.Submitting,
    );

    actor.stop();
  });

  it("should transition to Confirming state after successful submission", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Submit swap
    await sleep(200); // wait for quote
    actor.send({ type: "SUBMIT_SWAP", intentID: "0" });
    await sleep(200); // wait for submission to complete

    // Assert: Transition to Confirming state
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Confirming);

    actor.stop();
  });

  it("should handle swap confirmation failure and retry", async () => {
    let confirmationAttempts = 0;
    const actor = createActor(
      swapMachine.provide({
        actors: {
          confirmSwap: fromPromise(({ input }) => {
            confirmationAttempts++;
            return confirmationAttempts === 1
              ? Promise.reject({ intentID: input.intentID, result: false })
              : Promise.resolve({ intentID: input.intentID, result: true });
          }),
        },
      }),
    ).start();

    // Act: Submit swap and wait for confirmation failure
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentID: "0" });
    await sleep(200);
    expect(actor.getSnapshot().value).toBe("Failed");

    // Retry confirmation
    actor.send({ type: "RETRY_INTENT", intentID: "0" });

    // Assert: Ensure transition to Confirming state after retry
    expect(actor.getSnapshot().context.intents["0"].state).toBe(
      SwapProgress.Submitting,
    );

    actor.stop();
  });

  it("should finalize in Confirmed state", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Submit swap and wait for final confirmation
    await sleep(200);
    actor.send({ type: "SUBMIT_SWAP", intentID: "0" });
    await sleep(1500);

    // Assert: Ensure final state is Confirmed
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intents["0"].state).toBe(SwapProgress.Confirmed);

    actor.stop();
  });
});
