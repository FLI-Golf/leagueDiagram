export type FantasyRosterEntry = { participantId: string; playerNames: readonly string[] };

export type FantasyStanding = {
  participantId: string;
  total: number;
  scoredPlayers: number;
  missingPlayers: readonly string[];
};

// Fantasy totals are derived from confirmed event scores, so nothing counts until an admin approves the round.
export class FantasyScoring {
  static scoreEvent(
    rosters: readonly FantasyRosterEntry[],
    confirmedScores: ReadonlyMap<string, number>,
  ): readonly FantasyStanding[] {
    return FantasyScoring.rank(
      rosters.map((roster) => {
        const scored = roster.playerNames.filter((name) => confirmedScores.has(name));
        const missing = roster.playerNames.filter((name) => !confirmedScores.has(name));

        return {
          participantId: roster.participantId,
          total: scored.reduce((sum, name) => sum + (confirmedScores.get(name) ?? 0), 0),
          scoredPlayers: scored.length,
          missingPlayers: missing,
        };
      }),
    );
  }

  static scoreSeason(
    rosters: readonly FantasyRosterEntry[],
    confirmedEvents: readonly ReadonlyMap<string, number>[],
  ): readonly FantasyStanding[] {
    const totals = new Map<string, FantasyStanding>();

    confirmedEvents.forEach((event) => {
      FantasyScoring.scoreEvent(rosters, event).forEach((standing) => {
        const running = totals.get(standing.participantId);
        totals.set(standing.participantId, {
          participantId: standing.participantId,
          total: (running?.total ?? 0) + standing.total,
          scoredPlayers: (running?.scoredPlayers ?? 0) + standing.scoredPlayers,
          missingPlayers: standing.missingPlayers,
        });
      });
    });

    const seeded = rosters.map(
      (roster) =>
        totals.get(roster.participantId) ?? {
          participantId: roster.participantId,
          total: 0,
          scoredPlayers: 0,
          missingPlayers: roster.playerNames,
        },
    );

    return FantasyScoring.rank(seeded);
  }

  // Lower relative-to-par wins, matching the league scorecard.
  private static rank(standings: readonly FantasyStanding[]): readonly FantasyStanding[] {
    return [...standings].sort((left, right) => left.total - right.total || left.participantId.localeCompare(right.participantId));
  }
}
