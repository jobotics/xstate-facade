import { describe, it, expect, vi } from "vitest";
import { createActor, fromPromise } from "xstate";
import { swapMachine } from "../src";
import { mockInput, mockIntentId, mockQuote } from "../src/mocks/mocks";
import { SwapProgressEnum } from "../src/interfaces/swap-machine.in.interfaces";
import { IntentProcessorServiceMock } from "../src/mocks/intent-processor.service.mock";
import { sleep } from "../src/utils/utils";

describe("swapMachine", () => {
  it.skip("should initialize with Loading state", () => {
    const actor = createActor(swapMachine).start();
    expect(actor.getSnapshot().value).toHaveProperty("Loading");
    actor.stop();
  });

  it.skip("should initialize with default inputs parameters when none provided", () => {
    const actor = createActor(swapMachine).start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intent).toMatchObject({});

    actor.stop();
  });

  it.skip("should initialize with provided inputs and transition through states", async () => {
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

  it.skip("should handle input and set intent", async () => {
    const actor = createActor(swapMachine).start();

    // Act: Set intent
    actor.send({
      type: "SET_INTENT",
      intent: mockQuote,
    });

    // Assert: Check context
    const snapshot = actor.getSnapshot();

    expect(snapshot.context.intent).toBeDefined();
    expect(snapshot.context.intent).toEqual(expect.objectContaining(mockQuote));
    expect(snapshot.context.state).toBe(SwapProgressEnum.Idle);

    actor.stop();
  });

  it.skip("should fetch quotes and transition to Quoted state", async () => {
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

  it.skip("should periodically refetch quotes and update amount_out", async () => {
    const mockQuoteService =
      new IntentProcessorServiceMock().fetchQuotesAndEmulatePolling(1000);
    const actor = createActor(
      swapMachine.provide({
        actors: {
          fetchQuotes: mockQuoteService,
        },
      }),
    ).start();
    const quoteResults: string[] = [];

    // Set initial intent
    actor.send({
      type: "SET_INTENT",
      intent: mockQuote,
    });

    // Subscribe to state changes
    actor.subscribe((state) => {
      if (state.context.quotes.length > 0) {
        quoteResults.push(state.context.quotes[0].amount_out);
        console.log("New quote received:", state.context.quotes[0].amount_out);
      }
    });

    // Wait for 3 unique quotes or a maximum of 6 polling cycles
    console.log("Waiting for quotes...");
    for (let i = 0; i < 6; i++) {
      await sleep(5000);
      console.log(
        `Waited ${(i + 1) * 5} seconds. Quotes received: ${quoteResults.length}`,
      );

      // Check if we have 3 unique quotes
      const uniqueQuotes = [...new Set(quoteResults)];
      if (uniqueQuotes.length >= 3) {
        break;
      }
    }

    // Filter out duplicate quotes
    const uniqueQuotes = quoteResults.filter(
      (quote, index, self) => index === 0 || quote !== self[index - 1],
    );

    // Check if we have at least 3 unique quotes
    expect(uniqueQuotes.length).toBeGreaterThanOrEqual(3);

    // Check if the unique quotes are increasing
    for (let i = 1; i < uniqueQuotes.length; i++) {
      expect(parseInt(uniqueQuotes[i])).toBeGreaterThan(
        parseInt(uniqueQuotes[i - 1]),
      );
    }

    actor.stop();
  }, 35000); // Keep the timeout at 35 seconds for safety

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
