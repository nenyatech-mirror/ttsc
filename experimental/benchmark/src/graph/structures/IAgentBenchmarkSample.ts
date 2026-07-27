export type AgentBenchmarkArm = "baseline" | "graph";

export type AgentBenchmarkMetric = "cost" | "durMs" | "tokens" | "tools";

export interface IAgentBenchmarkUsage {
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
}

export interface IAgentBenchmarkSample {
  tokens: number;
  cached?: number;
  reasoning?: number;
  tokensWithReasoning?: number;
  turns?: number;
  usage?: IAgentBenchmarkUsage[];
  tools: number;
  reads?: number;
  grep?: number;
  shell: number;
  web: number;
  graph: number;
  other?: number;
  sourceTouches?: number;
  shellSource?: number;
  shellCommands: string[];
  types?: Record<string, number>;
  cost?: number;
  durMs: number;
  modelVersion?: string;
  ok: boolean;
  answer: string;
  error: string;
  promptId?: string;
  questionSha256?: string;
  run?: number;
  attempts?: number;
}
