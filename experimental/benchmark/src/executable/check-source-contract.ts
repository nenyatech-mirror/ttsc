import fs from "node:fs";
import path from "node:path";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");
const EXPORT_PATTERN =
  /^export\s+(?:(?:abstract|async|declare)\s+)*(class|const|enum|function|interface|namespace|type)\s+([A-Za-z_$][\w$]*)/gm;
const NAMESPACE_MEMBER_PATTERN =
  /^\s+export\s+(?:(?:abstract|async|declare)\s+)*(class|const|enum|function|interface|namespace|type)\s+([A-Za-z_$][\w$]*)/gm;
const CLASS_PUBLIC_MEMBER_PATTERN =
  /^\s+public\s+(?:(?:abstract|async|readonly|static)\s+)*(constructor|[A-Za-z_$][\w$]*)\s*(?:<[^>{}]*>)?\s*\(/gm;

const files: string[] = collectTypeScriptFiles(SOURCE_ROOT);
const failures: string[] = [];

for (const file of files) {
  const source: string = fs.readFileSync(file, "utf8");
  const exports: { index: number; kind: string; name: string }[] = Array.from(
    source.matchAll(EXPORT_PATTERN),
    (
      match: RegExpMatchArray,
    ): { index: number; kind: string; name: string } => ({
      index: match.index ?? 0,
      kind: match[1]!,
      name: match[2]!,
    }),
  );

  const relative: string = path.relative(SOURCE_ROOT, file);
  const executable: boolean =
    relative === "executable" || relative.startsWith(`executable${path.sep}`);
  if (executable) {
    if (exports.length !== 0)
      failures.push(
        `${relative}: executable entrypoints must not export reusable symbols`,
      );
    continue;
  }
  if (exports.length === 0) {
    failures.push(
      `${relative}: reusable modules outside executable require one exported symbol`,
    );
    continue;
  }

  const names: Set<string> = new Set(exports.map((entry) => entry.name));
  if (names.size !== 1) {
    failures.push(
      `${relative}: expected one exported symbol, found ${[...names].join(", ")}`,
    );
    continue;
  }

  const exported = exports[0]!;
  const filename: string = path.basename(file, ".ts");
  if (filename !== exported.name)
    failures.push(
      `${relative}: filename must equal exported symbol ${exported.name}.ts`,
    );

  if (/^I?TtscBenchmark[A-Za-z0-9_$]*$/.test(exported.name) === false)
    failures.push(
      `${relative}: exported symbol ${exported.name} requires the TtscBenchmark or ITtscBenchmark prefix`,
    );

  for (const declaration of exports) {
    if (
      declaration.kind !== "class" &&
      declaration.kind !== "interface" &&
      declaration.kind !== "namespace"
    )
      failures.push(
        `${relative}: standalone export ${declaration.kind} ${declaration.name} is forbidden; expose executable members through a class or namespace`,
      );

    failures.push(
      ...checkLeadingJsDoc(
        relative,
        source,
        declaration.index,
        declaration.name,
      ),
    );
    if (declaration.kind === "class")
      failures.push(
        ...checkClassPublicMembers(relative, source, declaration.index),
      );
    else if (declaration.kind === "interface")
      failures.push(
        ...checkInterfaceFields(relative, source, declaration.index),
      );
    else if (declaration.kind === "namespace")
      failures.push(
        ...checkNamespaceMembers(relative, source, declaration.index),
      );
  }
}

if (failures.length !== 0) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
} else {
  console.log(
    `Source contract passed for ${files.length} TypeScript files under ${path.relative(process.cwd(), SOURCE_ROOT)}.`,
  );
}

function checkClassPublicMembers(
  relative: string,
  source: string,
  exportIndex: number,
): string[] {
  const openingBrace: number = source.indexOf("{", exportIndex);
  if (openingBrace === -1)
    return [`${relative}: exported class has no opening brace`];
  const closingBrace: number = findClosingBrace(source, openingBrace);
  if (closingBrace === -1)
    return [`${relative}: exported class has no closing brace`];

  const body: string = source.slice(openingBrace + 1, closingBrace);
  const failures: string[] = [];
  for (const match of body.matchAll(CLASS_PUBLIC_MEMBER_PATTERN)) {
    const name: string = match[1]!;
    const index: number = openingBrace + 1 + (match.index ?? 0);
    failures.push(...checkLeadingJsDoc(relative, source, index, name));
  }
  return failures;
}

function checkInterfaceFields(
  relative: string,
  source: string,
  exportIndex: number,
): string[] {
  const openingBrace: number = source.indexOf("{", exportIndex);
  if (openingBrace === -1)
    return [`${relative}: exported interface has no opening brace`];

  const closingBrace: number = findClosingBrace(source, openingBrace);
  if (closingBrace === -1)
    return [`${relative}: exported interface has no closing brace`];

  const lines: string[] = source
    .slice(openingBrace + 1, closingBrace)
    .split(/\r?\n/);
  const failures: string[] = [];
  for (let index: number = 0; index < lines.length; ++index) {
    const line: string = lines[index]!;
    const field: RegExpExecArray | null =
      /^\s+(?:readonly\s+)?([A-Za-z_$][\w$]*|\[[^\]]+\])\??\s*(?::|\()/.exec(
        line,
      );
    if (field === null) continue;

    let previous: number = index - 1;
    while (previous >= 0 && lines[previous]!.trim().length === 0) --previous;
    if (previous < 0 || lines[previous]!.trim().endsWith("*/") === false) {
      failures.push(`${relative}: field ${field[1]} requires leading JSDoc`);
      continue;
    }

    let commentStart: number = previous;
    while (commentStart >= 0 && lines[commentStart]!.includes("/**") === false)
      --commentStart;
    if (commentStart < 0)
      failures.push(`${relative}: field ${field[1]} requires leading JSDoc`);
  }
  return failures;
}

function checkLeadingJsDoc(
  relative: string,
  source: string,
  index: number,
  symbol: string,
): string[] {
  const prefix: string = source.slice(0, index).trimEnd();
  return /\/\*\*[\s\S]*\*\/$/.test(prefix)
    ? []
    : [`${relative}: ${symbol} requires leading JSDoc`];
}

function checkNamespaceMembers(
  relative: string,
  source: string,
  exportIndex: number,
): string[] {
  const openingBrace: number = source.indexOf("{", exportIndex);
  if (openingBrace === -1)
    return [`${relative}: exported namespace has no opening brace`];
  const closingBrace: number = findClosingBrace(source, openingBrace);
  if (closingBrace === -1)
    return [`${relative}: exported namespace has no closing brace`];

  const body: string = source.slice(openingBrace + 1, closingBrace);
  const failures: string[] = [];
  for (const match of body.matchAll(NAMESPACE_MEMBER_PATTERN)) {
    const kind: string = match[1]!;
    const name: string = match[2]!;
    const index: number = openingBrace + 1 + (match.index ?? 0);
    failures.push(...checkLeadingJsDoc(relative, source, index, name));
    if (kind === "interface")
      failures.push(...checkInterfaceFields(relative, source, index));
  }
  return failures;
}

function collectTypeScriptFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry: fs.Dirent): string[] => {
      const target: string = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTypeScriptFiles(target);
      return entry.isFile() && entry.name.endsWith(".ts") ? [target] : [];
    })
    .sort();
}

function findClosingBrace(source: string, openingBrace: number): number {
  let depth: number = 0;
  for (let index: number = openingBrace; index < source.length; ++index) {
    if (source[index] === "{") ++depth;
    else if (source[index] === "}" && --depth === 0) return index;
  }
  return -1;
}
