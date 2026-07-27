export interface ICommandLineArguments {
  values: Record<string, string>;
  flags: Set<string>;
  positional: string[];
}

export interface ICommandLineArgumentOptions {
  repeatable?: readonly string[];
  values?: readonly string[];
}

export const parseCommandLineArguments = (
  arguments_: readonly string[],
  options: ICommandLineArgumentOptions = {},
): ICommandLineArguments => {
  const repeatable: Set<string> = new Set(options.repeatable ?? []);
  const valueOptions: Set<string> = new Set(options.values ?? []);
  const output: ICommandLineArguments = {
    values: {},
    flags: new Set<string>(),
    positional: [],
  };
  for (let index: number = 0; index < arguments_.length; ++index) {
    const argument: string = arguments_[index]!;
    if (argument.startsWith("--") === false) {
      output.positional.push(argument);
      continue;
    }
    const equals: number = argument.indexOf("=");
    if (equals !== -1) {
      assignValue(
        output.values,
        argument.slice(2, equals),
        argument.slice(equals + 1),
        repeatable,
      );
      continue;
    }
    const name: string = argument.slice(2);
    if (valueOptions.has(name) === true) {
      const value: string | undefined = arguments_[++index];
      if (value === undefined) throw new Error(`${argument} requires a value`);
      assignValue(output.values, name, value, repeatable);
    } else {
      output.flags.add(argument);
    }
  }
  return output;
};

export const parseKeyValueArguments = (
  arguments_: readonly string[],
): Record<string, string> =>
  Object.fromEntries(
    arguments_.flatMap((argument: string): [string, string][] => {
      const match: RegExpExecArray | null = /^--([^=]+)=(.*)$/.exec(argument);
      return match === null ? [] : [[match[1]!, match[2]!]];
    }),
  );

export const splitCommaSeparated = (value: string): string[] =>
  value
    .split(",")
    .map((entry: string): string => entry.trim())
    .filter((entry: string): boolean => entry.length !== 0);

const assignValue = (
  values: Record<string, string>,
  name: string,
  value: string,
  repeatable: ReadonlySet<string>,
): void => {
  values[name] =
    repeatable.has(name) === true && values[name] !== undefined
      ? `${values[name]},${value}`
      : value;
};
