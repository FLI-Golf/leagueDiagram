export type GroupScorecardPlayer = {
  player: string;
  teamName: string;
  holeScores: Array<{ hole: number; value: string; relativeToPar: number; displayValue: string }>;
  totalRelativeToPar: number;
  displayTotal: string;
};

export type GroupScorecardLineup = {
  teamName: string;
  players: string[];
};

const parseRelativeToPar = (rawValue: string | undefined): number => {
  const sanitized = String(rawValue ?? '+3').trim();

  if (!sanitized || sanitized === 'E') {
    return 0;
  }

  if (/^[-+]?\d+$/.test(sanitized)) {
    return Number.parseInt(sanitized, 10) - 3;
  }

  return 0;
};

export const buildGroupScorecard = (
  groupName: string,
  lineups: readonly GroupScorecardLineup[],
  holeScoresByIndex: Record<number, Record<string, string>>,
): GroupScorecardPlayer[] => {
  const rows: GroupScorecardPlayer[] = [];

  for (const lineup of lineups) {
    for (const player of lineup.players) {
      const key = `${groupName}|${lineup.teamName}|${player}`;
      const holeScores = Array.from({ length: 18 }, (_, holeIndex) => {
        const rawValue = holeScoresByIndex[holeIndex]?.[key] ?? '+3';
        const normalizedValue = /^[-+]?\d+$/.test(String(rawValue)) ? String(rawValue) : '+3';
        const relativeToPar = parseRelativeToPar(normalizedValue);

        return {
          hole: holeIndex + 1,
          value: normalizedValue,
          relativeToPar,
          displayValue: relativeToPar === 0 ? 'E' : `${relativeToPar > 0 ? '+' : ''}${relativeToPar}`,
        };
      });

      const totalRelativeToPar = holeScores.reduce((sum, entry) => sum + entry.relativeToPar, 0);
      const displayTotal = totalRelativeToPar === 0 ? 'E' : `${totalRelativeToPar > 0 ? '+' : ''}${totalRelativeToPar}`;

      rows.push({
        player,
        teamName: lineup.teamName,
        holeScores,
        totalRelativeToPar,
        displayTotal,
      });
    }
  }

  return rows;
};
