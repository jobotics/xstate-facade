import { setup, StateMachine, AnyEventObject } from "xstate";

type MachineSetup<
  TContext,
  TEvents extends AnyEventObject,
  TInput,
> = ReturnType<
  typeof setup<{
    context: TContext;
    events: TEvents;
    input: TInput;
    actions: Record<string, (...args: any[]) => any>;
    actors: Record<string, (...args: any[]) => Promise<any>>;
  }>
>;

export class SwapMachineFactory<
  TContext,
  TEvents extends AnyEventObject,
  TInput,
> {
  private setup: MachineSetup<TContext, TEvents, TInput>;
  constructor(private setup: MachineSetup<TContext, TEvents, TInput>) {}

  createMachine(definition: StateMachine<TContext, TEvents>) {
    return setup(this.setup).createMachine(definition);
  }
}
