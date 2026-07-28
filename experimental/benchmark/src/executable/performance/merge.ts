#!/usr/bin/env node

import { TtscBenchmarkPerformanceWebsiteMerger } from "../../performance/TtscBenchmarkPerformanceWebsiteMerger.ts";

await TtscBenchmarkPerformanceWebsiteMerger.main(process.argv.slice(2));
