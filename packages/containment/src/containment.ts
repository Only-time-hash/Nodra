export type ContainmentTarget = { id: string; status: "healthy" | "at-risk" | "quarantined"; delegatedAuthority: boolean };
export type ContainmentResult = { targets: ContainmentTarget[]; revoked: string[]; preserved: string[] };

export function quarantineBranch(targets: ContainmentTarget[], originId: string): ContainmentResult {
  return {
    targets: targets.map((target) => target.id === originId ? { ...target, status: "quarantined", delegatedAuthority: false } : target),
    revoked: [originId],
    preserved: targets.filter((target) => target.id !== originId).map((target) => target.id),
  };
}
