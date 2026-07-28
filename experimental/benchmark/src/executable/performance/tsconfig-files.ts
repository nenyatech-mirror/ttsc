#!/usr/bin/env node

import { TtscBenchmarkPerformanceTypeScriptFileSelector } from "../../performance/TtscBenchmarkPerformanceTypeScriptFileSelector.ts";

await TtscBenchmarkPerformanceTypeScriptFileSelector.main(
  import.meta.dirname,
  process.argv.slice(2),
);
