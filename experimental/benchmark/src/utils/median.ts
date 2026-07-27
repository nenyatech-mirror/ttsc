export const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted: number[] = [...values].sort((x, y) => x - y);
  const middle: number = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
