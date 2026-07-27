export type GraphBenchmarkPromptFamily = "common" | "dedicated";

export interface IGraphBenchmarkPrompt {
  id: string;
  repo: string;
  family: GraphBenchmarkPromptFamily;
  file: string;
  fixtureBranch?: string;
  tsconfig: string;
  questionSha256: string;
}

export interface IGraphBenchmarkPromptManifest {
  schemaVersion: number;
  prompts: IGraphBenchmarkPrompt[];
}

export interface IResolvedGraphBenchmarkPrompt {
  entry: IGraphBenchmarkPrompt;
  text: string;
  questionSha256: string;
}
