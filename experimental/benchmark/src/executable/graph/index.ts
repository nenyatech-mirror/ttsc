#!/usr/bin/env node
import { TtscBenchmarkGraphRunner } from "../../graph/TtscBenchmarkGraphRunner.ts";

await TtscBenchmarkGraphRunner.main(import.meta.dirname);
