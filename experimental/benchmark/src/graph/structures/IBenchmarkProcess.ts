import type cp from "node:child_process";

export interface IBenchmarkCommand {
  args: string[];
  command: string;
  label: string;
}

export interface IBenchmarkMcpServer {
  alwaysLoad?: boolean;
  args: string[];
  command: string;
  env?: NodeJS.ProcessEnv;
}

export interface IBenchmarkSpawnOptions extends cp.SpawnOptions {
  input?: string;
  inputDelayMs?: number;
}

export interface IBenchmarkSpawnResult {
  error?: Error;
  signal?: NodeJS.Signals | null;
  status?: number | null;
  stderr: string;
  stdout: string;
}
