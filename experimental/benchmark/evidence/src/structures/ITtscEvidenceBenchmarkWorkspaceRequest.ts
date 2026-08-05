import type { EvidenceBenchmarkArm } from "../typings/EvidenceBenchmarkArm";
import type { ITtscEvidenceBenchmarkWorkspaceArtifact } from "./ITtscEvidenceBenchmarkWorkspaceArtifact";
import type { ITtscEvidenceBenchmarkWorkspaceVariables } from "./ITtscEvidenceBenchmarkWorkspaceVariables";

/**
 * Frozen inputs used to materialize one benchmark workspace.
 *
 * The request selects opaque requirements and one arm overlay while keeping
 * neutral template variables identical across a comparable pair.
 */
export interface ITtscEvidenceBenchmarkWorkspaceRequest {
  /** Benchmark repository containing templates and requirements. */
  repository: string;

  /** Final ignored run directory. */
  output: string;

  /** Selected opaque requirements directory name. */
  project: string;

  /** Selected Evidence or Plain treatment. */
  arm: EvidenceBenchmarkArm;

  /** Neutral template substitutions shared by both arms. */
  variables: ITtscEvidenceBenchmarkWorkspaceVariables;

  /** Evidence package archive, required only by the Evidence arm. */
  artifact?: ITtscEvidenceBenchmarkWorkspaceArtifact;
}
