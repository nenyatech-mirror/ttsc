export const parseNonNegativeInteger = (
  value: string,
  label: string,
): number => {
  const parsed: number = Number(value);
  if (Number.isInteger(parsed) === false || parsed < 0)
    throw new Error(`${label} must be a non-negative integer`);
  return parsed;
};

export const parsePositiveInteger = (value: string, label: string): number => {
  const parsed: number = parseNonNegativeInteger(value, label);
  if (parsed === 0) throw new Error(`${label} must be greater than zero`);
  return parsed;
};
