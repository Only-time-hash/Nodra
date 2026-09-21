export type ContainmentTarget = { id: string; status: "healthy" | "at-risk" | "quarantined"; delegatedAuthority: boolean };
export type ContainmentResult = { targets: ContainmentTarget[]; revoked: string[]; preserved: string[] };

export function quarantineBranch(targets: ContainmentTarget[], originId: string): ContainmentResult {
  const affected = new Set(
    targets
      .filter((target) => target.id === originId || target.status === "at-risk" || target.status === "quarantined")
      .map((target) => target.id),
  );

  return {
    targets: targets.map((target) =>
      affected.has(target.id)
        ? { ...target, status: "quarantined", delegatedAuthority: false }
        : target,
    ),
    revoked: targets.filter((target) => affected.has(target.id)).map((target) => target.id),
    preserved: targets.filter((target) => !affected.has(target.id)).map((target) => target.id),
  };
}
