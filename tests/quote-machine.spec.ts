import { describe, it, expect } from "vitest";
import { createActor, fromPromise } from "xstate";
import { QuoteParams, quoteMachine } from "../src";
import { mockInput } from "../src/mocks/entity.mock";
import { IntentProcessorServiceMock } from "../src/mocks/intent-processor.service.mock";
import { sleep } from "../src/utils/utils";

describe("quoteMachine", () => {
  it("should initialize with Quoting state", () => {
    const actor = createActor(quoteMachine).start();
    expect(actor.getSnapshot().value).toEqual("Quoting");
    actor.stop();
  });

  it("should initialize with default inputs parameters when none provided", () => {
    const actor = createActor(quoteMachine).start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.intent).toMatchObject({});
    expect(snapshot.context.quotes).toMatchObject([]);

    actor.stop();
  });

  it("should initialize with provided inputs and update context with list of quotes", async () => {
    const intentProcessorServiceMock = new IntentProcessorServiceMock();
    const actor = createActor(
      quoteMachine.provide({
        actors: {
          fetchQuotes: fromPromise(
            async ({ input }: { input: Partial<QuoteParams> }) =>
              await intentProcessorServiceMock.fetchQuotes(input),
          ),
        },
      }),
      {
        input: mockInput,
      },
    ).start();

    await sleep(0);

    const snapshot = actor.getSnapshot();

    expect(snapshot.context.intent).toBeDefined();
    expect(snapshot.context.quotes).toBeInstanceOf(Array);

    if (snapshot.context.quotes.length > 0) {
      expect(snapshot.context.quotes[0]).toHaveProperty("query_id");
      expect(snapshot.context.quotes[0]).toHaveProperty("tokens");
    }

    actor.stop();
  });

  it("should initialize without provided inputs and update context with SET_PARAMS event", () => {
    const actor = createActor(quoteMachine).start();
    let snapshot = actor.getSnapshot();

    expect(snapshot.matches("Quoting")).toBe(true);
    expect(snapshot.context.intent).toEqual({
      amountIn: undefined,
      assetIn: undefined,
      assetOut: undefined,
    });

    actor.send({
      type: "SET_PARAMS",
      data: {
        assetIn: mockInput!.assetIn!,
        assetOut: mockInput!.assetOut!,
        amountIn: mockInput!.amountIn!,
      },
    });

    snapshot = actor.getSnapshot();
    expect(snapshot.context.intent).toEqual({
      assetIn: mockInput.assetIn,
      assetOut: mockInput.assetOut,
      amountIn: mockInput.amountIn,
    });
  });

  it("should transition states correctly", async () => {
    const intentProcessorServiceMock = new IntentProcessorServiceMock();
    const actor = createActor(
      quoteMachine.provide({
        actors: {
          fetchQuotes: fromPromise(
            async ({ input }: { input: Partial<QuoteParams> }) =>
              await intentProcessorServiceMock.fetchQuotes(input),
          ),
        },
      }),
      {
        input: mockInput,
      },
    ).start();

    // Initial state should be "Quoting"
    let snapshot = actor.getSnapshot();
    expect(snapshot.value).toEqual("Quoting");

    // Send SET_PARAMS event
    actor.send({
      type: "SET_PARAMS",
      data: {
        assetIn: mockInput!.assetIn!,
        assetOut: mockInput!.assetOut!,
        amountIn: mockInput!.amountIn!,
      },
    });

    // Wait for the state to update
    await sleep(500);

    // Check if the state has changed
    snapshot = actor.getSnapshot();
    console.log("Current state:", snapshot.value);
    expect(snapshot.value).toEqual("Quoting");

    // Check if the context has been updated
    expect(snapshot.context.intent).toEqual({
      assetIn: mockInput.assetIn,
      assetOut: mockInput.assetOut,
      amountIn: mockInput.amountIn,
    });

    actor.stop();
  });
});
