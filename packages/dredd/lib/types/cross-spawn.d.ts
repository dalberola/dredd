// Ambient declaration for the `cross-spawn` package (v7), which ships no types
// and has no `@types/cross-spawn` on npm. Dredd uses only `crossSpawn.spawn`,
// a cross-platform replacement for `child_process.spawn`.
declare module 'cross-spawn' {
  import { ChildProcess, SpawnOptions } from 'child_process';

  function spawn(
    command: string,
    args?: readonly string[],
    options?: SpawnOptions,
  ): ChildProcess;

  namespace spawn {
    function spawn(
      command: string,
      args?: readonly string[],
      options?: SpawnOptions,
    ): ChildProcess;
  }

  export = spawn;
}
