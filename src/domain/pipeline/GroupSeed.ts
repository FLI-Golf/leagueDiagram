export type GroupLineup = {
  teamName: string;
  players: string[];
};

export const GROUP_SCORE_OPTIONS = ['E', '+1', '+2', '+3', '+4', '+5', '+6'];

const hashString = (value: string): number => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0);
};

export const generateGroupScoreSeed = (
  groups: readonly string[],
  lineupsByGroup: Record<string, Array<GroupLineup>>,
  holeCount = 18,
): Record<number, Record<string, string>> => {
  const scoresByHole: Record<number, Record<string, string>> = {};

  groups.forEach((groupName, groupIndex) => {
    const lineups = lineupsByGroup[groupName] ?? [];
    const playerKeys = lineups.flatMap((lineup) =>
      lineup.players.map((player) => `${groupName}|${lineup.teamName}|${player}`),
    );

    for (let holeIndex = 0; holeIndex < holeCount; holeIndex += 1) {
      const holeScores: Record<string, string> = {};

      playerKeys.forEach((playerKey, playerIndex) => {
        const hash = hashString(`${groupName}|${groupIndex}|${holeIndex}|${playerIndex}|${playerKey}`);
        const normalized = (hash % 1000) / 1000;
        const scoreIndex = Math.min(
          GROUP_SCORE_OPTIONS.length - 1,
          Math.floor(normalized * GROUP_SCORE_OPTIONS.length + (groupIndex + 1) * 0.18),
        );

        holeScores[playerKey] = GROUP_SCORE_OPTIONS[scoreIndex];
      });

      scoresByHole[holeIndex] = {
        ...(scoresByHole[holeIndex] ?? {}),
        ...holeScores,
      };
    }
  });

  return scoresByHole;
};
