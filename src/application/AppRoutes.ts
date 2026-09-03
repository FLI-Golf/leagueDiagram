import type { RealisticLeagueSeed } from './SeasonService';

type AppRoute =
  | { kind: 'home' }
  | { kind: 'diagram'; view: string }
  | { kind: 'teams' }
  | { kind: 'team-detail'; teamId: string }
  | { kind: 'pros' }
  | { kind: 'pro-detail'; playerId: string };

export function resolveAppRoute(pathname = window.location.pathname): AppRoute {
  const normalized = pathname === '/' ? '/' : pathname;

  if (normalized === '/') {
    return { kind: 'home' };
  }

  if (normalized === '/diagram') {
    return { kind: 'diagram', view: 'overview' };
  }

  const diagramView = /^\/diagram\/([^/]+)$/.exec(normalized);
  if (diagramView) {
    return { kind: 'diagram', view: diagramView[1] };
  }

  if (normalized === '/teams') {
    return { kind: 'teams' };
  }

  const teamDetail = /^\/teams\/([^/]+)$/.exec(normalized);
  if (teamDetail) {
    return { kind: 'team-detail', teamId: teamDetail[1] };
  }

  if (normalized === '/pros') {
    return { kind: 'pros' };
  }

  const proDetail = /^\/pros\/([^/]+)$/.exec(normalized);
  if (proDetail) {
    return { kind: 'pro-detail', playerId: proDetail[1] };
  }

  return { kind: 'home' };
}

export function getTeamSummaries(seed: RealisticLeagueSeed) {
  return seed.realLeagueTeams.map((team, teamIndex) => ({
    id: team.id,
    name: team.name,
    teamNumber: teamIndex + 1,
    players: [
      {
        id: team.malePlayer.id,
        displayName: team.malePlayer.displayName,
        gender: team.malePlayer.gender,
        email: team.malePlayer.email,
        routeId: `pro-${teamIndex * 2 + 1}`,
      },
      {
        id: team.femalePlayer.id,
        displayName: team.femalePlayer.displayName,
        gender: team.femalePlayer.gender,
        email: team.femalePlayer.email,
        routeId: `pro-${teamIndex * 2 + 2}`,
      },
    ],
  }));
}

export function getProPlayers(seed: RealisticLeagueSeed) {
  const activePlayers = getTeamSummaries(seed).flatMap((team) =>
    team.players.map((player) => ({
      id: player.id,
      routeId: player.routeId,
      displayName: player.displayName,
      gender: player.gender,
      email: player.email,
      teamId: team.id,
      teamName: team.name,
    })),
  );

  const reservePlayers = (seed.reservePros ?? []).map((player) => ({
    id: player.id,
    routeId: player.id,
    displayName: player.displayName,
    gender: player.gender,
    email: player.email,
    teamId: 'reserve-roster',
    teamName: 'Reserve pros',
    reason: player.reason,
  }));

  return [...activePlayers, ...reservePlayers];
}
