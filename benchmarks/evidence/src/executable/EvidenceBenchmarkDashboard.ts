import path from "node:path";

import { renderEvidenceBenchmarkDashboard } from "../EvidenceBenchmarkDashboard";
import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";

const repository: string = EvidenceBenchmarkLayout.repositoryRoot;
process.stdout.write(renderEvidenceBenchmarkDashboard(repository));
