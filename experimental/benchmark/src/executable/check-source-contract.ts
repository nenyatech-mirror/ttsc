import { TtscBenchmarkSourceContract } from "../TtscBenchmarkSourceContract.ts";

TtscBenchmarkSourceContract.main(
  process.getBuiltinModule("node:path").resolve(import.meta.dirname, ".."),
);
