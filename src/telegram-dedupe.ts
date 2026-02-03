export function createUpdateDeduper(maxSize = 1000) {
  const seen = new Set<number>();
  const order: number[] = [];

  return (updateId?: number) => {
    if (updateId === undefined || updateId === null) return false;
    if (seen.has(updateId)) return true;

    seen.add(updateId);
    order.push(updateId);

    if (order.length > maxSize) {
      const oldest = order.shift();
      if (oldest !== undefined) {
        seen.delete(oldest);
      }
    }

    return false;
  };
}
