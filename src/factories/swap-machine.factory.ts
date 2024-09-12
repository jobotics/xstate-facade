import { setup, MachineConfig, MachineContext, AnyEventObject } from "xstate";

type MachineSetup<
  TContext extends MachineContext,
  TEvents extends AnyEventObject,
  TInput,
> = ReturnType<any>;

export class SwapMachineFactory<
  TContext extends MachineContext,
  TEvents extends AnyEventObject,
  TInput,
> {
  private machineSetup: MachineSetup<TContext, TEvents, TInput>;
  constructor(setup: MachineSetup<TContext, TEvents, TInput>) {
    this.machineSetup = setup;
  }

  createMachine(definition: MachineConfig<TContext, any, any>) {
    return setup(this.machineSetup).createMachine(definition as any);
  }
}
