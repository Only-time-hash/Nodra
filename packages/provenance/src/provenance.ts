export type CausalEdge = { from: string; to: string; eventId: string; relation: "delegated" | "influenced" | "touched" };

export function traceBlastRadius(origin: string, edges: CausalEdge[]) {
  const affected = new Set([origin]);
  const queue = [origin];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.from === current && !affected.has(edge.to)) {
        affected.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return [...affected];
}
