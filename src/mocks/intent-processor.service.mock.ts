import { fromPromise } from "xstate";

export class IntentProcessorServiceMock {
  fetchQuotesAndEmulatePolling(pollingInterval: number) {
    let callCount = 0;
    return fromPromise(({ input }) => {
      callCount++;
      console.log(`Quote service called ${callCount} times`);
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            quotes: [
              {
                solver_id: "mock_solver",
                amount_out: (1000 + callCount * 100).toString(),
              },
            ],
          });
        }, pollingInterval);
      });
    });
  }
}
