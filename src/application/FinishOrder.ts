export const areAllGroupsApproved = (
  groupLabels: readonly string[],
  approvedGroups: Record<string, boolean>,
): boolean => {
  return groupLabels.length > 0 && groupLabels.every((groupName) => Boolean(approvedGroups[groupName]));
};

export const normalizeFinishOrder = (groupLabels: readonly string[], finishOrder: readonly string[]): string[] => {
  const seen = new Set<string>();
  const ordered = finishOrder.filter((groupName) => groupLabels.includes(groupName) && !seen.has(groupName) && seen.add(groupName));
  const missing = groupLabels.filter((groupName) => !ordered.includes(groupName));
  return [...ordered, ...missing];
};

export const getTeamFinishOrderFromGroups = (
  groupLabels: readonly string[],
  finishOrder: readonly string[],
  groupsByLabel: Record<string, Array<{ teamName: string; players: string[] }>>,
): string[] => {
  return normalizeFinishOrder(groupLabels, finishOrder).flatMap((groupName) => {
    return (groupsByLabel[groupName] ?? []).map((entry) => entry.teamName);
  });
};

export const sortTeamsByScore = <T extends { teamName: string; score: number; playoffDistance?: number; tieBreakIndex?: number }>(teams: readonly T[]): T[] => {
  return [...teams].sort((left, right) => {
    const scoreDelta = left.score - right.score;
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const playoffDelta = (left.playoffDistance ?? Number.POSITIVE_INFINITY) - (right.playoffDistance ?? Number.POSITIVE_INFINITY);
    if (playoffDelta !== 0) {
      return playoffDelta;
    }

    const tieBreakDelta = (left.tieBreakIndex ?? 0) - (right.tieBreakIndex ?? 0);
    if (tieBreakDelta !== 0) {
      return tieBreakDelta;
    }

    return left.teamName.localeCompare(right.teamName);
  });
};
