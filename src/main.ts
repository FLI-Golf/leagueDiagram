import '@picocss/pico/css/pico.min.css';
import './styles.css';
import { resolveAppRoute, getProPlayers, getTeamSummaries } from './application/AppRoutes';
import { areAllGroupsApproved, normalizeFinishOrder, sortTeamsByScore } from './application/FinishOrder';
import { buildGroupScorecard, convertDisplayedHoleValueToStoredScore, getDisplayedHoleValueForPlayer, normalizeScoreEditValue } from './application/ScorecardSummary';
import { SeasonService } from './application/SeasonService';
import { MockDraftSeries } from './domain/draft/MockDraftSeries';
import { DraftRoom } from './domain/draft/DraftRoom';
import { Group } from './domain/pipeline/Group';
import { generateGroupScoreSeed } from './domain/pipeline/GroupSeed';
import { ContentPipeline } from './domain/pipeline/ContentPipeline';
import { FantasyScoring } from './domain/fantasy/FantasyScoring';
import type { FantasyRosterEntry } from './domain/fantasy/FantasyScoring';
import type { SponsorshipScope, SponsorshipTier } from './domain/sponsorship/Sponsorship';
import type { ContentMedia, ContentStatus, ContentSubmission } from './domain/pipeline/ContentPipeline';
import { UserProfile } from './domain/user/UserProfile';

let seed = SeasonService.createRealisticLeagueSeed('league-demo', '');
let selectedTournamentIndex = 0;
let selectedCourseId = seed.courseOptions?.[0]?.id ?? seed.course.id;
let selectedCourseNine = 'front';
let selectedDashboardFilter = 'Manage league';
let postStatusMessage = '';
let seasonFormMessage = '';
const scorekeeperStaff = ['Ava Park', 'Diego Ruiz', 'Renee Walsh', 'Maya Brooks', 'Noah Chen', 'Jamie Lopez'];
const scorekeeperGroupLabels = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F'];
const defaultScorekeeperAssignments: Record<string, string> = {
  'Group A': 'Ava Park',
  'Group B': 'Diego Ruiz',
  'Group C': 'Renee Walsh',
  'Group D': 'Maya Brooks',
  'Group E': 'Noah Chen',
  'Group F': 'Jamie Lopez',
};
const scorekeeperGroupLineups: Record<string, Array<{ teamName: string; players: string[] }>> = {};

const syncScorekeeperGroupLineupsForSelectedTournament = (): void => {
  const tournamentEntries = seed.schedule.getEvents();
  const activeTournamentIndex = Math.min(Math.max(selectedTournamentIndex, 0), Math.max(tournamentEntries.length - 1, 0));
  const eventGroups = Group.generateSeasonPairings(seed.realLeagueTeams, tournamentEntries.length)[activeTournamentIndex] ?? [];

  for (const groupName of scorekeeperGroupLabels) {
    delete scorekeeperGroupLineups[groupName];
  }

  scorekeeperGroupLabels.forEach((groupName, index) => {
    const groupsForThisEvent = eventGroups[index]?.teams ?? [];
    scorekeeperGroupLineups[groupName] = groupsForThisEvent.map((team) => ({
      teamName: team.name,
      players: team.players.map((player) => player.displayName),
    }));
  });
};

let scorekeeperAssignments: Record<string, string> = { ...defaultScorekeeperAssignments };
let scorekeeperScoringStage: 'assignment' | 'scoring' | 'complete' = 'assignment';
let currentScoringHoleIndex = 0;
let scorekeeperScoresByHole: Record<number, Record<string, string>> = {};
let approvedGroups: Record<string, boolean> = {};
let finishOrder: string[] = [...scorekeeperGroupLabels];
let teamPlayoffDistances: Record<string, number> = {};
let teamFinishOrderConfirmed = false;
let confirmedEventScores: Record<string, Record<string, number>> = {};
let selectedApprovalGroup = scorekeeperGroupLabels[0] ?? '';
let lastScoreDirection: 'next' | 'previous' = 'next';
let pendingPlayerScoreReview: { groupName: string; playerName: string; teamName: string } | null = null;
let fantasyDraftSeries: MockDraftSeries | null = null;
let selectedDraftTournamentId: string | null = null;
let draftClockHandle: number | null = null;
let draftAutoPickEnabled = true;
const autoPickedNumbers = new Set<number>();
const fantasyDraftTimerSeconds = 7;

const SCOREKEEPER_STATE_STORAGE_KEY = 'league-demo-scorekeeper-state';
const app = document.querySelector('#app');
if (!app) {
  throw new Error('App root not found');
}

const PRO_STORAGE_KEY = 'league-demo-pro-fan-posts';
const USER_STORAGE_KEY = 'league-demo-current-user';
const SEASON_STORAGE_KEY = 'league-demo-season';

const getStoredSeason = (): { id: string; name: string; purseAmount: number } | null => {
  try {
    const raw = window.localStorage.getItem(SEASON_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.name === 'string' && parsed.name.trim() ? parsed : null;
  } catch {
    return null;
  }
};

const storedSeason = getStoredSeason();
if (storedSeason) {
  seed = SeasonService.createNamedSeason(storedSeason.id, storedSeason.name, storedSeason.purseAmount);
  selectedCourseId = seed.courseOptions?.[0]?.id ?? seed.course.id;
}

const getStoredScorekeeperState = (): Partial<{
  assignments: Record<string, string>;
  scoringStage: 'assignment' | 'scoring' | 'complete';
  currentScoringHoleIndex: number;
  scoresByHole: Record<number, Record<string, string>>;
  approvedGroups: Record<string, boolean>;
  finishOrder: string[];
  teamPlayoffDistances: Record<string, number>;
  teamFinishOrderConfirmed: boolean;
  confirmedEventScores: Record<string, Record<string, number>>;
}> => {
  try {
    const raw = window.localStorage.getItem(SCOREKEEPER_STATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveScorekeeperState = (): void => {
  try {
    window.localStorage.setItem(
      SCOREKEEPER_STATE_STORAGE_KEY,
      JSON.stringify({
        assignments: scorekeeperAssignments,
        scoringStage: scorekeeperScoringStage,
        currentScoringHoleIndex,
        scoresByHole: scorekeeperScoresByHole,
        approvedGroups,
        finishOrder,
        teamPlayoffDistances,
        teamFinishOrderConfirmed,
        confirmedEventScores,
      }),
    );
  } catch {
    // Ignore storage failures in local mock mode.
  }
};

const resetScorekeeperState = (): void => {
  scorekeeperAssignments = { ...defaultScorekeeperAssignments };
  scorekeeperScoringStage = 'assignment';
  currentScoringHoleIndex = 0;
  scorekeeperScoresByHole = {};
  approvedGroups = {};
  finishOrder = [...scorekeeperGroupLabels];
  teamPlayoffDistances = {};
  teamFinishOrderConfirmed = false;
  confirmedEventScores = {};
  window.localStorage.removeItem(SCOREKEEPER_STATE_STORAGE_KEY);
  renderApp();
};

const resetAllMockData = (): void => {
  resetScorekeeperState();
  window.localStorage.removeItem(USER_STORAGE_KEY);
  setCurrentUser(proProfiles[0].id);
  renderApp();
};

const seedAllGroupScoresForTesting = (): void => {
  scorekeeperScoresByHole = {};
  approvedGroups = {};
  scorekeeperScoresByHole = generateGroupScoreSeed(scorekeeperGroupLabels, scorekeeperGroupLineups, 18);

  scorekeeperScoringStage = 'complete';
  currentScoringHoleIndex = 17;
  saveScorekeeperState();
  renderApp();
};

const fantasyDraftOwnerId = 'fantasy-owner';
const fantasyDraftParticipantIds = ['owen-bell', 'nina-alvarez', 'harper-quinn', 'marcus-webb', 'taylor-reed'];

const getDraftPlayerPool = () => seed.realLeagueTeams.flatMap((team) => [...team.players]);

const getScheduledTournamentIds = (): string[] => seed.schedule.getEvents().map((entry) => entry.result.id);

const getTournamentName = (tournamentId: string): string =>
  seed.schedule.getEvents().find((entry) => entry.result.id === tournamentId)?.result.name ?? tournamentId;

const getDraftDisplayName = (participantId: string): string =>
  userDirectory.find((user) => user.id === participantId)?.displayName ?? participantId;

const getSelectedDraftRoom = (): DraftRoom | null => {
  if (!fantasyDraftSeries || !selectedDraftTournamentId) {
    return null;
  }

  return fantasyDraftSeries.getRooms().find((room) => room.tournamentId === selectedDraftTournamentId) ?? null;
};

// Tournaments before the one in view count as already played, so a late draft covers fewer events.
const seedFantasyDraft = (): void => {
  const scheduled = getScheduledTournamentIds();
  const remaining = MockDraftSeries.remainingTournaments(scheduled, scheduled.slice(0, selectedTournamentIndex));

  if (remaining.length === 0) {
    return;
  }

  const series = new MockDraftSeries('fantasy-draft', fantasyDraftOwnerId);
  series.configure(fantasyDraftOwnerId, remaining, getDraftPlayerPool(), fantasyDraftTimerSeconds);

  for (const participantId of fantasyDraftParticipantIds) {
    series.join(participantId);
  }

  fantasyDraftSeries = series;
  selectedDraftTournamentId = remaining[0];
  renderApp();
};

const advanceFantasyDraftPicks = (count: number): void => {
  const room = getSelectedDraftRoom();
  if (!room || room.isLocked()) {
    return;
  }

  for (let pick = 0; pick < count && room.getStatus() !== 'complete'; pick += 1) {
    const participantId = room.getParticipantOnTheClock();
    if (!participantId) {
      break;
    }

    const [player] = room.getSelectablePlayers(participantId);
    if (!player) {
      break;
    }

    room.pick(participantId, player.id);
  }

  renderApp();
};

const resetFantasyDraft = (): void => {
  stopDraftClock();
  autoPickedNumbers.clear();
  fantasyDraftSeries = null;
  selectedDraftTournamentId = null;
  renderApp();
};

const getSelectedTournamentId = (): string => getScheduledTournamentIds()[selectedTournamentIndex] ?? '';

// Confirming both publishes the event's scores and closes its draft for good.
const confirmSelectedTournamentResults = (): void => {
  const tournamentId = getSelectedTournamentId();
  teamFinishOrderConfirmed = true;
  confirmedEventScores[tournamentId] = captureEventProScores();
  fantasyDraftSeries?.lockRoom(tournamentId);
  saveScorekeeperState();
  renderApp();
};

// One shot for testing: run the draft first, then play the event and confirm it.
const seedScoredEventAndDraft = (): void => {
  if (!fantasyDraftSeries) {
    seedFantasyDraft();
  }

  const room = getSelectedDraftRoom();
  if (room && !room.isLocked()) {
    while (room.getStatus() !== 'complete') {
      const participantId = room.getParticipantOnTheClock();
      if (!participantId) {
        break;
      }

      const [player] = room.getSelectablePlayers(participantId);
      if (!player) {
        break;
      }

      room.pick(participantId, player.id);
    }
  }

  scorekeeperScoresByHole = generateGroupScoreSeed(scorekeeperGroupLabels, scorekeeperGroupLineups, 18);
  scorekeeperScoringStage = 'complete';
  currentScoringHoleIndex = 17;
  scorekeeperGroupLabels.forEach((group) => {
    approvedGroups[group] = true;
  });
  finishOrder = normalizeFinishOrder(scorekeeperGroupLabels, finishOrder);
  finishOrder = getTeamFinishEntries().map((entry) => entry.teamName);
  confirmSelectedTournamentResults();
};

// Mock ranking: teams are seeded strongest-first, so a player's slot within their gender is their rating.
const getDraftRating = (player: { id: string; gender: string }): number => {
  const rank = getDraftPlayerPool()
    .filter((entry) => entry.gender === player.gender)
    .findIndex((entry) => entry.id === player.id);
  return 100 - rank * 2;
};

const getDraftTeamName = (playerId: string): string =>
  seed.realLeagueTeams.find((team) => team.players.some((player) => player.id === playerId))?.name ?? '';

const getRecommendedPick = (room: DraftRoom, participantId: string) =>
  [...room.getSelectablePlayers(participantId)].sort((left, right) => getDraftRating(right) - getDraftRating(left))[0];

const stopDraftClock = (): void => {
  if (draftClockHandle !== null) {
    window.clearInterval(draftClockHandle);
    draftClockHandle = null;
  }
};

const tickDraftClock = (): void => {
  const room = getSelectedDraftRoom();
  if (!room || room.getStatus() !== 'inProgress') {
    stopDraftClock();
    return;
  }

  const now = Date.now();
  const remaining = room.getSecondsRemaining(now);
  const timerLabels = document.querySelectorAll('.draft-clock-value');

  if (remaining > 0) {
    timerLabels.forEach((label) => {
      label.textContent = `${remaining}s`;
    });
    return;
  }

  if (!draftAutoPickEnabled) {
    timerLabels.forEach((label) => {
      label.textContent = 'Expired';
    });
    return;
  }

  autoPickedNumbers.add(room.autoPick(now).pickNumber);
  renderApp();
};

const startFantasyDraft = (): void => {
  const room = getSelectedDraftRoom();
  if (!room || room.getStatus() !== 'pending' || room.isLocked()) {
    return;
  }

  room.open(fantasyDraftOwnerId, Date.now());
  stopDraftClock();
  draftClockHandle = window.setInterval(tickDraftClock, 1000);
  renderApp();
};

const makeDraftPick = (playerId: string): void => {
  const room = getSelectedDraftRoom();
  const participantId = room?.getParticipantOnTheClock();
  if (!room || !participantId || room.isLocked()) {
    return;
  }

  room.pick(participantId, playerId, Date.now());
  renderApp();
};

const setFantasyDraftTimer = (seconds: number): void => {
  getSelectedDraftRoom()?.setTimerSeconds(fantasyDraftOwnerId, seconds);
  renderApp();
};
const persistedScorekeeperState = getStoredScorekeeperState();
if (persistedScorekeeperState.assignments) {
  scorekeeperAssignments = { ...defaultScorekeeperAssignments, ...persistedScorekeeperState.assignments };
}
if (persistedScorekeeperState.scoringStage) {
  scorekeeperScoringStage = persistedScorekeeperState.scoringStage;
}
if (typeof persistedScorekeeperState.currentScoringHoleIndex === 'number') {
  currentScoringHoleIndex = persistedScorekeeperState.currentScoringHoleIndex;
}
if (persistedScorekeeperState.scoresByHole) {
  scorekeeperScoresByHole = persistedScorekeeperState.scoresByHole;
}
if (persistedScorekeeperState.approvedGroups) {
  approvedGroups = persistedScorekeeperState.approvedGroups;
}
if (Array.isArray(persistedScorekeeperState.finishOrder) && persistedScorekeeperState.finishOrder.length) {
  finishOrder = normalizeFinishOrder(scorekeeperGroupLabels, persistedScorekeeperState.finishOrder);
}
if (persistedScorekeeperState.teamPlayoffDistances) {
  teamPlayoffDistances = persistedScorekeeperState.teamPlayoffDistances;
}
if (typeof persistedScorekeeperState.teamFinishOrderConfirmed === 'boolean') {
  teamFinishOrderConfirmed = persistedScorekeeperState.teamFinishOrderConfirmed;
}
if (persistedScorekeeperState.confirmedEventScores) {
  confirmedEventScores = persistedScorekeeperState.confirmedEventScores;
}
syncScorekeeperGroupLineupsForSelectedTournament();

const proProfiles = [
  new UserProfile('simon-lizotte', 'Simon Lizotte', 'simon@fli.example.com', ['pro'], 'Disc golf pro and content creator'),
  new UserProfile('paul-mcbeth', 'Paul McBeth', 'paul@fli.example.com', ['pro'], 'Tour-level competitor and fantasy league owner'),
  new UserProfile('gannon-buhr', 'Gannon Buhr', 'gannon@fli.example.com', ['pro'], 'Player, analyst, and score oversight lead'),
  new UserProfile('ricky-wysocki', 'Ricky Wysocki', 'ricky@fli.example.com', ['pro'], 'Content creator and course strategy expert'),
];

const adminProfiles = [
  new UserProfile('super-admin', 'Super Admin', 'super@fli.example.com', ['siteAdmin'], 'Platform owner with full system and schema visibility'),
  new UserProfile('league-admin', 'League Admin', 'admin@fli.example.com', ['leagueAdmin'], 'League operations and scoring lead'),
  new UserProfile('fantasy-owner', 'Fantasy Owner', 'fantasy-owner@fli.example.com', ['fantasyLeagueOwner'], 'Controls the fantasy league and participant rules'),
];

const scorekeeperProfiles = [
  new UserProfile('ava-park', 'Ava Park', 'ava@fli.example.com', ['scorekeeper'], 'Covers Group A'),
  new UserProfile('diego-ruiz', 'Diego Ruiz', 'diego@fli.example.com', ['scorekeeper'], 'Covers Group B'),
  new UserProfile('renee-walsh', 'Renee Walsh', 'renee@fli.example.com', ['scorekeeper'], 'Covers Group C'),
  new UserProfile('maya-brooks', 'Maya Brooks', 'maya@fli.example.com', ['scorekeeper'], 'Covers Group D'),
  new UserProfile('noah-chen', 'Noah Chen', 'noah@fli.example.com', ['scorekeeper'], 'Covers Group E'),
  new UserProfile('jamie-lopez', 'Jamie Lopez', 'jamie@fli.example.com', ['scorekeeper'], 'Covers Group F'),
];

// Community accounts covering the registered-user lifecycle and the commerce tags.
const fanProfiles = [
  UserProfile.register('taylor-reed', 'Taylor Reed', 'taylor@fli.example.com', 'Just registered, no purchases yet'),
  new UserProfile('harper-quinn', 'Harper Quinn', 'harper@fli.example.com', ['viewer'], 'Follows the league and buys event tickets', ['ticketBuyer']),
  new UserProfile('marcus-webb', 'Marcus Webb', 'marcus@fli.example.com', ['viewer'], 'Season pass holder and shop regular', ['seasonPassHolder', 'merchandiseBuyer']),
  new UserProfile('nina-alvarez', 'Nina Alvarez', 'nina@fli.example.com', ['viewer', 'fantasyParticipant'], 'Plays in a friend-run fantasy league', ['ticketBuyer']),
  new UserProfile('owen-bell', 'Owen Bell', 'owen@fli.example.com', ['viewer', 'fantasyLeagueOwner', 'fantasyParticipant'], 'Started his own fantasy league last season', ['merchandiseBuyer']),
  new UserProfile('sage-collins', 'Sage Collins', 'sage@fli.example.com', ['viewer'], 'Local shop sponsoring hole signage', ['sponsor']),
];

const userDirectory = [...proProfiles, ...adminProfiles, ...scorekeeperProfiles, ...fanProfiles];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return replacements[character];
  });

const normalizeStoredSubmission = (entry: unknown, authorId: string, authorName: string): ContentSubmission | null => {
  const record = (typeof entry === 'string' ? { text: entry } : entry) as Partial<ContentSubmission> | null;
  if (!record) {
    return null;
  }

  const media = record.media;
  const url = typeof media?.url === 'string' ? media.url : '';
  const isSafeMedia =
    (media?.kind === 'image' && url.startsWith('data:image/')) || (media?.kind === 'video' && url.startsWith('data:video/'));
  const status: ContentStatus =
    record.status === 'pending' || record.status === 'approved' || record.status === 'rejected' ? record.status : 'approved';

  return {
    id: typeof record.id === 'string' ? record.id : `post-${Math.random().toString(36).slice(2)}`,
    authorId: typeof record.authorId === 'string' ? record.authorId : authorId,
    authorName: typeof record.authorName === 'string' ? record.authorName : authorName,
    text: typeof record.text === 'string' ? record.text : '',
    submittedAt: typeof record.submittedAt === 'string' ? record.submittedAt : '',
    status,
    reviewedBy: typeof record.reviewedBy === 'string' ? record.reviewedBy : undefined,
    reviewedAt: typeof record.reviewedAt === 'string' ? record.reviewedAt : undefined,
    reviewNote: typeof record.reviewNote === 'string' ? record.reviewNote : undefined,
    media: isSafeMedia && media ? { kind: media.kind, url, name: String(media.name ?? '') } : undefined,
  };
};

const loadContentPipeline = (): ContentPipeline => {
  try {
    const raw = window.localStorage.getItem(PRO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    // Older builds stored a plain map of author id to text posts.
    const entries = Array.isArray(parsed)
      ? parsed.map((entry) => normalizeStoredSubmission(entry, '', ''))
      : Object.entries(parsed as Record<string, unknown[]>).flatMap(([authorId, posts]) => {
          const author = userDirectory.find((user) => user.id === authorId);
          return (posts ?? []).map((post) => normalizeStoredSubmission(post, authorId, author?.displayName ?? authorId));
        });

    return new ContentPipeline(entries.filter((entry): entry is ContentSubmission => entry !== null));
  } catch {
    return new ContentPipeline();
  }
};

let contentPipeline = loadContentPipeline();

// Media is stored as a data URL, so fall back to text-only when it blows the storage quota.
const saveContentPipeline = (): boolean => {
  const submissions = contentPipeline.getAll();

  try {
    window.localStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(submissions));
    return true;
  } catch {
    try {
      window.localStorage.setItem(
        PRO_STORAGE_KEY,
        JSON.stringify(submissions.map(({ media: _media, ...rest }) => rest)),
      );
    } catch {
      return false;
    }

    return false;
  }
};

const getCurrentUser = (): UserProfile => {
  const storedId = window.localStorage.getItem(USER_STORAGE_KEY) ?? proProfiles[0].id;
  return userDirectory.find((user) => user.id === storedId) ?? proProfiles[0];
};

const setCurrentUser = (userId: string): void => {
  window.localStorage.setItem(USER_STORAGE_KEY, userId);
};

const submitFanPost = (authorId: string, body: string, media?: ContentMedia): boolean => {
  const user = userDirectory.find((entry) => entry.id === authorId);
  if (!user || !user.hasRole('pro')) {
    return true;
  }

  contentPipeline.submit({
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    authorId,
    authorName: user.displayName,
    text: body,
    media,
    submittedAt: new Date().toISOString(),
  });

  return saveContentPipeline();
};

const reviewFanPost = (submissionId: string, decision: 'approve' | 'reject', reviewer: UserProfile, note?: string): void => {
  if (!reviewer.hasRole('leagueAdmin') && !reviewer.hasRole('siteAdmin')) {
    return;
  }

  const reviewedAt = new Date().toISOString();
  if (decision === 'approve') {
    contentPipeline.approve(submissionId, reviewer.id, reviewedAt);
  } else {
    contentPipeline.reject(submissionId, reviewer.id, reviewedAt, note);
  }

  saveContentPipeline();
};

const readPostMedia = (file: File): Promise<ContentMedia | null> => {
  const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : null;
  if (!kind) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ kind, url: String(reader.result ?? ''), name: file.name });
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
};

const getFanPostsForProfile = (profileId: string): readonly ContentSubmission[] => contentPipeline.getForAuthor(profileId);

const getPublishedPostsForProfile = (profileId: string): readonly ContentSubmission[] =>
  contentPipeline.getPublished(profileId);


const getRoute = () => resolveAppRoute(window.location.pathname);

const submitScorekeeperScoringForm = (form: HTMLFormElement, direction: 'next' | 'previous'): void => {
  if (direction === 'previous') {
    if (currentScoringHoleIndex > 0) {
      currentScoringHoleIndex -= 1;
    }
    renderApp();
    return;
  }

  const playerScoreEntries = form.querySelectorAll('input[name^="player-score-"]') as NodeListOf<HTMLInputElement>;
  const holeScores: Record<string, string> = {};
  let hasEntries = false;

  playerScoreEntries.forEach((field) => {
    const value = field.value.trim();
    if (!value) {
      return;
    }

    const normalized = /^[-+]?\d+$/.test(value) ? value : '+3';
    holeScores[field.name.replace(/^player-score-/, '')] = normalized;
    hasEntries = true;
  });

  if (hasEntries) {
    scorekeeperScoresByHole[currentScoringHoleIndex] = holeScores;
  }

  if (currentScoringHoleIndex >= 17) {
    scorekeeperScoringStage = 'complete';
  } else {
    currentScoringHoleIndex += 1;
  }

  saveScorekeeperState();
  renderApp();
};

const getNavIcon = (label: string): string => {
  const iconMap: Record<string, string> = {
    overview: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9 20v-6h6v6"/></svg>`,
    teams: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"/><circle cx="10" cy="7" r="3"/><path d="M20 19v-1a4 4 0 0 0-3-3.87"/><path d="M16 4.13a4 4 0 0 1 0 7.75"/></svg>`,
    pros: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a5 5 0 0 1 5 5v1.5A2.5 2.5 0 0 1 14.5 12H9.5A2.5 2.5 0 0 1 7 10.5V8a5 5 0 0 1 5-5Z"/><path d="M8 15.5c1.1.9 2.4 1.5 4 1.5s2.9-.6 4-1.5"/><path d="M12 15v5"/></svg>`,
    diagram: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h7v5H4zM13 6h7v4h-7zM4 13h7v5H4zM13 12h7v7h-7z"/><path d="M11 8.5h2M11 15.5h2M8 11V13M16 10V12"/></svg>`,
    admin: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.2 2.7 8.1 7 9.9 4.3-1.8 7-5.7 7-9.9V6l-7-3Z"/><path d="M9.5 12.5 11 14l3.5-4"/></svg>`,
    standings: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/><path d="M3 19h18"/></svg>`,
    fantasy: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 4 7h16l-3 10"/><path d="M9 7V5h6v2"/><path d="M9 11h6"/></svg>`,
    roster: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"/><path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/><path d="M17 8.5a2.5 2.5 0 1 1 0 5"/><path d="M18 18.5a3.5 3.5 0 0 0-2.5-3.4"/></svg>`,
    'fan feed': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5a8.5 8.5 0 0 1 17 0"/><path d="M7.5 15.5a4.5 4.5 0 0 1 9 0"/><circle cx="12" cy="19" r="1.5"/><path d="M5 5.5 8 8.5"/><path d="M19 5.5 16 8.5"/></svg>`,
    'league admin': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.2 2.7 8.1 7 9.9 4.3-1.8 7-5.7 7-9.9V6l-7-3Z"/><path d="M9.5 12.5 11 14l3.5-4"/></svg>`,
    'scorekeeper review': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 13h8"/><path d="M8 17h5"/></svg>`,
    'scorekeeper pipeline': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"/><path d="M7 18V7"/><path d="M12 18V4"/><path d="M17 18v-9"/></svg>`,
    'fantasy league': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 4 7h16l-3 10"/><path d="M9 7V5h6v2"/><path d="M9 11h6"/></svg>`,
    'draft controls': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h16"/><path d="M8 18V7l4-3 4 3v11"/><path d="M10 11h4"/></svg>`,
    'fantasy roster': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"/><path d="M3 19v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/><path d="M17 8.5a2.5 2.5 0 1 1 0 5"/><path d="M18 18.5a3.5 3.5 0 0 0-2.5-3.4"/></svg>`,
    'league activity': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13.5h4l2-7 4 13 2-6.5h4"/></svg>`,
    'post content': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h9"/><path d="M5 10h6"/><path d="M5 15h5"/><path d="m14 17 6-6 2 2-6 6h-2v-2Z"/></svg>`,
    'my team': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"/><circle cx="10" cy="7" r="3"/><path d="M20 19v-1a4 4 0 0 0-3-3.87"/><path d="M16 4.13a4 4 0 0 1 0 7.75"/></svg>`,
    'my stats': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9"/><path d="M12 19V5"/><path d="M19 19v-7"/><path d="M3 19h18"/></svg>`,
    photo: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
    'content review': `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h9l3 3v13H6z"/><path d="M9 12l2 2 4-4"/></svg>`,
    video: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11v10H4z"/><path d="m15 11 5-3v8l-5-3z"/></svg>`,
    library: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10v10H4z"/><path d="M8 4h12v12"/><path d="m5 14 3-3 3 3 2-2 2 2"/></svg>`,
    default: `<svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>`,
  };

  const normalized = label.toLowerCase();
  return iconMap[normalized] ?? iconMap.default;
};

const getMenuIcon = (label: string): string => getNavIcon(label);

const getRoleNavLinks = (user: UserProfile): Array<{ label: string; href: string }> => {
  const links: Array<{ label: string; href: string }> = [
    { label: 'Dashboard', href: '/' },
    { label: 'Teams', href: '/teams' },
    { label: 'Pros', href: '/pros' },
  ];

  // The schema diagram is an internal platform view.
  if (user.hasRole('siteAdmin')) {
    links.push({ label: 'Diagram', href: '/diagram' });
  }

  return links;
};

const renderNav = (user: UserProfile, active: 'home' | 'teams' | 'pros' | 'diagram') => {
  const links = getRoleNavLinks(user);

  return `
    <nav class="top-nav" aria-label="Primary navigation">
      ${links
        .map((link) => {
          const normalized = link.href === '/' ? 'home' : link.href.replace('/', '');
          const isActive = normalized === active || (link.href === '/' && active === 'home');

          return `<a class="nav-link ${isActive ? 'active' : ''}" href="${link.href}">${getNavIcon(link.label)}<span>${link.label}</span></a>`;
        })
        .join('')}
    </nav>
  `;
};

const mockCurrentUser = (userId: string): void => {
  setCurrentUser(userId);
  renderApp();
};

const renderRoleBadges = (user: UserProfile): string => {
  const roleLabels: Record<string, string> = {
    siteAdmin: 'Super admin',
    pro: 'Pro',
    leagueAdmin: 'Admin',
    scorekeeper: 'Scorekeeper',
    fantasyLeagueOwner: 'Fantasy owner',
    fantasyParticipant: 'Fantasy participant',
    viewer: 'Viewer',
  };

  const tagLabels: Record<string, string> = {
    ticketBuyer: 'Ticket buyer',
    merchandiseBuyer: 'Merch buyer',
    seasonPassHolder: 'Season pass',
    sponsor: 'Sponsor',
  };

  return `
    <div class="role-badges">
      ${user
        .getRoles()
        .filter((role) => roleLabels[role])
        .map((role) => `<span class="role-badge role-${role}">${roleLabels[role]}</span>`)
        .join('')}
      ${user
        .getTags()
        .filter((tag) => tagLabels[tag])
        .map((tag) => `<span class="role-badge tag-badge">${tagLabels[tag]}</span>`)
        .join('')}
    </div>
  `;
};

const getAssignedGroupForUser = (user: UserProfile): string | null => {
  const match = Object.entries(scorekeeperAssignments).find(([, person]) => person === user.displayName);
  return match ? match[0] : null;
};

const getRoleMenus = (user: UserProfile): Array<{ label: string; href: string; detail: string; isActive: boolean }> => {
  const dashboardFilterOptions = ['Approve scores', 'Manage league', 'Scorekeeper assignment', 'Scorekeeper scorecard', 'Standings', 'Fantasy league', 'Draft controls', 'Fantasy roster', 'League activity', 'Post content', 'My team', 'My stats', 'Content review', 'Overview'];
  const activeFilter = dashboardFilterOptions.includes(selectedDashboardFilter)
    ? selectedDashboardFilter
    : user.hasRole('leagueAdmin')
      ? 'Approve scores'
      : user.hasRole('scorekeeper')
        ? 'Scorekeeper scorecard'
        : user.hasRole('pro')
          ? 'Post content'
          : 'Overview';
  const menus: Array<{ label: string; href: string; detail: string; isActive: boolean }> = [];

  if (user.hasRole('siteAdmin')) {
    menus.push({ label: 'Diagram', href: '/diagram', detail: 'Inspect the entity map behind the platform.', isActive: false });
    menus.push({ label: 'Content review', href: '/', detail: `Approve pro posts before they go public${contentPipeline.getPending().length ? ` (${contentPipeline.getPending().length} waiting)` : ''}.`, isActive: activeFilter === 'Content review' });
    menus.push({ label: 'Manage league', href: '/', detail: 'Create Season and Tournaments', isActive: activeFilter === 'Manage league' });
  }

  if (user.hasRole('pro')) {
    menus.push({ label: 'Post content', href: '/', detail: 'Share updates and course notes with fans.', isActive: false });
    menus.push({ label: 'My team', href: '/', detail: 'Review your roster and teammates.', isActive: false });
    menus.push({ label: 'My stats', href: '/', detail: 'Track your event scores this season.', isActive: false });
  }

  if (user.hasRole('leagueAdmin')) {
    menus.push({ label: 'Approve scores', href: '/', detail: 'Review submitted scores and approve final group results.', isActive: activeFilter === 'Approve scores' });
    menus.push({ label: 'Content review', href: '/', detail: `Approve pro posts before they go public${contentPipeline.getPending().length ? ` (${contentPipeline.getPending().length} waiting)` : ''}.`, isActive: activeFilter === 'Content review' });
    menus.push({ label: 'Manage league', href: '/', detail: 'Create Season and Tournaments', isActive: activeFilter === 'Manage league' });
    menus.push({ label: 'Scorekeeper assignment', href: '/', detail: 'Assign scorekeepers to each group and score the round.', isActive: activeFilter === 'Scorekeeper assignment' });
  }

  if (user.hasRole('scorekeeper')) {
    menus.push({ label: 'Scorekeeper scorecard', href: '/', detail: 'Enter hole-by-hole scores for your assigned group.', isActive: activeFilter === 'Scorekeeper scorecard' });
    menus.push({ label: 'Standings', href: '/', detail: 'Monitor league standings and event results.', isActive: false });
  }

  if (user.hasRole('fantasyLeagueOwner')) {
    menus.push({ label: 'Fantasy league', href: '/', detail: 'Manage owners, drafts, and roster settings.', isActive: false });
    menus.push({ label: 'Draft controls', href: '/', detail: 'Review draft order and fantasy decisions.', isActive: false });
  }

  if (user.hasRole('fantasyParticipant')) {
    menus.push({ label: 'Fantasy roster', href: '/', detail: 'Check drafted players and team performance.', isActive: false });
    menus.push({ label: 'League activity', href: '/', detail: 'View fantasy movement and updates.', isActive: false });
  }

  if (menus.length === 0) {
    menus.push({ label: 'Overview', href: '/', detail: 'Standard viewer access for reading the league.', isActive: true });
  }

  return menus.map((menu) => ({ ...menu, isActive: menu.label === activeFilter }));
};

const renderLoginPane = (): string => {
  const currentUser = getCurrentUser();

  return `
    <section class="panel auth-panel dashboard-panel">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Dashboard</p>
          <h2>Mock current user</h2>
        </div>
      </div>

      <form data-action="login" class="login-form">
        <label>
          <span>Signed in as</span>
          <select name="userId">
            ${userDirectory
              .map(
                (user) => `
                  <option value="${user.id}" ${user.id === currentUser.id ? 'selected' : ''}>
                    ${user.displayName} — ${user.hasRole('pro') ? 'Pro' : user.getRoles().join(', ')}
                  </option>
                `,
              )
              .join('')}
          </select>
        </label>
        <button type="submit">Switch account</button>
      </form>

      <div class="status-row">
        <p class="status-text">Active account: <strong>${currentUser.displayName}</strong></p>
        ${renderRoleBadges(currentUser)}
      </div>
    </section>
  `;
};

const getRoleAccessSummary = (user: UserProfile): string[] => {
  const access: string[] = [];

  if (user.hasRole('pro')) {
    access.push('Pro roster, fan updates, team context');
  }
  if (user.hasRole('leagueAdmin')) {
    access.push('League admin controls and member visibility');
  }
  if (user.hasRole('scorekeeper')) {
    access.push('Scorekeeper assignment and hole-by-hole scoring');
  }
  if (user.hasRole('fantasyLeagueOwner')) {
    access.push('Fantasy league setup and draft controls');
  }
  if (user.hasRole('fantasyParticipant')) {
    access.push('Fantasy roster and league activity');
  }
  if (user.hasRole('viewer')) {
    access.push('Read-only view of the league overview');
  }

  return access.length > 0 ? access : ['Read-only league overview'];
};

// The demo seed starts unnamed so an admin creates the first season.
const hasSeason = (): boolean => seed.season.league.name.trim().length > 0;

const getSeasonDisplayName = (): string => seed.season.league.name.trim() || 'No season created yet';

const getSeasonWorkspaceTitle = (): string => (hasSeason() ? `${seed.season.league.name.trim()} season workspace` : 'Season workspace');

const renderDashboardMenus = (): string => {
  const currentUser = getCurrentUser();
  const menus = getRoleMenus(currentUser);

  return `
    <section class="panel dashboard-panel">
      <p class="eyebrow">Relevant menus</p>
      <h2>${getSeasonWorkspaceTitle()}</h2>
      <div class="menu-grid">
        ${menus
          .map(
            (menu) => `
              <a class="menu-card ${menu.isActive ? 'is-active' : ''}" href="${menu.href}" data-dashboard-filter="${menu.label}" aria-current="${menu.isActive ? 'page' : 'false'}">
                <span class="menu-card-header">
                  ${getMenuIcon(menu.label)}
                  <span class="menu-label">${menu.label}</span>
                </span>
                <span class="menu-detail">${menu.detail}</span>
              </a>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
};

const renderSeasonCreator = (): string => {
  const currentUser = getCurrentUser();

  if (!SeasonService.canCreateSeason(currentUser)) {
    return '';
  }

  return `
    <section class="panel">
      <h2>Create season</h2>
      <form data-action="create-season" class="inline-form">
        <label>
          <span>Season name</span>
          <input type="text" name="seasonName" value="${seed.season.league.name}" placeholder="Autumn Circuit" required />
        </label>
        <label>
          <span>Purse amount</span>
          <input type="number" name="purseAmount" value="${seed.season.league.purseAmount ?? 4000000}" min="0" step="100000" />
        </label>
        <button type="submit">${hasSeason() ? 'Update season' : 'Create season'}</button>
      </form>
      ${seasonFormMessage ? `<p class="role-access-note">${escapeHtml(seasonFormMessage)}</p>` : ''}
    </section>
  `;
};

const hasGroupSubmittedAllHoles = (group: string): boolean => {
  const playerKeys = (scorekeeperGroupLineups[group] ?? []).flatMap((lineup) =>
    lineup.players.map((player) => `${group}|${lineup.teamName}|${player}`),
  );

  if (playerKeys.length === 0) {
    return false;
  }

  return Array.from({ length: 18 }, (_, holeIndex) => holeIndex).every((holeIndex) => {
    const holeScores = scorekeeperScoresByHole[holeIndex] ?? {};
    return playerKeys.some((playerKey) => Object.prototype.hasOwnProperty.call(holeScores, playerKey));
  });
};

const renderPlayerScoreReviewMarkup = (groupName: string, playerName: string, teamName: string): string => {
  const scorecard = buildGroupScorecard(groupName, scorekeeperGroupLineups[groupName] ?? [], scorekeeperScoresByHole);
  const playerRow = scorecard.find((row) => row.player === playerName && row.teamName === teamName);

  if (!playerRow) {
    return `
      <div class="role-access-note">No scorecard data is available for ${playerName}.</div>
    `;
  }

  return `
    <div class="review-player-summary" style="margin-bottom: 1rem;">
      <p class="eyebrow">Review player card</p>
      <h4 style="margin: 0.25rem 0 0.5rem;">${playerName}</h4>
      <p class="role-access-note" style="margin: 0;">${groupName} · ${teamName}</p>
    </div>
    <div class="scorecard-summary-wrap scorecard-summary-wrap--compact">
      <table class="scorecard-table scorecard-table--compact">
        <thead>
          <tr>
            <th scope="col">Hole</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          ${playerRow.holeScores
            .map(
              (entry) => `
                <tr>
                  <th scope="row">${entry.hole}</th>
                  <td class="scorecard-cell ${entry.relativeToPar === 0 ? 'scorecard-cell--even' : entry.relativeToPar > 0 ? 'scorecard-cell--positive' : 'scorecard-cell--negative'}">${entry.displayValue}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
    <div class="role-access-note" style="margin-top: 1rem;">Total: <strong>${playerRow.displayTotal}</strong></div>
  `;
};

const openPlayerScoreReviewModal = (groupName: string, playerName: string, teamName: string): void => {
  pendingPlayerScoreReview = { groupName, playerName, teamName };
  const modal = document.querySelector('#score-review-modal') as HTMLDialogElement | null;
  const content = modal?.querySelector('#score-review-content');
  if (!modal || !content) {
    return;
  }

  const title = modal.querySelector('#score-review-title');
  if (title) {
    title.textContent = `${playerName} — ${groupName}`;
  }

  content.innerHTML = renderPlayerScoreReviewMarkup(groupName, playerName, teamName);
  modal.showModal();
};

const getTeamPlayoffDistance = (teamName: string): number => {
  if (Number.isFinite(teamPlayoffDistances[teamName])) {
    return teamPlayoffDistances[teamName];
  }

  return Number.POSITIVE_INFINITY;
};

const getTeamFinishEntries = (): Array<{ teamName: string; score: number; playoffDistance: number }> => {
  let tieBreakIndex = 0;
  const teamsWithScores = normalizeFinishOrder(scorekeeperGroupLabels, finishOrder)
    .flatMap((groupName) =>
      (scorekeeperGroupLineups[groupName] ?? []).map((entry) => {
        const team = {
          teamName: entry.teamName,
          score: getTeamScoreLabelValue(entry.teamName),
          playoffDistance: getTeamPlayoffDistance(entry.teamName),
          tieBreakIndex: tieBreakIndex++,
        };
        return team;
      }),
    )
    .filter((entry) => Number.isFinite(entry.score));

  return sortTeamsByScore(teamsWithScores).map((entry) => ({
    teamName: entry.teamName,
    score: entry.score,
    playoffDistance: entry.playoffDistance,
  }));
};

const getOrderedTeamFinishList = (): string[] => {
  return getTeamFinishEntries().map((entry) => entry.teamName);
};

const getTeamScoreLabelValue = (teamName: string): number => {
  for (const groupName of scorekeeperGroupLabels) {
    const groupCard = buildGroupScorecard(groupName, scorekeeperGroupLineups[groupName] ?? [], scorekeeperScoresByHole);
    const teamPlayers = groupCard.filter((playerRow) => playerRow.teamName === teamName);
    if (teamPlayers.length > 0) {
      return teamPlayers.reduce((sum, playerRow) => sum + playerRow.totalRelativeToPar, 0);
    }
  }

  return Number.POSITIVE_INFINITY;
};

const getTeamScoreLabel = (teamName: string): string => {
  const teamTotal = getTeamScoreLabelValue(teamName);
  if (!Number.isFinite(teamTotal)) {
    return 'E';
  }

  return teamTotal === 0 ? 'E' : `${teamTotal > 0 ? '+' : ''}${teamTotal}`;
};

const getTeamPayoutAmount = (finishPosition: number, eventIndex = selectedTournamentIndex): number => {
  const payoutBreakdown = seed.payoutBreakdown ?? SeasonService.createProgressivePayoutBreakdown();
  return SeasonService.getEventPayoutAmount(eventIndex, finishPosition, payoutBreakdown);
};

const getTeamFinishDisplayLabel = (teamName: string, options?: { finishPosition?: number; includePlacementPayout?: boolean; eventIndex?: number }): string => {
  const scoreLabel = getTeamScoreLabel(teamName);
  const playoffDistance = getTeamPlayoffDistance(teamName);
  const baseText = `${teamName} — ${scoreLabel}`;
  const distanceText = Number.isFinite(playoffDistance) && playoffDistance !== Number.POSITIVE_INFINITY ? ` --- ${playoffDistance}` : '';
  const finishPosition = options?.finishPosition;
  const includePlacementPayout = options?.includePlacementPayout ?? false;
  const eventIndex = options?.eventIndex ?? selectedTournamentIndex;
  const placementText = includePlacementPayout && typeof finishPosition === 'number' ? ` --- ${finishPosition}` : '';
  const payoutText = includePlacementPayout && typeof finishPosition === 'number' ? ` --- $${getTeamPayoutAmount(finishPosition, eventIndex).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
  return `${baseText}${distanceText}${placementText}${payoutText}`;
};

// Snapshot taken when the admin confirms, so each tournament keeps its own result set.
const captureEventProScores = (): Record<string, number> => {
  const scores: Record<string, number> = {};
  for (const groupName of scorekeeperGroupLabels) {
    const groupCard = buildGroupScorecard(groupName, scorekeeperGroupLineups[groupName] ?? [], scorekeeperScoresByHole);
    for (const playerRow of groupCard) {
      scores[playerRow.player] = playerRow.totalRelativeToPar;
    }
  }

  return scores;
};

const getConfirmedProScores = (tournamentId: string): Map<string, number> | null => {
  const scores = confirmedEventScores[tournamentId];
  return scores ? new Map(Object.entries(scores)) : null;
};

const formatRelativeToPar = (total: number): string => (total === 0 ? 'E' : `${total > 0 ? '+' : ''}${total}`);

const renderAdminApprovalDashboard = (): string => {
  const allGroupsSubmitted = scorekeeperGroupLabels.every(hasGroupSubmittedAllHoles);
  const allGroupsApproved = areAllGroupsApproved(scorekeeperGroupLabels, approvedGroups);
  const visibleFinishOrder = normalizeFinishOrder(scorekeeperGroupLabels, finishOrder);
  const visibleTeamFinishOrder = getOrderedTeamFinishList();
  const payoutBreakdown = seed.payoutBreakdown ?? SeasonService.createProgressivePayoutBreakdown();
  const tournamentEntries = seed.schedule.getEvents();
  const activeTournamentIndex = Math.min(Math.max(selectedTournamentIndex, 0), Math.max(tournamentEntries.length - 1, 0));
  const totalPaidOutAmount = payoutBreakdown.events[activeTournamentIndex]?.eventTotal ?? payoutBreakdown.totalPurse;
  const activeTournament = tournamentEntries[activeTournamentIndex] ?? tournamentEntries[0];

  const pendingApprovalGroups = scorekeeperGroupLabels.map((group) => {
    const isReady = hasGroupSubmittedAllHoles(group);
    const isApproved = Boolean(approvedGroups[group]);
    const scorePreviewRows = isReady
      ? buildGroupScorecard(group, scorekeeperGroupLineups[group] ?? [], scorekeeperScoresByHole)
          .map(
            (playerRow) => `
              <tr data-player-score-row data-group="${group}" data-player="${playerRow.player}" data-team="${playerRow.teamName}" tabindex="0" role="button" aria-label="Edit ${playerRow.player} scorecard">
                <th scope="row">${playerRow.player}</th>
                ${playerRow.holeScores
                  .map(
                    (entry) => `<td class="scorecard-cell ${entry.relativeToPar === 0 ? 'scorecard-cell--even' : entry.relativeToPar > 0 ? 'scorecard-cell--positive' : 'scorecard-cell--negative'}">${entry.displayValue}</td>`,
                  )
                  .join('')}
                <td class="scorecard-total ${playerRow.totalRelativeToPar === 0 ? 'scorecard-cell--even' : playerRow.totalRelativeToPar > 0 ? 'scorecard-cell--positive' : 'scorecard-cell--negative'}">${playerRow.displayTotal}</td>
              </tr>
            `,
          )
          .join('')
      : '';

    const teamNames = (scorekeeperGroupLineups[group] ?? []).map((entry) => entry.teamName);

    return {
      group,
      scorekeeper: scorekeeperAssignments[group] ?? 'Unassigned',
      status: isApproved ? 'Approved' : isReady ? 'Awaiting approval' : 'Pending scorekeeper',
      isReady,
      isApproved,
      scorePreviewRows,
      teamNames,
    };
  });

  const firstUnapprovedGroup = pendingApprovalGroups.find((group) => !group.isApproved)?.group ?? pendingApprovalGroups[0]?.group ?? '';
  const selectedGroup = pendingApprovalGroups.some((group) => group.group === selectedApprovalGroup && !group.isApproved)
    ? selectedApprovalGroup
    : firstUnapprovedGroup;
  if (selectedGroup) {
    selectedApprovalGroup = selectedGroup;
  }

  const activeGroup = pendingApprovalGroups.find((group) => group.group === selectedApprovalGroup) ?? pendingApprovalGroups[0];

  return `
    <section class="panel">
      <div class="section-header-row">
        <div>
          <p class="eyebrow">Admin</p>
          <h2>Approve scores</h2>
        </div>
        <span class="tee-time-badge">Review</span>
      </div>

      <div class="group-grid group-grid--single">
        ${pendingApprovalGroups
          .map(
            (group) => `
              <button
                type="button"
                class="secondary-button ${group.group === selectedApprovalGroup ? 'is-active' : ''}"
                data-select-approval-group="${group.group}"
                ${group.isApproved ? 'disabled aria-disabled="true"' : ''}
              >
                ${group.group}
                <span class="menu-detail">${group.status}</span>
              </button>
            `,
          )
          .join('')}
      </div>

      ${activeGroup ? `
        <div class="group-card" style="margin-top: 18px;">
          <h3>${activeGroup.group}</h3>
          <p class="role-access-note">${activeTournament?.result?.name ?? 'Tournament'} · ${activeTournament?.date ?? ''}</p>
          <p class="role-access-note">${activeGroup.scorekeeper}</p>
          <div class="payout-meta">${activeGroup.status}</div>
          <div style="margin-top: 0.75rem;">
            <p class="role-access-note">Teams in this group</p>
            <ul class="list-block" style="margin-top: 0.5rem; padding-left: 1rem;">
              ${activeGroup.teamNames.map((teamName) => `<li>${teamName}</li>`).join('')}
            </ul>
          </div>
          ${activeGroup.isReady ? `
            <div class="scorecard-summary-wrap scorecard-summary-wrap--compact">
              <table class="scorecard-table scorecard-table--compact">
                <thead>
                  <tr>
                    <th scope="col">Player</th>
                    ${Array.from({ length: 18 }, (_, index) => `<th scope="col">${index + 1}</th>`).join('')}
                    <th scope="col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${activeGroup.scorePreviewRows}
                </tbody>
              </table>
            </div>
          ` : '<div class="payout-meta">No submitted card yet.</div>'}
          <button type="button" class="secondary-button" data-approve-group="${activeGroup.group}" ${!activeGroup.isReady || activeGroup.isApproved ? 'disabled aria-disabled="true"' : ''}>${activeGroup.isApproved ? 'Approved' : 'Approve scores'}</button>
        </div>
      ` : ''}

      ${allGroupsApproved ? `
        <div class="group-card" style="margin-top: 18px;">
          <div style="margin-top: 1rem;">
            <p class="role-access-note">Team finish order</p>
            <div style="margin-top: 0.75rem;">
              ${(() => {
                const topTiedScores = getTeamFinishEntries().reduce((best, entry) => {
                  const score = entry.score;
                  if (!best.length) {
                    return [score];
                  }
                  if (score === best[0]) {
                    best.push(score);
                  }
                  return best;
                }, [] as number[]);
                const topTiedTeams = getTeamFinishEntries().filter((entry) => topTiedScores.includes(entry.score) && entry.score === Math.min(...topTiedScores));

                const shouldShowPlayoffInputs = !teamFinishOrderConfirmed && topTiedTeams.length > 1;

                return shouldShowPlayoffInputs
                  ? `
                    <div style="display: grid; gap: 0.75rem; margin-bottom: 0.75rem;">
                      ${topTiedTeams
                        .map(
                          (entry) => `
                            <label style="display: inline-flex; align-items: center; justify-content: space-between; gap: 0.75rem; font-size: 0.9rem; color: white;">
                              <span style="color: white;">${entry.teamName} — ${getTeamScoreLabel(entry.teamName)}${Number.isFinite(entry.playoffDistance) && entry.playoffDistance !== Number.POSITIVE_INFINITY ? ` --- ${entry.playoffDistance}` : ''}</span>
                              <input type="number" min="0" step="1" data-playoff-distance-team="${entry.teamName}" value="${Number.isFinite(entry.playoffDistance) ? entry.playoffDistance : 0}" style="width: 110px; color: white; background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2);" />
                            </label>
                          `,
                        )
                        .join('')}
                    </div>
                    <button type="button" class="primary-button" data-submit-playoff-winner="true">Submit playoff winner</button>
                  `
                  : teamFinishOrderConfirmed
                    ? '<div class="payout-meta" style="margin-bottom: 0.75rem;">Final order confirmed.</div>'
                    : '';
              })()}
            </div>
            <ol class="standings-list" style="padding-left: 1.25rem; margin-top: 0.5rem;">
              ${visibleTeamFinishOrder
                .map(
                  (teamName, index) => `
                    <li style="margin-bottom: 0.35rem;">${getTeamFinishDisplayLabel(teamName, { finishPosition: index + 1, includePlacementPayout: teamFinishOrderConfirmed, eventIndex: selectedTournamentIndex })}</li>
                  `,
                )
                .join('')}
            </ol>
            ${!teamFinishOrderConfirmed
              ? '<button type="button" class="primary-button" style="margin-top: 0.75rem;" data-confirm-team-finish-order="true">Confirm order</button>'
              : `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 0.75rem; flex-wrap: wrap;">
                  <div class="payout-meta">Order confirmed</div>
                  <div class="payout-meta" style="font-weight: 600; color: white;">Total paid out for this event: $${totalPaidOutAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              `}
          </div>
        </div>
      ` : ''}

      <dialog id="score-edit-modal" aria-labelledby="score-edit-title">
        <form method="dialog" data-action="edit-player-score" class="panel" style="padding: 1.25rem; min-width: min(420px, 90vw);">
          <div class="section-header-row">
            <div>
              <p class="eyebrow">Score fix</p>
              <h3 id="score-edit-title">Score fix</h3>
            </div>
            <button type="button" class="secondary-button" data-close-score-edit="true">Close</button>
          </div>
          <div id="score-edit-player-meta" class="role-access-note" style="margin-bottom: 0.5rem;"></div>
          <div id="score-edit-current-value" class="role-access-note" style="margin-bottom: 1rem;"></div>
          <label>
            <span>Hole number</span>
            <div class="plus-minus-control" data-score-edit-hole>
              <button type="button" class="plus-minus-button" data-action="decrement-hole-edit" aria-label="Previous hole">−</button>
              <input type="number" name="scoreHole" min="1" max="18" value="1" />
              <button type="button" class="plus-minus-button" data-action="increment-hole-edit" aria-label="Next hole">+</button>
            </div>
          </label>
          <label>
            <span>Hole score</span>
            <div class="plus-minus-control" data-score-edit-value>
              <button type="button" class="plus-minus-button" data-action="decrement-score-edit" aria-label="Decrease hole value">−</button>
              <input type="text" name="scoreValue" value="E" placeholder="E, +2, -1" />
              <button type="button" class="plus-minus-button" data-action="increment-score-edit" aria-label="Increase hole value">+</button>
            </div>
          </label>
          <input type="hidden" name="scoreGroup" />
          <input type="hidden" name="scorePlayer" />
          <input type="hidden" name="scoreTeam" />
          <div class="action-row" style="margin-top: 1rem;">
            <button type="submit" class="primary-button">Save score</button>
            <button type="button" class="secondary-button" data-close-score-edit="true">Cancel</button>
          </div>
        </form>
      </dialog>

      <dialog id="score-review-modal" aria-labelledby="score-review-title">
        <div class="panel" style="padding: 1.25rem; min-width: min(460px, 90vw);">
          <div class="section-header-row">
            <div>
              <p class="eyebrow">Confirm score</p>
              <h3 id="score-review-title">Player score review</h3>
            </div>
            <button type="button" class="secondary-button" data-close-score-review="true">Close</button>
          </div>
          <div id="score-review-content"></div>
          <div class="action-row" style="margin-top: 1rem;">
            <button type="button" class="primary-button" data-confirm-score-review="true">Confirm score</button>
            <button type="button" class="secondary-button" data-close-score-review="true">Back to edit</button>
          </div>
        </div>
      </dialog>

      <div class="action-row" style="margin-top: 18px;">
        <button type="button" class="primary-button" data-seed-all-group-scores="true">Seed all group scores</button>
        <button type="button" class="primary-button" data-approve-all-scores="true" ${!allGroupsSubmitted ? 'disabled aria-disabled="true"' : ''}>Approve all scores</button>
        <button type="button" class="secondary-button" data-reset-scorekeeper-state="true">Reset mock scorekeeper state</button>
        <button type="button" class="secondary-button" data-reset-all-mock-data="true">Reset all mock data</button>
      </div>
    </section>
  `;
};

const refreshScoreEditModalFromSelection = (form: HTMLFormElement): void => {
  const groupInput = form.querySelector('input[name="scoreGroup"]') as HTMLInputElement | null;
  const playerInput = form.querySelector('input[name="scorePlayer"]') as HTMLInputElement | null;
  const teamInput = form.querySelector('input[name="scoreTeam"]') as HTMLInputElement | null;
  const holeInput = form.querySelector('input[name="scoreHole"]') as HTMLInputElement | null;
  const valueInput = form.querySelector('input[name="scoreValue"]') as HTMLInputElement | null;
  const currentValueText = document.querySelector('#score-edit-current-value');

  if (!groupInput || !playerInput || !teamInput || !holeInput || !valueInput) {
    return;
  }

  const groupName = groupInput.value;
  const playerName = playerInput.value;
  const teamName = teamInput.value;
  const parsedHoleNumber = Number.parseInt(holeInput.value, 10);
  const holeNumber = Number.isFinite(parsedHoleNumber) ? Math.min(Math.max(parsedHoleNumber, 1), 18) : 1;

  if (!groupName || !playerName || !teamName) {
    return;
  }

  if (!Number.isFinite(parsedHoleNumber)) {
    holeInput.value = '1';
  } else if (holeNumber !== parsedHoleNumber) {
    holeInput.value = String(holeNumber);
  }

  const displayedValue = getDisplayedHoleValueForPlayer(
    groupName,
    teamName,
    playerName,
    holeNumber,
    scorekeeperGroupLineups[groupName] ?? [],
    scorekeeperScoresByHole,
  );

  valueInput.value = displayedValue;
  if (currentValueText) {
    currentValueText.textContent = `Hole ${holeNumber} was ${displayedValue}`;
  }
};

const renderScorekeeperDashboard = (): string => {
  const currentUser = getCurrentUser();
  const assignedCount = Object.values(scorekeeperAssignments).filter(Boolean).length;
  const pendingAssignments = scorekeeperGroupLabels.filter((group) => !scorekeeperAssignments[group]);
  const totalHoles = 18;
  const teamFinishOrder = getOrderedTeamFinishList();

  if (selectedDashboardFilter === 'Standings') {
    return `
      <section class="panel">
        <div class="section-header-row">
          <div>
            <p class="eyebrow">Standings</p>
            <h2>Order of finish</h2>
          </div>
          <span class="tee-time-badge">Teams</span>
        </div>
        <ol class="standings-list" style="padding-left: 1.5rem; margin-top: 0.75rem;">
          ${teamFinishOrder
            .map(
              (teamName, index) => `
                <li style="margin-bottom: 0.5rem;">${getTeamFinishDisplayLabel(teamName, { finishPosition: index + 1, includePlacementPayout: teamFinishOrderConfirmed, eventIndex: selectedTournamentIndex })}</li>
              `,
            )
            .join('')}
        </ol>
      </section>
    `;
  }
  const currentHoleNumber = currentScoringHoleIndex + 1;
  const isFinalHole = currentHoleNumber >= totalHoles;
  const selectedCourse = getSelectedCourse();
  const activeHole = selectedCourse.getHoleForRoundNumber(Math.min(Math.max(currentHoleNumber, 1), totalHoles));
  const assignedGroup = getAssignedGroupForUser(currentUser);
  const coverageSummary = assignedGroup
    ? `${assignedGroup} — ${scorekeeperAssignments[assignedGroup] ?? 'Unassigned'}`
    : scorekeeperGroupLabels
        .map((group) => `${group} ${scorekeeperAssignments[group] ?? 'Unassigned'}`)
        .join(' · ');
  const holeDetailsSummary = `${activeHole.name} · ${activeHole.getDistanceLabel()} · ${activeHole.basketSetup}`;
  const isAssignedScorekeeper = currentUser.hasRole('scorekeeper') && !!assignedGroup;
  const isScorekeeperScoringView = scorekeeperScoringStage === 'scoring' || selectedDashboardFilter === 'Scorekeeper scorecard' || isAssignedScorekeeper;

  if (scorekeeperScoringStage === 'complete') {
    const completedGroup = assignedGroup ?? scorekeeperGroupLabels[0] ?? 'Group A';
    const completedGroupLineups = scorekeeperGroupLineups[completedGroup] ?? [];
    const completedScorecard = buildGroupScorecard(completedGroup, completedGroupLineups, scorekeeperScoresByHole);
    const scorecardTableMarkup = completedScorecard
      .map(
        (playerRow) => `
          <tr>
            <th scope="row">${playerRow.player}</th>
            ${playerRow.holeScores
              .map(
                (entry) => `<td class="scorecard-cell ${entry.relativeToPar === 0 ? 'scorecard-cell--even' : entry.relativeToPar > 0 ? 'scorecard-cell--positive' : 'scorecard-cell--negative'}">${entry.displayValue}</td>`,
              )
              .join('')}
            <td class="scorecard-total ${playerRow.totalRelativeToPar === 0 ? 'scorecard-cell--even' : playerRow.totalRelativeToPar > 0 ? 'scorecard-cell--positive' : 'scorecard-cell--negative'}">${playerRow.displayTotal}</td>
          </tr>
        `,
      )
      .join('');

    return `
      <section class="panel">
        <div class="section-header-row">
          <div>
            <p class="eyebrow">Scorekeeper assignment</p>
            <h2>Round complete</h2>
          </div>
          <span class="tee-time-badge">Saved</span>
        </div>

        <p class="role-access-note">${completedGroup} — ${scorekeeperAssignments[completedGroup] ?? 'Unassigned'} · All 18 holes submitted.</p>

        <div class="scorecard-summary-wrap">
          <table class="scorecard-table">
            <thead>
              <tr>
                <th scope="col">Player</th>
                ${Array.from({ length: 18 }, (_, index) => `<th scope="col">${index + 1}</th>`).join('')}
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              ${scorecardTableMarkup}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  const getRunningParTotal = (playerKey: string): number => {
    return Object.values(scorekeeperScoresByHole).reduce((runningTotal, holeScores) => {
      const rawValue = holeScores[playerKey];
      if (!rawValue) {
        return runningTotal;
      }

      const parsedValue = Number.parseInt(String(rawValue), 10) || 3;
      return runningTotal + (parsedValue - 3);
    }, 0);
  };

  if (isScorekeeperScoringView) {
    const groups = scorekeeperGroupLabels
      .filter((group) => !assignedGroup || group === assignedGroup)
      .map((group) => {
        const lineups = scorekeeperGroupLineups[group] ?? [];
        const teamMarkup = lineups
          .map(
            (lineup) => `
              <div class="score-team-block">
                <strong>${lineup.teamName}</strong>
                <div class="player-score-grid">
                  ${lineup.players
                    .map((player) => {
                      const key = `${group}|${lineup.teamName}|${player}`;
                      const rawValue = scorekeeperScoresByHole[currentScoringHoleIndex]?.[key] ?? '+3';
                      const currentHoleDisplay = /^[-+]?\d+$/.test(String(rawValue)) ? String(rawValue) : '+3';
                      const runningParTotal = getRunningParTotal(key);
                      const displayValue = runningParTotal === 0 ? 'E' : `${runningParTotal > 0 ? '+' : ''}${runningParTotal}`;
                      const valueClass = runningParTotal === 0 ? 'score-indicator--even' : runningParTotal > 0 ? 'score-indicator--positive' : 'score-indicator--negative';
                      return `
                        <label class="player-score-entry">
                          <span class="player-name-with-score">
                            <span>${player}</span>
                            <span class="score-indicator ${valueClass}">${displayValue}</span>
                          </span>
                          <div class="plus-minus-control" data-score-key="${key}">
                            <button type="button" class="plus-minus-button" data-action="decrement-score" data-score-key="${key}" aria-label="Decrease ${player} score">−</button>
                            <span class="score-output" data-score-output="${key}">${currentHoleDisplay}</span>
                            <input type="hidden" name="player-score-${group}|${lineup.teamName}|${player}" value="${rawValue}" />
                            <button type="button" class="plus-minus-button" data-action="increment-score" data-score-key="${key}" aria-label="Increase ${player} score">+</button>
                          </div>
                        </label>
                      `;
                    })
                    .join('')}
                </div>
              </div>
            `,
          )
          .join('');

        return {
          name: group,
          scorekeeper: scorekeeperAssignments[group] ?? 'Unassigned',
          teamMarkup,
        };
      });

    return `
      <section class="panel">
        <div class="section-header-row">
          <div>
            <p class="eyebrow">Scorekeeper</p>
            <h2>${isFinalHole ? 'Final hole' : 'Hole-by-hole scoring'}</h2>
          </div>
          <span class="tee-time-badge">${isFinalHole ? 'Final hole' : `Hole ${currentHoleNumber}/${totalHoles}`}</span>
        </div>

        <form data-action="scorekeeper-scoring" class="scorekeeper-scoring-form">
          <div class="score-hole-summary">
            <div><strong>Hole:</strong> ${currentHoleNumber}/${totalHoles}</div>
            <div><strong>Hole details:</strong> ${holeDetailsSummary}</div>
            <div><strong>Round progress:</strong> ${isFinalHole ? 'Final hole' : `Hole ${currentHoleNumber} of ${totalHoles}`}</div>
            <div><strong>Coverage:</strong> ${coverageSummary}</div>
          </div>

          <div class="group-assignment-grid">
            ${groups
              .map(
                (group) => `
                  <div class="assignment-row score-group-card">
                    <div class="score-group-header">
                      <div>
                        <span class="score-group-label">${group.name}</span>
                        <span class="assignment-operator">${group.scorekeeper}</span>
                      </div>
                    </div>
                    <div class="score-team-detail">
                      ${group.teamMarkup}
                    </div>
                  </div>
                `,
              )
              .join('')}
          </div>

          <div class="action-row">
            ${currentScoringHoleIndex > 0 ? '<button type="submit" data-score-direction="previous" class="secondary-button">Back</button>' : ''}
            <button type="submit" data-score-direction="next">${isFinalHole ? 'Submit final hole' : 'Submit Scores & Move to next hole'}</button>
          </div>
        </form>
      </section>
    `;
  }


  const pipelineStats = [
    { label: 'Assigned', value: String(assignedCount) },
    { label: 'Groups left', value: String(pendingAssignments.length) },
    { label: 'Round', value: '18 holes' },
  ];

  return `
    <section class="panel">
      <div class="section-header-row">
        <div>
          <p class="eyebrow">Scorekeeper assignment</p>
          <h2>Assign a scorekeeper per group</h2>
        </div>
        <span class="tee-time-badge">Live</span>
      </div>

      <div class="stat-list">
        ${pipelineStats
          .map(
            (stat) => `
              <div class="stat-tile">
                <strong>${stat.value}</strong>
                <span>${stat.label}</span>
              </div>
            `,
          )
          .join('')}
      </div>

      <div class="assignment-summary" style="margin-top: 12px;">
        <strong>Coverage:</strong> ${coverageSummary}
      </div>

      <form data-action="scorekeeper-assignment" class="assignment-form">
        <div class="group-assignment-grid">
          ${scorekeeperGroupLabels
            .map(
              (group) => `
                <label class="assignment-row">
                  <span>${group}</span>
                  <select name="${group}">
                    <option value="">Select a scorekeeper</option>
                    ${scorekeeperStaff
                      .map(
                        (person) => `
                          <option value="${person}" ${scorekeeperAssignments[group] === person ? 'selected' : ''}>${person}</option>
                        `,
                      )
                      .join('')}
                  </select>
                </label>
              `,
            )
            .join('')}
        </div>

        <div class="action-row">
          <button type="submit" ${pendingAssignments.length ? '' : 'data-action="start-scorekeeper-scoring"'}>
            ${pendingAssignments.length ? 'Assign all groups' : 'Begin hole-by-hole scoring'}
          </button>
        </div>
      </form>
    </section>
  `;
};

const getSelectedCourse = () => {
  const courseOptions = seed.courseOptions?.length ? seed.courseOptions : [seed.course];
  return courseOptions.find((course) => course.id === selectedCourseId) ?? courseOptions[0] ?? seed.course;
};

const getSelectedCourseNineHoles = (course: { getHoles: () => readonly any[] }) => {
  const holes = course.getHoles();
  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9, 18);

  if (selectedCourseNine === 'back' && backNine.length > 0) {
    return backNine;
  }

  return frontNine.length > 0 ? frontNine : holes;
};

const draftIcons: Record<string, string> = {
  clock: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  round: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`,
  pick: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 13 4 4L20 5"/></svg>`,
  user: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a7 7 0 0 1 14 0v1"/></svg>`,
  star: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.9 6.7 19.7l1.1-6.1L3.4 9.4l6-.8Z"/></svg>`,
  disc: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="5"/><ellipse cx="12" cy="12" rx="4" ry="2"/></svg>`,
  list: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.3"/><circle cx="3.5" cy="12" r="1.3"/><circle cx="3.5" cy="18" r="1.3"/></svg>`,
  lock: `<svg class="draft-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`,
};

const renderFantasyDraftPanel = (): string => {
  const seedControls = `
    <div class="action-row" style="margin-top: 18px;">
      <button type="button" class="primary-button" data-seed-scored-event="true">Seed scored event + draft</button>
      <button type="button" class="primary-button" data-seed-fantasy-draft="true">Seed fantasy draft</button>
      <button type="button" class="primary-button" data-advance-draft="1" ${fantasyDraftSeries ? '' : 'disabled aria-disabled="true"'}>Draft next pick</button>
      <button type="button" class="primary-button" data-advance-draft="12" ${fantasyDraftSeries ? '' : 'disabled aria-disabled="true"'}>Seed rounds 1 &amp; 2</button>
      <button type="button" class="primary-button" data-advance-draft="24" ${fantasyDraftSeries ? '' : 'disabled aria-disabled="true"'}>Complete draft</button>
      <button type="button" class="secondary-button" data-reset-fantasy-draft="true">Reset fantasy draft</button>
    </div>
  `;

  const room = getSelectedDraftRoom();

  if (!fantasyDraftSeries || !room) {
    const remaining = getScheduledTournamentIds().length - selectedTournamentIndex;

    return `
      <section class="panel">
        <div class="section-header-row">
          <div>
            <p class="eyebrow">Draft controls</p>
            <h2>Fantasy draft not seeded</h2>
          </div>
          <span class="tee-time-badge">Idle</span>
        </div>
        <p class="role-access-note">
          Seeding drops ${getDraftDisplayName(fantasyDraftOwnerId)} plus five participants into the lobby and builds
          one snake draft per remaining tournament (${remaining} left from the event in view).
        </p>
        ${seedControls}
      </section>
    `;
  }

  const onTheClock = room.getParticipantOnTheClock();
  const status = room.getStatus();
  const selectable = onTheClock ? room.getSelectablePlayers(onTheClock) : [];
  const available = room.getAvailablePlayers();
  const selectableIds = new Set(selectable.map((player) => player.id));
  const recommended = onTheClock ? getRecommendedPick(room, onTheClock) : undefined;

  const totalPicks = available.length + room.getPicks().length;

  const stats = [
    { label: 'Round', value: `${room.getCurrentRound()} of ${room.rounds}`, icon: draftIcons.round },
    { label: 'Pick', value: `${Math.min(room.getPicks().length + 1, totalPicks)} of ${totalPicks}`, icon: draftIcons.pick },
    { label: 'On the clock', value: onTheClock ? getDraftDisplayName(onTheClock) : 'Draft complete', icon: draftIcons.user },
    { label: 'Pick timer', value: `${room.getTimerSeconds()}s`, icon: draftIcons.clock, isClock: true },
  ];

  const nextUp = room.getNextParticipant();

  const onTheClockBanner = onTheClock
    ? `
      <div class="draft-clock-banner ${status === 'inProgress' ? 'is-live' : ''}">
        <div>
          <p class="eyebrow">${draftIcons.round} Round ${room.getCurrentRound()} · Pick ${room.getPicks().length + 1}</p>
          <h3>${draftIcons.user} ${getDraftDisplayName(onTheClock)} is on the clock</h3>
          <p class="role-access-note">
            ${status === 'pending'
              ? 'Press Start draft to run the clock.'
              : draftAutoPickEnabled
                ? `Pick from the board below, or ${recommended ? recommended.displayName : 'the top pro'} is taken automatically at 0s.`
                : 'Auto-pick is off — the clock will stall at 0s until someone picks.'}
          </p>
          ${nextUp ? `<p class="draft-next-up">${draftIcons.list} Next up: <strong>${getDraftDisplayName(nextUp)}</strong></p>` : ''}
        </div>
        <div class="draft-clock-face">
          <strong class="draft-clock-value">${room.getTimerSeconds()}s</strong>
          <span>remaining</span>
        </div>
      </div>
      ${recommended
        ? `
          <div class="draft-recommendation">
            ${draftIcons.star}
            <div>
              <p class="eyebrow">Recommended pro</p>
              <strong>${recommended.displayName}</strong>
              <span>${recommended.gender === 'male' ? 'MPO' : 'FPO'} · ${getDraftTeamName(recommended.id)} · rating ${getDraftRating(recommended)}</span>
            </div>
            <button type="button" class="primary-button" data-draft-pick="${recommended.id}">${draftIcons.disc} Draft ${recommended.displayName}</button>
          </div>
        `
        : ''}
    `
    : '';

  const pickLog = room.getPicks().length
    ? `
      <div class="assignment-summary" style="margin-top: 12px;">
        <strong>${draftIcons.list} Picks so far</strong>
        <ol class="draft-pick-log">
          ${[...room.getPicks()]
            .reverse()
            .map(
              (pick) => `
                <li>
                  <span class="draft-pick-slot">R${pick.round} · P${pick.pickNumber}</span>
                  <strong>${getDraftDisplayName(pick.participantId)}</strong>
                  <span class="draft-pick-player draft-pick-player--${pick.player.gender}">${pick.player.displayName} (${pick.player.gender === 'male' ? 'MPO' : 'FPO'})</span>
                  <span class="draft-pick-source draft-pick-source--${autoPickedNumbers.has(pick.pickNumber) ? 'auto' : 'manual'}">${autoPickedNumbers.has(pick.pickNumber) ? 'auto' : 'manual'}</span>
                </li>
              `,
            )
            .join('')}
        </ol>
      </div>
    `
    : '';

  const draftBoard = status === 'complete' || room.isLocked()
    ? ''
    : `
      <p class="role-access-note" style="margin-top: 16px;">
        <strong>Board for ${getDraftDisplayName(onTheClock as string)}</strong>
        ${recommended ? ` — recommended: ${recommended.displayName} (rating ${getDraftRating(recommended)})` : ''}
      </p>
      <div class="draft-board">
        ${[...available]
          .sort((left, right) => getDraftRating(right) - getDraftRating(left))
          .map((player) => {
            const isSelectable = selectableIds.has(player.id);
            const isRecommended = recommended?.id === player.id;

            return `
              <button
                type="button"
                class="draft-player draft-player--${player.gender} ${isSelectable ? '' : 'draft-player--blocked'} ${isRecommended ? 'draft-player--recommended' : ''}"
                data-draft-pick="${player.id}"
                ${isSelectable ? '' : 'disabled aria-disabled="true"'}
                title="${isSelectable ? 'Draft this player' : `Roster already full at ${player.gender}`}"
              >
                <strong>${isRecommended ? draftIcons.star : isSelectable ? draftIcons.disc : draftIcons.lock} ${player.displayName}</strong>
                <span>${player.gender === 'male' ? 'MPO' : 'FPO'} · ${getDraftTeamName(player.id)}</span>
                <span>Rating ${getDraftRating(player)}${isRecommended ? ' · recommended' : ''}</span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;

  const runControls = `
    <div class="action-row" style="margin-top: 16px;">
      <button type="button" class="primary-button" data-start-fantasy-draft="true" ${status === 'pending' ? '' : 'disabled aria-disabled="true"'}>
        ${status === 'pending' ? 'Start draft' : status === 'complete' ? 'Draft complete' : 'Clock running'}
      </button>
      <button type="button" class="secondary-button" data-toggle-draft-autopick="true">
        Auto-pick on expiry: ${draftAutoPickEnabled ? 'On' : 'Off'}
      </button>
      ${[7, 15, 30, 60]
        .map(
          (seconds) => `
            <button type="button" class="${room.getTimerSeconds() === seconds ? 'primary-button' : 'secondary-button'}" data-draft-timer="${seconds}">${seconds}s</button>
          `,
        )
        .join('')}
    </div>
  `;

  // Ranked on mock rating until real tournament results exist to score against.
  const proScores = getConfirmedProScores(room.tournamentId);

  const describePlayer = (player: { displayName: string }): string => {
    const score = proScores?.get(player.displayName);
    return score === undefined
      ? player.displayName
      : `${player.displayName} <span class="draft-finish-tag">${formatRelativeToPar(score)}</span>`;
  };

  const leaderboardRows = room.order
    .map((participantId) => {
      const roster = room.getRoster(participantId);

      return {
        participantId,
        roster,
        total: roster.reduce((sum, player) => sum + (proScores?.get(player.displayName) ?? 0), 0),
        projected: roster.reduce((sum, player) => sum + getDraftRating(player), 0),
      };
    })
    // Lowest total wins once real scores are in; before that, best projected roster leads.
    .sort((left, right) => (proScores ? left.total - right.total : right.projected - left.projected));

  const leaderboard = status !== 'complete' && !room.isLocked()
    ? ''
    : `
      <div class="section-header-row" style="margin-top: 20px;">
        <div>
          <p class="eyebrow">${draftIcons.star} Final rosters</p>
          <h3>Fantasy team leaderboard</h3>
        </div>
        <span class="tee-time-badge">${proScores ? getTournamentName(room.tournamentId) : 'Projected'}</span>
      </div>

      <p class="role-access-note">
        ${proScores
          ? 'Every pro carries their own round score onto the fantasy roster that drafted them. Lowest four-player total wins.'
          : 'Not scored yet — an admin has to confirm the team finish order for this event. Showing mock draft ratings until then.'}
      </p>

      <table class="draft-leaderboard">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Fantasy team</th>
            <th scope="col">MPO</th>
            <th scope="col">FPO</th>
            <th scope="col">${proScores ? 'Total' : 'Projected'}</th>
          </tr>
        </thead>
        <tbody>
          ${leaderboardRows
            .map(
              (entry, index) => `
                <tr class="${index === 0 ? 'draft-leaderboard-leader' : ''}">
                  <td>${index === 0 ? draftIcons.star : ''} ${index + 1}</td>
                  <th scope="row">${getDraftDisplayName(entry.participantId)}</th>
                  <td class="draft-pick-player--male">${entry.roster
                    .filter((player) => player.gender === 'male')
                    .map((player) => describePlayer(player))
                    .join(', ')}</td>
                  <td class="draft-pick-player--female">${entry.roster
                    .filter((player) => player.gender === 'female')
                    .map((player) => describePlayer(player))
                    .join(', ')}</td>
                  <td class="draft-leaderboard-score">${proScores ? formatRelativeToPar(entry.total) : entry.projected}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    `;

  // Once a room is done the live controls are noise; the leaderboard is the whole story.
  const liveSections = status === 'complete' || room.isLocked()
    ? ''
    : `
      <div class="stat-list">
        ${stats
          .map(
            (stat) => `
              <div class="stat-tile stat-tile--icon">
                ${stat.icon}
                <strong ${stat.isClock ? 'class="draft-clock-value"' : ''}>${stat.value}</strong>
                <span>${stat.label}</span>
              </div>
            `,
          )
          .join('')}
      </div>

      ${onTheClockBanner}

      ${runControls}

      <div class="group-assignment-grid" style="margin-top: 16px;">
        ${room.order
          .map((participantId) => {
            const roster = room.getRoster(participantId);
            const males = room.getGenderCount(participantId, 'male');
            const females = room.getGenderCount(participantId, 'female');

            return `
              <div class="stat-tile draft-roster-tile ${participantId === onTheClock ? 'draft-roster-tile--on-the-clock' : ''} ${participantId === nextUp ? 'draft-roster-tile--next' : ''}">
                <strong>${draftIcons.user} ${getDraftDisplayName(participantId)}</strong>
                <span class="draft-roster-turn">${participantId === onTheClock ? `${draftIcons.clock} On the clock` : participantId === nextUp ? `${draftIcons.round} Next up` : `${draftIcons.pick} ${roster.length} of ${room.rounds} drafted`}</span>
                <span class="draft-slot-row">
                  ${Array.from({ length: room.rounds })
                    .map((_, slot) => {
                      const player = roster[slot];
                      return `<span class="draft-slot ${player ? `draft-slot--${player.gender}` : 'draft-slot--empty'}" title="${player ? player.displayName : 'Open slot'}"></span>`;
                    })
                    .join('')}
                </span>
                <span>${males}M / ${females}F</span>
                <span>${roster.length ? roster.map((player) => player.displayName).join(', ') : 'No picks yet'}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;

  return `
    <section class="panel">
      <div class="section-header-row">
        <div>
          <p class="eyebrow">Draft controls</p>
          <h2>${getTournamentName(room.tournamentId)} draft</h2>
        </div>
        <span class="tee-time-badge">${status === 'complete' ? 'Complete' : status === 'inProgress' ? 'Live' : 'Ready'}</span>
      </div>

      ${room.isLocked()
        ? `<p class="role-access-note draft-locked-note">${draftIcons.lock} Picks are closed — ${getTournamentName(room.tournamentId)} has started.</p>`
        : ''}

      <div class="action-row" style="margin-bottom: 12px;">
        ${fantasyDraftSeries
          .getRooms()
          .map((entry) => {
            const isComplete = entry.getStatus() === 'complete';
            const isActive = entry.tournamentId === room.tournamentId;

            return `
              <button
                type="button"
                class="${isActive ? 'primary-button' : 'secondary-button'} draft-tab ${isComplete ? 'draft-tab--complete' : ''}"
                data-draft-tournament="${entry.tournamentId}"
                title="${isComplete ? 'Draft complete' : 'Draft still open'}"
              >${isComplete ? draftIcons.lock : draftIcons.disc} ${getTournamentName(entry.tournamentId)}</button>
            `;
          })
          .join('')}
      </div>

      ${liveSections}

      ${draftBoard}

      ${leaderboard}

      ${renderFantasyStandings()}

      ${pickLog}

      ${seedControls}
    </section>
  `;
};

// Fantasy rosters come from the draft picks, so a participant only scores what they drafted.
const getFantasyRosterEntries = (): FantasyRosterEntry[] => {
  const rooms = fantasyDraftSeries?.getRooms() ?? [];
  const byParticipant = new Map<string, string[]>();

  rooms.forEach((room) => {
    room.getPicks().forEach((pick) => {
      byParticipant.set(pick.participantId, [...(byParticipant.get(pick.participantId) ?? []), pick.player.displayName]);
    });
  });

  return [...byParticipant.entries()].map(([participantId, playerNames]) => ({ participantId, playerNames }));
};

const renderFantasyStandings = (): string => {
  const rosters = getFantasyRosterEntries();
  const confirmedTournamentIds = getScheduledTournamentIds().filter((tournamentId) => confirmedEventScores[tournamentId]);

  if (rosters.length === 0) {
    return `
      <div class="assignment-summary" style="margin-top: 12px;">
        <strong>Fantasy standings</strong>
        <p class="role-access-note">Run the draft first — standings are built from drafted pros.</p>
      </div>
    `;
  }

  if (confirmedTournamentIds.length === 0) {
    return `
      <div class="assignment-summary" style="margin-top: 12px;">
        <strong>Fantasy standings</strong>
        <p class="role-access-note">Waiting on the league admin. Fantasy scores post only after an event is approved.</p>
      </div>
    `;
  }

  const events = confirmedTournamentIds.map((tournamentId) => getConfirmedProScores(tournamentId) ?? new Map<string, number>());
  const standings = FantasyScoring.scoreSeason(rosters, events);

  return `
    <div class="assignment-summary" style="margin-top: 12px;">
      <strong>Fantasy standings</strong>
      <p class="role-access-note">From ${confirmedTournamentIds.length} approved event${confirmedTournamentIds.length === 1 ? '' : 's'}.</p>
      <ol class="draft-pick-log">
        ${standings
          .map(
            (standing, index) => `
              <li>
                <span class="draft-pick-slot">${index + 1}</span>
                <strong>${escapeHtml(getDraftDisplayName(standing.participantId))}</strong>
                <span class="draft-pick-player">${formatRelativeToPar(standing.total)} · ${standing.scoredPlayers} scored pro${standing.scoredPlayers === 1 ? '' : 's'}</span>
              </li>
            `,
          )
          .join('')}
      </ol>
    </div>
  `;
};

const findProContext = (user: UserProfile) => {
  const team = getTeamSummaries(seed).find((entry) =>
    entry.players.some((player) => player.displayName === user.displayName),
  );
  const player = team?.players.find((entry) => entry.displayName === user.displayName);
  return team && player ? { team, player } : null;
};

const renderPostMedia = (submission: ContentSubmission): string => {
  if (!submission.media) {
    return '';
  }

  return submission.media.kind === 'video'
    ? `<video class="post-media" src="${submission.media.url}" controls playsinline></video>`
    : `<img class="post-media" src="${submission.media.url}" alt="${escapeHtml(submission.media.name) || 'Posted photo'}" />`;
};

const POST_STATUS_LABELS: Record<ContentStatus, string> = {
  pending: 'Pending league review',
  approved: 'Published',
  rejected: 'Not approved',
};

const renderProPostPanel = (user: UserProfile): string => {
  const posts = getFanPostsForProfile(user.id);

  return `
    <section class="panel">
      <p class="eyebrow">Fan feed</p>
      <h2>Post content</h2>
      <p class="role-access-note">Updates go to the league for review and appear on your public profile once approved.</p>
      <form data-action="post" data-profile-id="${user.id}" class="post-form">
        <label>
          <span>New update</span>
          <textarea name="content" rows="3" placeholder="Share a practice round note, a highlight, or a fan shoutout."></textarea>
        </label>
        <div class="post-media-row">
          <label class="post-media-button">
            <input type="file" name="photo" accept="image/*" capture="environment" />
            <span>${getMenuIcon('photo')}Photo</span>
          </label>
          <label class="post-media-button">
            <input type="file" name="video" accept="video/*" capture="environment" />
            <span>${getMenuIcon('video')}Video</span>
          </label>
          <label class="post-media-button">
            <input type="file" name="library" accept="image/*,video/*" />
            <span>${getMenuIcon('library')}From library</span>
          </label>
        </div>
        <p class="post-media-status" data-post-media-status>Text only. Attach a photo or video from your phone if you want.</p>
        ${postStatusMessage ? `<p class="post-media-status is-warning">${escapeHtml(postStatusMessage)}</p>` : ''}
        <button type="submit">Submit for review</button>
      </form>
      <ul class="post-list">
        ${posts.length
          ? posts
              .map((post) => {
                const timestamp = post.submittedAt ? new Date(post.submittedAt).toLocaleString() : '';
                return `
                  <li class="post-item">
                    <div class="post-item-header">
                      ${timestamp ? `<p class="post-timestamp">${timestamp}</p>` : '<span></span>'}
                      <span class="post-status post-status--${post.status}">${POST_STATUS_LABELS[post.status]}</span>
                    </div>
                    ${post.text ? `<p>${escapeHtml(post.text)}</p>` : ''}
                    ${renderPostMedia(post)}
                    ${post.reviewNote ? `<p class="post-review-note">League note: ${escapeHtml(post.reviewNote)}</p>` : ''}
                  </li>
                `;
              })
              .join('')
          : '<li class="post-item">No updates posted yet.</li>'}
      </ul>
    </section>
  `;
};

const renderProTeamPanel = (user: UserProfile): string => {
  const context = findProContext(user);

  if (!context) {
    return `
      <section class="panel">
        <p class="eyebrow">Team</p>
        <h2>My team</h2>
        <p class="role-access-note">You are not assigned to a league team yet.</p>
      </section>
    `;
  }

  const { team } = context;

  return `
    <section class="panel">
      <p class="eyebrow">Team</p>
      <h2>${team.name}</h2>
      <div class="team-grid">
        ${team.players
          .map(
            (player) => `
              <article class="player-card">
                <h3>${player.displayName}${player.displayName === user.displayName ? ' (you)' : ''}</h3>
                <p><strong>Division:</strong> ${player.gender === 'male' ? 'MPO' : 'FPO'}</p>
                <p><strong>Email:</strong> ${player.email}</p>
                <a class="secondary-link" href="/pros/${player.routeId}">Open pro profile</a>
              </article>
            `,
          )
          .join('')}
      </div>
      <p class="role-access-note">Current team score: <strong>${getTeamScoreLabel(team.name)}</strong></p>
    </section>
  `;
};

const renderProStatsPanel = (user: UserProfile): string => {
  const events = seed.schedule.getEvents();
  const rows = events
    .map((entry, index) => {
      const scores = getConfirmedProScores(entry.result.id);
      const score = scores?.get(user.displayName);
      return {
        index,
        name: entry.result.name,
        date: entry.date,
        score: typeof score === 'number' ? score : null,
      };
    })
    .filter((row) => row.score !== null);

  const seasonTotal = rows.reduce((sum, row) => sum + (row.score ?? 0), 0);

  return `
    <section class="panel">
      <p class="eyebrow">Performance</p>
      <h2>My stats</h2>
      ${rows.length
        ? `
          <ul class="list-block">
            ${rows
              .map(
                (row) => `
                  <li>
                    <strong>${row.date}</strong> — ${row.name}
                    <span class="tee-time-badge">${formatRelativeToPar(row.score ?? 0)}</span>
                  </li>
                `,
              )
              .join('')}
          </ul>
          <p class="role-access-note">Season total: <strong>${formatRelativeToPar(seasonTotal)}</strong> across ${rows.length} confirmed event${rows.length === 1 ? '' : 's'}.</p>
        `
        : '<p class="role-access-note">No confirmed event scores yet. Stats appear once an admin approves a round.</p>'}
    </section>
  `;
};

const renderContentReviewPanel = (): string => {
  const pending = contentPipeline.getPending();
  const reviewed = contentPipeline.getAll().filter((submission) => submission.status !== 'pending').slice(0, 6);

  return `
    <section class="panel">
      <p class="eyebrow">Content pipeline</p>
      <h2>Approve pro content</h2>
      <p class="role-access-note">Pro updates stay private until the league approves them.</p>
      <ul class="post-list">
        ${pending.length
          ? pending
              .map(
                (submission) => `
                  <li class="post-item">
                    <div class="post-item-header">
                      <p class="post-timestamp">${escapeHtml(submission.authorName)} · ${submission.submittedAt ? new Date(submission.submittedAt).toLocaleString() : ''}</p>
                      <span class="post-status post-status--pending">${POST_STATUS_LABELS.pending}</span>
                    </div>
                    ${submission.text ? `<p>${escapeHtml(submission.text)}</p>` : ''}
                    ${renderPostMedia(submission)}
                    <form data-action="review-post" data-submission-id="${submission.id}" class="post-review-form">
                      <label>
                        <span>Note to the pro (optional)</span>
                        <input type="text" name="reviewNote" placeholder="Reason if you send it back." />
                      </label>
                      <div class="post-review-actions">
                        <button type="submit" name="decision" value="approve">Approve &amp; publish</button>
                        <button type="submit" name="decision" value="reject" class="secondary-button">Reject</button>
                      </div>
                    </form>
                  </li>
                `,
              )
              .join('')
          : '<li class="post-item">Nothing waiting for review.</li>'}
      </ul>

      ${reviewed.length
        ? `
          <h3>Recent decisions</h3>
          <ul class="list-block">
            ${reviewed
              .map(
                (submission) => `
                  <li>
                    <strong>${escapeHtml(submission.authorName)}</strong> — ${POST_STATUS_LABELS[submission.status]}
                    ${submission.reviewNote ? `<span class="course-assignment">· ${escapeHtml(submission.reviewNote)}</span>` : ''}
                  </li>
                `,
              )
              .join('')}
          </ul>
        `
        : ''}
    </section>
  `;
};

const renderProDashboard = (user: UserProfile): string => {
  const proFilters = ['Post content', 'My team', 'My stats'];
  const activeFilter = proFilters.includes(selectedDashboardFilter) ? selectedDashboardFilter : 'Post content';

  const panel =
    activeFilter === 'My team'
      ? renderProTeamPanel(user)
      : activeFilter === 'My stats'
        ? renderProStatsPanel(user)
        : renderProPostPanel(user);

  return `
    <main class="page-shell">
      <header class="hero">
        <div class="title-group">
          <p class="eyebrow">Dashboard</p>
          <div class="title-with-badges">
            <h1>${getSeasonDisplayName()}</h1>
            ${renderRoleBadges(user)}
          </div>
        </div>
      </header>

      <section class="dashboard-layout">
        <div class="dashboard-column">${renderDashboardMenus()}</div>
        <div class="dashboard-column">${renderLoginPane()}</div>
      </section>

      ${panel}
    </main>
  `;
};

const SPONSORSHIP_SCOPE_LABELS: Record<SponsorshipScope, string> = {
  season: 'Season',
  tournament: 'Tournament',
  course: 'Course',
  hole: 'Hole',
  pro: 'Pro',
  team: 'Team',
  broadcast: 'Broadcast',
};

const SPONSORSHIP_TIER_LABELS: Record<SponsorshipTier, string> = {
  title: 'Title sponsor',
  presenting: 'Presenting sponsor',
  official: 'Official partner',
  supporting: 'Supporting partner',
};

const renderSponsorshipPanel = (): string => {
  const program = seed.sponsorshipProgram;
  const title = program.getTitleSponsorship();
  const others = program.getRanked().filter((entry) => entry.id !== title?.id);

  return `
    <section class="panel">
      <p class="eyebrow">Sponsorship</p>
      <h2>Season sponsors</h2>
      ${title
        ? `<p class="role-access-note">Title sponsor: <strong>${escapeHtml(title.sponsor.name)}</strong> — $${title.amount.toLocaleString()} for ${escapeHtml(title.scopeName)}.</p>`
        : '<p class="role-access-note">No title sponsor signed yet.</p>'}
      <p class="role-access-note">Committed sponsorship value: <strong>$${program.getTotalValue().toLocaleString()}</strong>.</p>
      ${title && !program.isTitleSponsorPrincipal()
        ? '<p class="role-access-note">Warning: another partner is committing more than the title sponsor.</p>'
        : ''}
      <ul class="list-block sponsorship-list">
        ${others
          .map(
            (entry) => `
              <li>
                <span class="sponsor-scope sponsor-scope--${entry.scope}">${SPONSORSHIP_SCOPE_LABELS[entry.scope]}</span>
                <strong>${escapeHtml(entry.sponsor.name)}</strong> — ${escapeHtml(entry.scopeName)}
                <span class="course-assignment">· ${SPONSORSHIP_TIER_LABELS[entry.tier]} · $${entry.amount.toLocaleString()} · ${entry.status.toUpperCase()}</span>
              </li>
            `,
          )
          .join('')}
      </ul>
    </section>
  `;
};

const renderHomePage = (): string => {
  const currentUser = getCurrentUser();
  const selectedFilter = selectedDashboardFilter || 'Manage league';

  const isProOnly =
    currentUser.hasRole('pro') &&
    !currentUser.hasRole('leagueAdmin') &&
    !currentUser.hasRole('scorekeeper') &&
    !currentUser.hasRole('fantasyLeagueOwner') &&
    !currentUser.hasRole('fantasyParticipant');

  if (isProOnly) {
    return renderProDashboard(currentUser);
  }

  if (selectedFilter === 'Content review' && (currentUser.hasRole('leagueAdmin') || currentUser.hasRole('siteAdmin'))) {
    return `
      <main class="page-shell">
        <header class="hero">
          <div class="title-group">
            <p class="eyebrow">Dashboard</p>
            <div class="title-with-badges">
              <h1>${getSeasonDisplayName()}</h1>
              ${renderRoleBadges(currentUser)}
            </div>
          </div>
        </header>

        <section class="dashboard-layout">
          <div class="dashboard-column">${renderDashboardMenus()}</div>
          <div class="dashboard-column">${renderLoginPane()}</div>
        </section>

        ${renderContentReviewPanel()}
      </main>
    `;
  }

  if (selectedFilter === 'Approve scores' || selectedFilter === 'Scorekeeper scorecard' || selectedFilter === 'Standings' || (currentUser.hasRole('scorekeeper') && !!getAssignedGroupForUser(currentUser))) {
    return `
      <main class="page-shell">
        <header class="hero">
          <div class="title-group">
            <p class="eyebrow">Dashboard</p>
            <div class="title-with-badges">
              <h1>${getSeasonDisplayName()}</h1>
              ${renderRoleBadges(currentUser)}
            </div>
          </div>
        </header>

        <section class="dashboard-layout">
          <div class="dashboard-column">${renderDashboardMenus()}</div>
          <div class="dashboard-column">${renderLoginPane()}</div>
        </section>

        ${currentUser.hasRole('leagueAdmin') && selectedFilter === 'Approve scores' ? renderAdminApprovalDashboard() : renderScorekeeperDashboard()}
      </main>
    `;
  }

  if (selectedFilter === 'Draft controls' || selectedFilter === 'Fantasy league') {
    return `
      <main class="page-shell">
        <header class="hero">
          <div class="title-group">
            <p class="eyebrow">Dashboard</p>
            <div class="title-with-badges">
              <h1>${getSeasonDisplayName()}</h1>
              ${renderRoleBadges(currentUser)}
            </div>
          </div>
        </header>

        <section class="dashboard-layout">
          <div class="dashboard-column">${renderDashboardMenus()}</div>
          <div class="dashboard-column">${renderLoginPane()}</div>
        </section>

        ${renderFantasyDraftPanel()}
      </main>
    `;
  }

  const leagueMembers = seed.season.league.getParticipants();
  const teamSummaries = getTeamSummaries(seed);
  const proPlayers = getProPlayers(seed);
  const reservePros = seed.reservePros ?? [];
  const courseOptions = seed.courseOptions?.length ? seed.courseOptions : [seed.course];
  const selectedCourse = getSelectedCourse();
  const visibleCourseHoles = getSelectedCourseNineHoles(selectedCourse);
  const basketSetupLabel = selectedCourseNine === 'back' ? 'Red basket setup' : 'Blue basket setup';
  const holeCards = visibleCourseHoles
    .map((hole) => {
      const sponsorDetails = hole.getSponsors();
      const sectionLabel = selectedCourseNine === 'back' ? 'Back nine' : 'Front nine';
      const sponsorMarkup = sponsorDetails.length
        ? sponsorDetails
            .map(
              (sponsor) => `
                <div class="hole-sponsor-line">
                  <strong>${sponsor.name}</strong>
                  <span>${sponsor.tagline.replace(' • ', ' · ')}</span>
                </div>
              `,
            )
            .join('')
        : '<div class="hole-sponsor-line"><strong>No sponsor</strong></div>';
      const distanceLabel = hole.getDistanceLabel?.() ?? `${hole.distance} ft`;
      const basketMoveNote = hole.getBasketMoveNote?.() ?? '';
      return `
        <li class="hole-card ${hole.number === 10 ? 'hole-card--reset' : ''}">
          <div class="hole-card-header">
            <span class="hole-section-tag">${hole.number === 10 ? 'Intermission reset' : sectionLabel}</span>
            <span class="hole-number">Hole ${hole.number}</span>
          </div>
          <h4>${hole.name}</h4>
          <p>${hole.description}</p>
          <p><strong>Distance:</strong> ${distanceLabel}</p>
          ${basketMoveNote ? `<p class="distance-note">${basketMoveNote}</p>` : ''}
          <p><strong>Basket:</strong> ${basketSetupLabel}</p>
          <div class="hole-sponsor-block">
            <strong>Sponsors:</strong>
            ${sponsorMarkup}
          </div>
        </li>
      `;
    })
    .join('');

  const payoutBreakdown = seed.payoutBreakdown ?? SeasonService.createProgressivePayoutBreakdown();
  const featuredCourse = selectedCourse;
  const tournamentEntries = seed.schedule.getEvents();
  const tournamentPairingsByEvent = Group.generateSeasonPairings(seed.realLeagueTeams, tournamentEntries.length);
  const teeTimeSlots = Array.from({ length: tournamentEntries.length }, (_, index) => {
    const totalMinutes = 15 * 60 + index * 10;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period} PST`;
  });
  const activeTournamentIndex = Math.min(Math.max(selectedTournamentIndex, 0), tournamentEntries.length - 1);
  const activeTournament = tournamentEntries[activeTournamentIndex];
  const activeTeeTime = teeTimeSlots[activeTournamentIndex] ?? '3:00 PM PST';
  const activeTournamentGroups = tournamentPairingsByEvent[activeTournamentIndex] ?? tournamentPairingsByEvent[0] ?? [];
  const activeGroupTeeTimes = Array.from({ length: activeTournamentGroups.length }, (_, index) => {
    const totalMinutes = 15 * 60 + index * 10;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period} PST`;
  });

  return `
    <main class="page-shell">
      <header class="hero">
        <div class="title-group">
          <p class="eyebrow">Dashboard</p>
          <div class="title-with-badges">
            <h1>${getSeasonDisplayName()}</h1>
            ${renderRoleBadges(currentUser)}
          </div>
        </div>
      </header>

      <section class="dashboard-layout">
        <div class="dashboard-column">${renderDashboardMenus()}</div>
        <div class="dashboard-column">${renderLoginPane()}</div>
      </section>

      ${renderSeasonCreator()}

      <section class="panel">
        <h2>Season setup &amp; tournaments</h2>
        <p class="role-access-note">Current season: <strong>${getSeasonDisplayName()}</strong></p>
        ${hasSeason() ? '' : '<p class="role-access-note">Name a season with the Create season form above to lock in this schedule.</p>'}
        <p class="role-access-note">Purse: <strong>$${(seed.season.league.purseAmount ?? 4000000).toLocaleString()}</strong></p>
        <p class="role-access-note">Tee times begin at 3:00 PM PST and run every 10 minutes until the last group.</p>
        <ul class="list-block">
          ${tournamentEntries
            .map(
              (event, index) => `
                <li>
                  <button
                    class="schedule-item ${index === activeTournamentIndex ? 'selected' : ''}"
                    type="button"
                    data-action="select-tournament"
                    data-event-index="${index}"
                  >
                    <span class="tee-time-badge">${teeTimeSlots[index]}</span>
                    <span>
                      <strong>${event.date}</strong> — ${event.result.name}
                      ${event.courseName ? `<span class="course-assignment">· Played at: ${event.courseName}</span>` : ''}
                    </span>
                  </button>
                </li>
              `,
            )
            .join('')}
        </ul>
        <p class="role-access-note">Scorekeeping is the next phase after tournament timing is locked in.</p>
      </section>

      ${renderSponsorshipPanel()}

      <section class="panel">
        <div class="section-header-row">
          <div>
            <p class="eyebrow">Tournament setup</p>
            <h2>${activeTournament.result.name}</h2>
          </div>
          <span class="tee-time-badge">Season event</span>
        </div>
        <p class="role-access-note"><strong>${activeTournament.date}</strong> · first tee ${activeTeeTime}</p>
        <p class="role-access-note">${activeTournament.courseName ? `Played at: <strong>${activeTournament.courseName}</strong>` : 'Course assignment pending'}</p>
        <div class="group-grid">
          ${activeTournamentGroups
            .map(
              (group, index) => `
                <article class="group-card">
                  <div class="group-card-header">
                    <h3>${group.name}</h3>
                    <span class="tee-time-badge">${activeGroupTeeTimes[index] ?? '3:00 PM PST'}</span>
                  </div>
                  <ul class="group-list">
                    ${group.teams
                      .map(
                        (team) => `
                          <li>
                            <span class="team-pill">${team.name}</span>
                          </li>
                        `,
                      )
                      .join('')}
                  </ul>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="panel collapsible-panel" data-collapsible="sponsor-lois">
        <button class="collapse-toggle" type="button" data-toggle="collapse" data-target="sponsor-lois-content" aria-expanded="false">
          <span>Sponsor LOIs</span>
          <span class="collapse-indicator">+</span>
        </button>
        <div id="sponsor-lois-content" class="collapsible-content collapsed" hidden>
          <h3>League supporters</h3>
          <div class="sponsor-loi-list">
            ${seed.sponsors
              .map(
                (sponsor) => `
                  <div class="sponsor-loi-item">
                    <span class="sponsor-loi-tag">LOI Signed</span>
                    <h4>${sponsor.name}</h4>
                    <p>${sponsor.tagline.replace(' • ', ' · ')}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
        </div>
      </section>

      <section class="panel collapsible-panel" data-collapsible="payout-breakdown">
        <button class="collapse-toggle" type="button" data-toggle="collapse" data-target="payout-breakdown-content" aria-expanded="false">
          <span>Payout breakdown</span>
          <span class="collapse-indicator">+</span>
        </button>
        <div id="payout-breakdown-content" class="collapsible-content collapsed" hidden>
          <p class="role-access-note">Progressive season purse: <strong>$${payoutBreakdown.totalPurse.toLocaleString()}</strong> across 6 events</p>
          <p class="role-access-note">Event totals: <strong>$${payoutBreakdown.events.reduce((sum, event) => sum + event.eventTotal, 0).toLocaleString()}</strong> · Matches the season purse total</p>
          <div class="payout-grid">
            ${payoutBreakdown.events
              .map(
                (event) => `
                  <article class="payout-card">
                    <h3>${event.name}</h3>
                    <p class="payout-meta">${event.date} · Event total: $${event.eventTotal.toLocaleString()}</p>
                    <ul class="list-block">
                      ${event.placements
                        .map(
                          (placement) => `
                            <li>
                              <strong>#${placement.place}</strong> — $${placement.amount.toLocaleString()}
                            </li>
                          `,
                        )
                        .join('')}
                    </ul>
                  </article>
                `,
              )
              .join('')}
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="course-header">
          <div>
            <p class="eyebrow">Course options</p>
            <h2>${featuredCourse.name}</h2>
          </div>
          <div class="course-layout-tags">
            <span class="course-layout-tag">${featuredCourse.getHoles().length}-hole layout</span>
            <span class="course-layout-tag course-layout-tag--muted">Par 3 throughout</span>
            <span class="course-layout-tag course-layout-tag--accent">Obstacle sponsors</span>
          </div>
        </div>
        <p class="role-access-note">This seed is structured around a single nine-hole par-3 format, with adjustable hole distances and obstacle sponsor branding matching the Sunset Nine setup.</p>
        <div class="card-grid">
          ${courseOptions
            .map(
              (course) => `
                <button
                  type="button"
                  class="info-card course-select-card ${course.id === selectedCourse.id ? 'selected' : ''}"
                  data-action="select-course"
                  data-course-id="${course.id}"
                >
                  <h3>${course.name}</h3>
                  <p>${course.getHoles().length} holes · All par 3 · ${course.getHoles().length === 9 ? 'Short format' : 'Long format'}</p>
                  <ul class="mini-list">
                    ${course
                      .getHoles()
                      .slice(0, 4)
                      .map(
                        (hole) => `<li>${hole.name} · ${hole.getDistanceLabel?.() ?? `${hole.distance} ft`}</li>`,
                      )
                      .join('')}
                  </ul>
                </button>
              `,
            )
            .join('')}
        </div>
        <div class="course-nine-toggle" role="tablist" aria-label="Course nine selection">
          <button
            type="button"
            class="course-nine-toggle__button ${selectedCourseNine === 'front' ? 'active' : ''}"
            data-action="select-course-nine"
            data-course-nine="front"
          >
            Front 9
          </button>
          <button
            type="button"
            class="course-nine-toggle__button ${selectedCourseNine === 'back' ? 'active' : ''}"
            data-action="select-course-nine"
            data-course-nine="back"
          >
            Back 9
          </button>
        </div>
        <div class="selected-course-detail">
          <h3>${selectedCourse.name}</h3>
          <p>${selectedCourse.getHoles().length} holes · ${selectedCourseNine === 'back' ? 'Back nine' : 'Front nine'} · ${basketSetupLabel}</p>
          <ul class="hole-list">${holeCards}</ul>
        </div>
      </section>
    </main>
  `;
};

const renderTeamsPage = (): string => {
  const teamSummaries = getTeamSummaries(seed);

  return `
    <main class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">League teams</p>
          <h1>Teams</h1>
        </div>
        ${renderNav(getCurrentUser(), 'teams')}
      </header>

      <section class="card-grid">
        ${teamSummaries
          .map(
            (team) => `
              <article class="info-card">
                <h3>${team.name}</h3>
                <p>${team.players.length} players on the roster</p>
                <ul class="mini-list">
                  ${team.players
                    .map(
                      (player) => `
                        <li>
                          <a href="/pros/${player.routeId}">${player.displayName}</a>
                        </li>
                      `,
                    )
                    .join('')}
                </ul>
                <a class="secondary-link" href="/teams/${team.id}">View team details</a>
              </article>
            `,
          )
          .join('')}
      </section>
    </main>
  `;
};

const renderTeamDetailPage = (teamId: string): string => {
  const team = getTeamSummaries(seed).find((entry) => entry.id === teamId);

  if (!team) {
    return renderTeamsPage();
  }

  return `
    <main class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Team profile</p>
          <h1>${team.name}</h1>
        </div>
        ${renderNav(getCurrentUser(), 'teams')}
      </header>

      <section class="panel">
        <h2>Roster</h2>
        <div class="team-grid">
          ${team.players
            .map(
              (player) => `
                <article class="player-card">
                  <h3>${player.displayName}</h3>
                  <p><strong>Role:</strong> ${player.gender === 'male' ? 'Male player' : 'Female player'}</p>
                  <p><strong>Email:</strong> ${player.email}</p>
                  <a class="secondary-link" href="/pros/${player.routeId}">Open pro profile</a>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>
    </main>
  `;
};

const renderProsPage = (): string => {
  const proPlayers = getProPlayers(seed);
  const reservePros = seed.reservePros ?? [];

  return `
    <main class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Player database</p>
          <h1>Pros</h1>
        </div>
        ${renderNav(getCurrentUser(), 'pros')}
      </header>

      ${renderLoginPane()}

      <section class="panel">
        <h2>Reserve pool</h2>
        <ul class="list-block">
          ${reservePros
            .map(
              (player) => `
                <li>
                  <strong>${player.displayName}</strong> — ${player.reason}
                </li>
              `,
            )
            .join('')}
        </ul>
      </section>

      <section class="card-grid">
        ${proPlayers
          .map(
            (player) => `
              <article class="info-card">
                <h3>${player.displayName}</h3>
                <p>${player.teamName}</p>
                <p>${player.gender}</p>
                <a class="secondary-link" href="/pros/${player.routeId}">View profile</a>
              </article>
            `,
          )
          .join('')}
      </section>
    </main>
  `;
};

const renderProDetailPage = (playerId: string): string => {
  const player = getProPlayers(seed).find((entry) => entry.routeId === playerId || entry.id === playerId);

  if (!player) {
    return renderProsPage();
  }

  const reserveReason = 'reason' in player ? player.reason : null;
  const profileUser = userDirectory.find((entry) => entry.displayName === player.displayName);
  const publishedPosts = profileUser ? getPublishedPostsForProfile(profileUser.id) : [];

  return `
    <main class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Pro profile</p>
          <h1>${player.displayName}</h1>
        </div>
        ${renderNav(getCurrentUser(), 'pros')}
      </header>

      <section class="panel">
        <h2>Player details</h2>
        <ul class="detail-list">
          <li><strong>Team:</strong> ${player.teamId === 'reserve-roster' ? '<span>Reserve pool</span>' : `<a href="/teams/${player.teamId}">${player.teamName}</a>`}</li>
          <li><strong>Gender:</strong> ${player.gender}</li>
          <li><strong>Email:</strong> ${player.email}</li>
          ${reserveReason ? `<li><strong>Reserve reason:</strong> ${reserveReason}</li>` : '<li><strong>Route ID:</strong> ' + player.routeId + '</li>'}
        </ul>
      </section>

      <section class="panel">
        <h2>Fan feed</h2>
        <ul class="post-list">
          ${publishedPosts.length
            ? publishedPosts
                .map(
                  (post) => `
                    <li class="post-item">
                      ${post.submittedAt ? `<p class="post-timestamp">${new Date(post.submittedAt).toLocaleString()}</p>` : ''}
                      ${post.text ? `<p>${escapeHtml(post.text)}</p>` : ''}
                      ${renderPostMedia(post)}
                    </li>
                  `,
                )
                .join('')
            : '<li class="post-item">No published updates yet.</li>'}
        </ul>
      </section>
    </main>
  `;
};

type DiagramNode = { name: string; summary: string; connections: string[] };

type DiagramGroup = { id: string; label: string; fill: string; stroke: string; color: string; members: string[] };

const DIAGRAM_GROUPS: DiagramGroup[] = [
  {
    id: 'people',
    label: 'People & teams',
    fill: '#1e1b4b',
    stroke: '#818cf8',
    color: '#e0e7ff',
    members: ['UserProfile', 'Player', 'Team', 'LeagueMembership', 'LeagueInvite'],
  },
  {
    id: 'league',
    label: 'League & season',
    fill: '#0c2340',
    stroke: '#60a5fa',
    color: '#dbeafe',
    members: ['UserLeague', 'League', 'Season', 'SeasonBootstrapResult', 'EventSchedule', 'TournamentResult', 'LeagueTable', 'Standing'],
  },
  {
    id: 'course',
    label: 'Course',
    fill: '#052e1b',
    stroke: '#34d399',
    color: '#d1fae5',
    members: ['Course', 'Hole', 'Sponsor'],
  },
  {
    id: 'sponsorship',
    label: 'Sponsorship',
    fill: '#422006',
    stroke: '#fb923c',
    color: '#ffedd5',
    members: ['SponsorshipProgram', 'Sponsorship'],
  },
  {
    id: 'content',
    label: 'Content pipeline',
    fill: '#2e1065',
    stroke: '#c084fc',
    color: '#f3e8ff',
    members: ['ContentPipeline', 'ContentSubmission'],
  },
  {
    id: 'scoring',
    label: 'Scoring pipeline',
    fill: '#3f2a06',
    stroke: '#fbbf24',
    color: '#fef3c7',
    members: ['ScorekeeperPipeline', 'Group', 'ScoreEntry', 'Scorecard', 'Round'],
  },
  {
    id: 'fantasy',
    label: 'Fantasy & draft',
    fill: '#083344',
    stroke: '#22d3ee',
    color: '#cffafe',
    members: ['FantasyLeague', 'FantasyTeam', 'FantasyRoster', 'FantasyPlayer', 'FantasyDraft', 'FantasyScoring', 'DraftRoom', 'DraftOrder', 'DraftSelection', 'DraftControlSettings'],
  },
];

const getDiagramGroup = (name: string): DiagramGroup | undefined =>
  DIAGRAM_GROUPS.find((group) => group.members.includes(name));

// Relationships that hold a collection; everything else is treated as one-to-one.
const DIAGRAM_MANY_EDGES = new Set([
  'Season>EventSchedule',
  'Season>SponsorshipProgram',
  'SeasonBootstrapResult>DraftOrder',
  'SeasonBootstrapResult>FantasyTeam',
  'EventSchedule>TournamentResult',
  'TournamentResult>Scorecard',
  'TournamentResult>Team',
  'TournamentResult>FantasyScoring',
  'LeagueTable>TournamentResult',
  'LeagueTable>Standing',
  'League>Season',
  'UserLeague>LeagueMembership',
  'UserLeague>LeagueInvite',
  'UserLeague>DraftOrder',
  'UserLeague>UserProfile',
  'UserProfile>ContentSubmission',
  'UserProfile>FantasyLeague',
  'Team>Player',
  'Player>Scorecard',
  'Course>Hole',
  'Hole>Sponsor',
  'Course>Sponsorship',
  'Hole>Sponsorship',
  'Player>Sponsorship',
  'Team>Sponsorship',
  'SponsorshipProgram>Sponsorship',
  'ContentPipeline>ContentSubmission',
  'ScorekeeperPipeline>ScoreEntry',
  'ScorekeeperPipeline>Group',
  'Group>Team',
  'Group>ScoreEntry',
  'FantasyLeague>FantasyTeam',
  'FantasyRoster>FantasyPlayer',
  'FantasyDraft>DraftRoom',
  'FantasyDraft>FantasyTeam',
  'DraftRoom>DraftSelection',
  'FantasyScoring>FantasyTeam',
  'FantasyScoring>Scorecard',
]);

const isManyEdge = (from: string, to: string): boolean => DIAGRAM_MANY_EDGES.has(`${from}>${to}`);

const buildDiagramDefinition = (nodes: DiagramNode[]): string => {
  const seen = new Set<string>();
  const lines = ['graph LR'];
  const linkStyles: string[] = [];

  nodes.forEach((node) => {
    lines.push(`  ${node.name}["${node.name}"]`);
  });

  nodes.forEach((node) => {
    node.connections.forEach((connection) => {
      const key = [node.name, connection].sort().join('--');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);

      // Draw the edge from whichever side owns the collection so the label reads correctly.
      const reversed = !isManyEdge(node.name, connection) && isManyEdge(connection, node.name);
      const from = reversed ? connection : node.name;
      const to = reversed ? node.name : connection;
      const many = isManyEdge(from, to);
      const stroke = getDiagramGroup(from)?.stroke ?? '#94a3b8';

      lines.push(`  ${from} ---|"${many ? 'has many' : 'has one'}"| ${to}`);
      linkStyles.push(
        `  linkStyle ${linkStyles.length} stroke:${stroke},stroke-width:${many ? '2.4' : '1.4'}px${many ? '' : ',stroke-dasharray:6 4'};`,
      );
    });
  });

  const documented = new Set(nodes.map((node) => node.name));
  const everyName = new Set([...documented, ...nodes.flatMap((node) => node.connections)]);

  lines.push('  classDef fallback fill:#0f172a,stroke:#94a3b8,stroke-width:1.2px,color:#cbd5e1;');
  DIAGRAM_GROUPS.forEach((group) => {
    lines.push(`  classDef ${group.id} fill:${group.fill},stroke:${group.stroke},stroke-width:1.6px,color:${group.color};`);
  });

  const byGroup = new Map<string, string[]>();
  everyName.forEach((name) => {
    const groupId = getDiagramGroup(name)?.id ?? 'fallback';
    byGroup.set(groupId, [...(byGroup.get(groupId) ?? []), name]);
  });

  byGroup.forEach((members, groupId) => {
    lines.push(`  class ${members.join(',')} ${groupId};`);
  });

  return [...lines, ...linkStyles].join('\n');
};

const renderDiagramLegend = (nodes: DiagramNode[]): string => {
  const present = new Set([...nodes.map((node) => node.name), ...nodes.flatMap((node) => node.connections)]);
  const groups = DIAGRAM_GROUPS.filter((group) => group.members.some((member) => present.has(member)));

  return `
    <ul class="diagram-legend">
      ${groups
        .map(
          (group) => `
            <li>
              <span class="legend-swatch" style="background:${group.fill};border-color:${group.stroke};"></span>
              ${group.label}
            </li>
          `,
        )
        .join('')}
      <li><span class="legend-line legend-line--many"></span>has many (a collection)</li>
      <li><span class="legend-line legend-line--one"></span>has one (single reference)</li>
    </ul>
  `;
};

const renderDiagramCanvas = (nodes: DiagramNode[]): string =>
  `<div class="diagram-canvas" data-mermaid="${escapeHtml(buildDiagramDefinition(nodes))}">Loading diagram…</div>`;

const getEntitySummaries = (): Map<string, string> => {
  const summaries = new Map<string, string>();
  DIAGRAM_VIEWS.forEach((view) => {
    view.nodes.forEach((node) => {
      if (!summaries.has(node.name)) {
        summaries.set(node.name, node.summary);
      }
    });
  });
  return summaries;
};

// Mermaid has no native tooltip in strict mode, so annotate the rendered nodes directly.
const annotateDiagramNodes = (container: HTMLElement): void => {
  const summaries = getEntitySummaries();
  const svgNamespace = 'http://www.w3.org/2000/svg';

  container.querySelectorAll('g.node').forEach((node) => {
    const label = node.textContent?.trim() ?? '';
    const summary = summaries.get(label);
    if (!summary) {
      return;
    }

    node.classList.add('has-info');
    (node as SVGGElement).dataset.infoTitle = label;
    (node as SVGGElement).dataset.info = summary;

    const box = (node as SVGGElement).getBBox();
    const badge = document.createElementNS(svgNamespace, 'g');
    badge.setAttribute('class', 'node-info-badge');
    badge.setAttribute('transform', `translate(${box.x + box.width - 6}, ${box.y + 6})`);

    const circle = document.createElementNS(svgNamespace, 'circle');
    circle.setAttribute('r', '8');

    const glyph = document.createElementNS(svgNamespace, 'text');
    glyph.setAttribute('text-anchor', 'middle');
    glyph.setAttribute('dy', '4');
    glyph.textContent = 'i';

    badge.append(circle, glyph);
    node.append(badge);
  });
};

const getDiagramTooltip = (): HTMLElement => {
  const existing = document.getElementById('diagram-tooltip');
  if (existing) {
    return existing;
  }

  const tooltip = document.createElement('div');
  tooltip.id = 'diagram-tooltip';
  tooltip.className = 'diagram-tooltip';
  tooltip.hidden = true;
  document.body.append(tooltip);
  return tooltip;
};

const showDiagramTooltip = (target: HTMLElement | SVGElement, title: string, body: string): void => {
  const tooltip = getDiagramTooltip();
  tooltip.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span>`;
  tooltip.hidden = false;

  const bounds = target.getBoundingClientRect();
  const tooltipBounds = tooltip.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, bounds.left + bounds.width / 2 - tooltipBounds.width / 2),
    window.innerWidth - tooltipBounds.width - 12,
  );
  const above = bounds.top - tooltipBounds.height - 12;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${above > 12 ? above : bounds.bottom + 12}px`;
};

const hideDiagramTooltip = (): void => {
  const tooltip = document.getElementById('diagram-tooltip');
  if (tooltip) {
    tooltip.hidden = true;
  }
};

// Mermaid is heavy, so it only loads when the diagram page is on screen.
const renderMermaidDiagrams = async (): Promise<void> => {
  const containers = Array.from(document.querySelectorAll('[data-mermaid]')) as HTMLElement[];
  if (containers.length === 0) {
    return;
  }

  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', flowchart: { curve: 'basis' } });

  await Promise.all(
    containers.map(async (container, index) => {
      const definition = container.dataset.mermaid;
      if (!definition) {
        return;
      }

      try {
        const { svg } = await mermaid.render(`mermaid-diagram-${index}-${Date.now()}`, definition);
        container.innerHTML = svg;
        annotateDiagramNodes(container);
      } catch {
        container.textContent = 'The diagram could not be rendered.';
      }
    }),
  );
};

const renderRestrictedPage = (pageName: string): string => {
  const user = getCurrentUser();

  return `
    <main class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Restricted</p>
          <h1>${escapeHtml(pageName)}</h1>
        </div>
        ${renderNav(user, 'home')}
      </header>

      <section class="panel">
        <h2>Super admin only</h2>
        <p class="role-access-note">Switch to the Super Admin account to open this view.</p>
        ${renderLoginPane()}
      </section>
    </main>
  `;
};

type DiagramView = { slug: string; label: string; title: string; intro: string; nodes: DiagramNode[] };

const DIAGRAM_VIEWS: DiagramView[] = [
  {
    slug: 'overview',
    label: 'Overview',
    title: 'Full entity map',
    intro:
      'Everything hangs off the season: the season schedules tournaments, tournaments are played on courses by teams, teams are made of pros, and the approved results feed the standings and the fantasy leagues. Both pipelines gate what becomes official — scores need admin approval, and pro posts need content approval before going public.',
    nodes: [
      { name: 'Season', summary: 'The parent record: purse, league reference, schedule, and sponsorship program.', connections: ['EventSchedule', 'SponsorshipProgram', 'UserLeague'] },
      { name: 'SponsorshipProgram', summary: 'Season sponsorships, starting with the single title sponsor.', connections: ['Sponsorship'] },
      { name: 'Sponsorship', summary: 'One agreement: sponsor, tier, scope, amount, and status.', connections: ['Sponsor'] },
      { name: 'UserLeague', summary: 'The league membership that owns invites, participants, and draft orders.', connections: ['UserProfile', 'LeagueInvite', 'DraftOrder'] },
      { name: 'EventSchedule', summary: 'Calendarized tournaments across a season.', connections: ['TournamentResult'] },
      { name: 'TournamentResult', summary: 'One tournament: the course it is played on, the teams entered, and the ranked scorecards.', connections: ['Course', 'Team', 'Scorecard', 'LeagueTable', 'FantasyScoring'] },
      { name: 'ScorekeeperPipeline', summary: 'Collects hole scores per group and blocks approval until the card is complete.', connections: ['Group', 'ScoreEntry', 'TournamentResult'] },
      { name: 'Course', summary: 'The layout a tournament is played on.', connections: ['Hole'] },
      { name: 'Hole', summary: 'Distance, basket placement, and sponsor branding for one hole.', connections: ['Sponsor'] },
      { name: 'Team', summary: 'A mixed pair of pros entered in the tournament.', connections: ['Player'] },
      { name: 'Player', summary: 'A pro on a team, with scorecards and an account.', connections: ['Scorecard', 'UserProfile'] },
      { name: 'UserProfile', summary: 'The account behind a pro, admin, scorekeeper, or fan.', connections: ['ContentSubmission'] },
      { name: 'ContentPipeline', summary: 'Holds pro posts until a league or super admin approves them.', connections: ['ContentSubmission'] },
      { name: 'LeagueTable', summary: 'Cumulative standings rolled up from every approved event.', connections: ['Standing'] },
      { name: 'FantasyScoring', summary: 'Derives fantasy standings from approved event scores.', connections: ['FantasyTeam'] },
      { name: 'FantasyTeam', summary: 'A fantasy manager and the pros they drafted.', connections: ['FantasyPlayer'] },
      { name: 'FantasyPlayer', summary: 'A league pro wrapped with fantasy scoring.', connections: ['Player'] },
      { name: 'FantasyLeague', summary: 'The fantasy competition that owns teams and the draft.', connections: ['FantasyTeam', 'FantasyDraft'] },
    ],
  },
  {
    slug: 'pros',
    label: 'Pros',
    title: 'Pro players and their content',
    intro: 'A pro is a player on a league team. Their posts enter the content pipeline and only reach the public profile once approved.',
    nodes: [
      { name: 'UserProfile', summary: 'The signed-in pro account and its roles.', connections: ['Player', 'ContentSubmission'] },
      { name: 'Player', summary: 'The competitor record placed on a team roster.', connections: ['Team', 'Scorecard', 'Standing'] },
      { name: 'Team', summary: 'A mixed pair of pros that scores together.', connections: ['Player', 'TournamentResult'] },
      { name: 'Scorecard', summary: 'Hole-by-hole results for one pro in one round.', connections: ['Round', 'TournamentResult'] },
      { name: 'ContentSubmission', summary: 'A post with optional photo or video, plus its review status.', connections: ['ContentPipeline', 'UserProfile'] },
      { name: 'ContentPipeline', summary: 'Approval gate before a post is public.', connections: ['ContentSubmission'] },
    ],
  },
  {
    slug: 'league',
    label: 'League',
    title: 'League, season, and schedule',
    intro: 'A user league owns memberships and invites. Bootstrapping a season produces the schedule, tournaments, and standings table.',
    nodes: [
      { name: 'UserLeague', summary: 'Membership container for participants and invites.', connections: ['LeagueMembership', 'LeagueInvite', 'DraftOrder'] },
      { name: 'Season', summary: 'A named season with its purse, league reference, and title sponsor.', connections: ['League', 'EventSchedule', 'SponsorshipProgram'] },
      { name: 'SponsorshipProgram', summary: 'Season sponsorships, starting with the single title sponsor.', connections: ['Sponsorship'] },
      { name: 'Sponsorship', summary: 'One agreement: sponsor, tier, scope, amount, and status.', connections: ['Sponsor'] },
      { name: 'SeasonBootstrapResult', summary: 'The assembled season seed handed to the app.', connections: ['UserLeague', 'Season', 'EventSchedule'] },
      { name: 'EventSchedule', summary: 'Dated tournament entries across the season.', connections: ['TournamentResult'] },
      { name: 'TournamentResult', summary: 'Ranked results for one event.', connections: ['LeagueTable', 'Scorecard'] },
      { name: 'LeagueTable', summary: 'Cumulative standings rolled up from every event.', connections: ['TournamentResult', 'Standing'] },
    ],
  },
  {
    slug: 'fantasy',
    label: 'Fantasy',
    title: 'Fantasy leagues and drafts',
    intro: 'Fantasy owners run a draft that assigns fantasy players to rosters, scored from the same tournament results.',
    nodes: [
      { name: 'FantasyLeague', summary: 'The fantasy competition and its owner settings.', connections: ['FantasyTeam', 'FantasyDraft'] },
      { name: 'FantasyTeam', summary: 'One manager and the roster they drafted.', connections: ['FantasyRoster', 'FantasyLeague'] },
      { name: 'FantasyRoster', summary: 'The drafted set of fantasy players.', connections: ['FantasyPlayer'] },
      { name: 'FantasyPlayer', summary: 'A league pro wrapped with fantasy scoring.', connections: ['Player', 'Scorecard'] },
      { name: 'FantasyScoring', summary: 'Turns admin-approved event scores into fantasy standings for each participant.', connections: ['TournamentResult', 'Scorecard', 'FantasyTeam', 'FantasyDraft'] },
      { name: 'TournamentResult', summary: 'The approved event scores that fantasy totals are derived from.', connections: ['Scorecard'] },
      { name: 'FantasyDraft', summary: 'Draft rounds, picks, and the resulting rosters.', connections: ['DraftRoom', 'DraftOrder', 'FantasyTeam'] },
      { name: 'DraftRoom', summary: 'Live draft state with pick timers and auto picks.', connections: ['DraftSelection', 'DraftControlSettings'] },
    ],
  },
  {
    slug: 'course',
    label: 'Course',
    title: 'Courses, holes, and sponsors',
    intro: 'Each course holds nine or eighteen holes, and holes carry sponsor branding and prize metadata.',
    nodes: [
      { name: 'Course', summary: 'A playable layout used by a tournament.', connections: ['Hole', 'TournamentResult'] },
      { name: 'Hole', summary: 'Distance, basket placement, and description for one hole.', connections: ['Course', 'Sponsor'] },
      { name: 'Sponsor', summary: 'Branding attached to a hole or the league.', connections: ['Hole'] },
    ],
  },
  {
    slug: 'sponsorship',
    label: 'Sponsorship',
    title: 'Who is paying for what',
    intro:
      'A season has one title sponsor, the largest commitment in the program, then a presenting sponsor and official partners. Everything else is scoped: broadcast, course, hole, team, and individual pro deals all hang off the same sponsorship record.',
    nodes: [
      { name: 'SponsorshipProgram', summary: 'All sponsorship agreements for a season, with one title sponsor enforced.', connections: ['Sponsorship', 'Season'] },
      { name: 'Sponsorship', summary: 'One agreement: sponsor, tier, scope, amount, and status.', connections: ['Sponsor', 'SponsorshipProgram'] },
      { name: 'Sponsor', summary: 'The brand behind an agreement.', connections: ['Sponsorship'] },
      { name: 'Season', summary: 'Title and presenting sponsorships attach at the season level.', connections: ['SponsorshipProgram'] },
      { name: 'Course', summary: 'Venue-scoped sponsorship, usually the host facility.', connections: ['Sponsorship', 'Hole'] },
      { name: 'Hole', summary: 'Hole-scoped branding and prize sponsorship.', connections: ['Sponsorship'] },
      { name: 'Player', summary: 'Pro-scoped endorsement deals sit on the player.', connections: ['Sponsorship', 'Team'] },
      { name: 'Team', summary: 'Team-scoped sponsorship for a mixed pair.', connections: ['Sponsorship'] },
    ],
  },
  {
    slug: 'pipelines',
    label: 'Pipelines',
    title: 'Approval pipelines',
    intro: 'Nothing becomes official without review: scorekeepers submit hole scores for admin approval, and pros submit posts for content approval.',
    nodes: [
      { name: 'ScorekeeperPipeline', summary: 'Blocks approval until every team has a score for every hole.', connections: ['Group', 'ScoreEntry'] },
      { name: 'TournamentResult', summary: 'Created when the league admin approves the round.', connections: ['ScorekeeperPipeline', 'LeagueTable', 'FantasyScoring'] },
      { name: 'FantasyScoring', summary: 'Reads approved scores only, so fantasy standings move when the admin confirms an event.', connections: ['FantasyTeam'] },
      { name: 'Group', summary: 'The paired teams a scorekeeper is assigned to.', connections: ['Team', 'ScoreEntry'] },
      { name: 'ScoreEntry', summary: 'One team score on one hole.', connections: ['ScorekeeperPipeline'] },
      { name: 'ContentPipeline', summary: 'Queues pro posts as pending until approved or rejected.', connections: ['ContentSubmission'] },
      { name: 'ContentSubmission', summary: 'Post text, optional media, status, reviewer, and note.', connections: ['ContentPipeline', 'UserProfile'] },
    ],
  },
];

const getDiagramView = (slug: string): DiagramView =>
  DIAGRAM_VIEWS.find((view) => view.slug === slug) ?? DIAGRAM_VIEWS[0];

const renderDiagramPage = (slug: string): string => {
  const view = getDiagramView(slug);
  const summaries = getEntitySummaries();

  return `
    <main class="page-shell">
      <header class="hero diagram-hero">
        <div>
          <p class="eyebrow">Schema view</p>
          <h1>League table diagram</h1>
        </div>
        ${renderNav(getCurrentUser(), 'diagram')}
      </header>

      <nav class="diagram-tabs" aria-label="Diagram views">
        ${DIAGRAM_VIEWS.map(
          (entry) => `
            <a
              class="diagram-tab ${entry.slug === view.slug ? 'is-active' : ''}"
              href="${entry.slug === 'overview' ? '/diagram' : `/diagram/${entry.slug}`}"
              aria-current="${entry.slug === view.slug ? 'page' : 'false'}"
            >${entry.label}</a>
          `,
        ).join('')}
      </nav>

      <section class="panel diagram-intro">
        <h2>${escapeHtml(view.title)}</h2>
        <p>${escapeHtml(view.intro)}</p>
      </section>

      <section class="panel diagram-canvas-panel">
        <h2>Entity map</h2>
        ${renderDiagramLegend(view.nodes)}
        ${renderDiagramCanvas(view.nodes)}
      </section>

      <section class="diagram-grid">
        ${view.nodes
          .map(
            (node) => {
              const group = getDiagramGroup(node.name);
              return `
              <article class="diagram-card" ${group ? `style="--card-accent:${group.stroke}"` : ''}>
                <h3>${node.name}<span class="info-dot" tabindex="0" role="button" aria-label="About ${escapeHtml(node.name)}" data-info-title="${escapeHtml(node.name)}" data-info="${escapeHtml(node.summary)}">i</span></h3>
                <p>${node.summary}</p>
                <ul>
                  ${node.connections
                    .map((connection) => {
                      const summary = summaries.get(connection);
                      return summary
                        ? `<li>${connection}<span class="info-dot" tabindex="0" role="button" aria-label="About ${escapeHtml(connection)}" data-info-title="${escapeHtml(connection)}" data-info="${escapeHtml(summary)}">i</span></li>`
                        : `<li>${connection}</li>`;
                    })
                    .join('')}
                </ul>
              </article>
            `;
            },
          )
          .join('')}
      </section>
    </main>
  `;
};

const renderApp = (): void => {
  const route = getRoute();

  if (route.kind === 'teams') {
    app.innerHTML = renderTeamsPage();
    return;
  }

  if (route.kind === 'team-detail') {
    app.innerHTML = renderTeamDetailPage(route.teamId);
    return;
  }

  if (route.kind === 'pros') {
    app.innerHTML = renderProsPage();
    return;
  }

  if (route.kind === 'pro-detail') {
    app.innerHTML = renderProDetailPage(route.playerId);
    return;
  }

  if (route.kind === 'diagram') {
    if (getCurrentUser().hasRole('siteAdmin')) {
      app.innerHTML = renderDiagramPage(route.view);
      void renderMermaidDiagrams();
    } else {
      app.innerHTML = renderRestrictedPage('Diagram');
    }
    return;
  }

  app.innerHTML = renderHomePage();
};

const findInfoTarget = (event: Event): (HTMLElement & { dataset: DOMStringMap }) | SVGGElement | null => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest('[data-info]') as (HTMLElement & { dataset: DOMStringMap }) | SVGGElement | null;
};

app.addEventListener('pointerover', (event) => {
  const target = findInfoTarget(event);
  if (!target) {
    return;
  }

  showDiagramTooltip(target, target.dataset.infoTitle ?? '', target.dataset.info ?? '');
});

app.addEventListener('pointerout', (event) => {
  if (findInfoTarget(event)) {
    hideDiagramTooltip();
  }
});

app.addEventListener('focusin', (event) => {
  const target = findInfoTarget(event);
  if (target) {
    showDiagramTooltip(target, target.dataset.infoTitle ?? '', target.dataset.info ?? '');
  }
});

app.addEventListener('focusout', () => hideDiagramTooltip());

window.addEventListener('scroll', hideDiagramTooltip, { passive: true });

app.addEventListener('input', (event) => {
  const playoffDistanceInput = event.target instanceof HTMLInputElement && event.target.matches('[data-playoff-distance-team]') ? event.target : null;
  if (playoffDistanceInput) {
    const teamName = playoffDistanceInput.getAttribute('data-playoff-distance-team');
    if (teamName) {
      const value = Number.parseFloat(playoffDistanceInput.value);
      if (Number.isFinite(value)) {
        teamPlayoffDistances[teamName] = value;
      } else {
        delete teamPlayoffDistances[teamName];
      }
      saveScorekeeperState();
    }
  }
});

app.addEventListener('change', (event) => {
  const fileInput =
    event.target instanceof HTMLInputElement && event.target.type === 'file' && event.target.closest('form[data-action="post"]')
      ? event.target
      : null;
  if (!fileInput) {
    return;
  }

  const form = fileInput.closest('form[data-action="post"]') as HTMLFormElement;
  (Array.from(form.querySelectorAll('input[type="file"]')) as HTMLInputElement[])
    .filter((input) => input !== fileInput)
    .forEach((input) => {
      input.value = '';
    });

  const status = form.querySelector('[data-post-media-status]');
  const file = fileInput.files?.[0];
  if (status) {
    status.textContent = file ? `Attached: ${file.name}` : 'Text only. Attach a photo or video from your phone if you want.';
  }
});

app.addEventListener('click', (event) => {
  const toggle = event.target instanceof HTMLElement ? event.target.closest('[data-toggle="collapse"]') : null;
  if (toggle) {
    const targetId = toggle.getAttribute('data-target');
    const content = targetId ? document.getElementById(targetId) : null;
    if (content) {
      const shouldCollapse = !content.hasAttribute('hidden');
      content.toggleAttribute('hidden', shouldCollapse);
      content.classList.toggle('collapsed', shouldCollapse);
      const isExpanded = !shouldCollapse;
      toggle.setAttribute('aria-expanded', String(isExpanded));
      const indicator = toggle.querySelector('.collapse-indicator');
      if (indicator) {
        indicator.textContent = isExpanded ? '−' : '+';
      }
    }
    return;
  }

  const dashboardChoice = event.target instanceof HTMLElement ? event.target.closest('[data-dashboard-filter]') : null;
  if (dashboardChoice) {
    const nextFilter = dashboardChoice.getAttribute('data-dashboard-filter');
    if (nextFilter) {
      selectedDashboardFilter = nextFilter;
      seasonFormMessage = '';
      postStatusMessage = '';
      const href = dashboardChoice.getAttribute('href');
      if (href && href.startsWith('/')) {
        event.preventDefault();
        window.history.pushState({}, '', href);
      }
      renderApp();
    }
    return;
  }

  const scheduleChoice = event.target instanceof HTMLElement ? event.target.closest('[data-action="select-tournament"]') : null;
  if (scheduleChoice) {
    const nextIndex = Number(scheduleChoice.getAttribute('data-event-index'));
    if (!Number.isNaN(nextIndex)) {
      selectedTournamentIndex = nextIndex;
      syncScorekeeperGroupLineupsForSelectedTournament();
      renderApp();
    }
    return;
  }

  const courseChoice = event.target instanceof HTMLElement ? event.target.closest('[data-action="select-course"]') : null;
  if (courseChoice) {
    const nextCourseId = courseChoice.getAttribute('data-course-id');
    if (nextCourseId) {
      selectedCourseId = nextCourseId;
      selectedCourseNine = 'front';
      renderApp();
    }
    return;
  }

  const courseNineChoice = event.target instanceof HTMLElement ? event.target.closest('[data-action="select-course-nine"]') : null;
  if (courseNineChoice) {
    const nextNine = courseNineChoice.getAttribute('data-course-nine');
    if (nextNine === 'front' || nextNine === 'back') {
      selectedCourseNine = nextNine;
      renderApp();
    }
    return;
  }

  const scoreButton = event.target instanceof HTMLElement ? event.target.closest('[data-action="increment-score"], [data-action="decrement-score"]') : null;
  if (scoreButton) {
    const scoreKey = scoreButton.getAttribute('data-score-key');
    if (!scoreKey) {
      return;
    }

    const currentValue = scorekeeperScoresByHole[currentScoringHoleIndex]?.[scoreKey] ?? '+3';
    const numericValue = Number.parseInt(currentValue, 10) || 3;
    const direction = scoreButton.getAttribute('data-action') === 'increment-score' ? 1 : -1;
    const nextNumericValue = numericValue + direction;
    const nextValue = nextNumericValue >= 0 ? `+${nextNumericValue}` : `${nextNumericValue}`;

    if (!scorekeeperScoresByHole[currentScoringHoleIndex]) {
      scorekeeperScoresByHole[currentScoringHoleIndex] = {};
    }

    scorekeeperScoresByHole[currentScoringHoleIndex][scoreKey] = nextValue;
    renderApp();
    return;
  }

  const scoreEditButton = event.target instanceof HTMLElement ? event.target.closest('[data-action="increment-score-edit"], [data-action="decrement-score-edit"]') : null;
  if (scoreEditButton) {
    const form = scoreEditButton.closest('form[data-action="edit-player-score"]');
    if (!form) {
      return;
    }

    const valueInput = form.querySelector('input[name="scoreValue"]') as HTMLInputElement | null;
    const holeInput = form.querySelector('input[name="scoreHole"]') as HTMLInputElement | null;
    if (!valueInput || !holeInput) {
      return;
    }

    const currentValue = normalizeScoreEditValue(valueInput.value);
    const numericValue = currentValue === 'E' ? 0 : Number.parseInt(currentValue, 10) || 0;
    const nextNumericValue = numericValue + (scoreEditButton.getAttribute('data-action') === 'increment-score-edit' ? 1 : -1);
    const nextValue = nextNumericValue === 0 ? 'E' : nextNumericValue > 0 ? `+${nextNumericValue}` : `${nextNumericValue}`;

    valueInput.value = nextValue;

    const currentValueText = document.querySelector('#score-edit-current-value');
    const holeNumber = Number.parseInt(holeInput.value, 10) || 1;
    if (currentValueText) {
      currentValueText.textContent = `Hole ${holeNumber} was ${nextValue}`;
    }
    return;
  }

  const holeEditButton = event.target instanceof HTMLElement ? event.target.closest('[data-action="increment-hole-edit"], [data-action="decrement-hole-edit"]') : null;
  if (holeEditButton) {
    const form = holeEditButton.closest('form[data-action="edit-player-score"]');
    if (!form) {
      return;
    }

    const holeInput = form.querySelector('input[name="scoreHole"]') as HTMLInputElement | null;
    if (!holeInput) {
      return;
    }

    const currentHole = Number.parseInt(holeInput.value, 10) || 1;
    const nextHole = Math.min(Math.max(currentHole + (holeEditButton.getAttribute('data-action') === 'increment-hole-edit' ? 1 : -1), 1), 18);
    holeInput.value = String(nextHole);
    refreshScoreEditModalFromSelection(form);
    return;
  }

  const scoreSubmitButton = event.target instanceof HTMLElement ? event.target.closest('[data-score-direction]') : null;
  if (scoreSubmitButton && scoreSubmitButton.closest('form[data-action="scorekeeper-scoring"]')) {
    const form = scoreSubmitButton.closest('form');
    if (!form) {
      return;
    }

    lastScoreDirection = (scoreSubmitButton.getAttribute('data-score-direction') as 'next' | 'previous') || 'next';
    submitScorekeeperScoringForm(form, lastScoreDirection);
    return;
  }

  const playerScoreRow = event.target instanceof HTMLElement ? event.target.closest('[data-player-score-row]') : null;
  if (playerScoreRow) {
    const modal = document.querySelector('#score-edit-modal') as HTMLDialogElement | null;
    const groupName = playerScoreRow.getAttribute('data-group');
    const playerName = playerScoreRow.getAttribute('data-player');
    const teamName = playerScoreRow.getAttribute('data-team');

    if (modal && groupName && playerName && teamName) {
      const meta = document.querySelector('#score-edit-player-meta');
      const currentValue = document.querySelector('#score-edit-current-value');
      if (meta) {
        meta.textContent = `${groupName} · ${teamName} · ${playerName}`;
      }

      const form = modal.querySelector('form[data-action="edit-player-score"]') as HTMLFormElement | null;
      if (form) {
        const holeInput = form.querySelector('input[name="scoreHole"]') as HTMLInputElement | null;
        const groupInput = form.querySelector('input[name="scoreGroup"]') as HTMLInputElement | null;
        const playerInput = form.querySelector('input[name="scorePlayer"]') as HTMLInputElement | null;
        const teamInput = form.querySelector('input[name="scoreTeam"]') as HTMLInputElement | null;

        if (holeInput) {
          holeInput.value = '1';
        }
        if (groupInput) {
          groupInput.value = groupName;
        }
        if (playerInput) {
          playerInput.value = playerName;
        }
        if (teamInput) {
          teamInput.value = teamName;
        }
        refreshScoreEditModalFromSelection(form);
      }

      modal.showModal();
    }
    return;
  }

  const closeScoreEdit = event.target instanceof HTMLElement ? event.target.closest('[data-close-score-edit]') : null;
  if (closeScoreEdit) {
    const modal = document.querySelector('#score-edit-modal') as HTMLDialogElement | null;
    if (modal) {
      modal.close();
    }
    return;
  }

  const closeScoreReview = event.target instanceof HTMLElement ? event.target.closest('[data-close-score-review]') : null;
  if (closeScoreReview) {
    const modal = document.querySelector('#score-review-modal') as HTMLDialogElement | null;
    if (modal) {
      modal.close();
    }
    pendingPlayerScoreReview = null;
    return;
  }

  const confirmScoreReview = event.target instanceof HTMLElement ? event.target.closest('[data-confirm-score-review]') : null;
  if (confirmScoreReview) {
    const modal = document.querySelector('#score-review-modal') as HTMLDialogElement | null;
    if (modal) {
      modal.close();
    }
    pendingPlayerScoreReview = null;
    renderApp();
    return;
  }

  const approvalGroupSelector = event.target instanceof HTMLElement ? event.target.closest('[data-select-approval-group]') : null;
  if (approvalGroupSelector) {
    const groupName = approvalGroupSelector.getAttribute('data-select-approval-group');
    if (groupName) {
      selectedApprovalGroup = groupName;
      renderApp();
    }
    return;
  }

  const approvalButton = event.target instanceof HTMLElement ? event.target.closest('[data-approve-group]') : null;
  if (approvalButton) {
    const groupName = approvalButton.getAttribute('data-approve-group');
    if (groupName && hasGroupSubmittedAllHoles(groupName)) {
      approvedGroups[groupName] = true;
      selectedApprovalGroup = groupName;
      saveScorekeeperState();
      renderApp();
    }
    return;
  }

  const bulkApprovalButton = event.target instanceof HTMLElement ? event.target.closest('[data-approve-all-scores]') : null;
  if (bulkApprovalButton) {
    const allGroupsReady = scorekeeperGroupLabels.every(hasGroupSubmittedAllHoles);
    if (allGroupsReady) {
      scorekeeperGroupLabels.forEach((group) => {
        approvedGroups[group] = true;
      });
      finishOrder = normalizeFinishOrder(scorekeeperGroupLabels, finishOrder);
      saveScorekeeperState();
      renderApp();
    }
    return;
  }

  const setFinishOrderButton = event.target instanceof HTMLElement ? event.target.closest('[data-set-order-of-finish]') : null;
  if (setFinishOrderButton) {
    finishOrder = normalizeFinishOrder(scorekeeperGroupLabels, finishOrder);
    saveScorekeeperState();
    renderApp();
    return;
  }

  const submitPlayoffWinnerButton = event.target instanceof HTMLElement ? event.target.closest('[data-submit-playoff-winner]') : null;
  if (submitPlayoffWinnerButton) {
    document.querySelectorAll<HTMLInputElement>('[data-playoff-distance-team]').forEach((input) => {
      const teamName = input.getAttribute('data-playoff-distance-team');
      if (!teamName) {
        return;
      }
      const value = Number.parseFloat(input.value);
      if (Number.isFinite(value)) {
        teamPlayoffDistances[teamName] = value;
      } else {
        delete teamPlayoffDistances[teamName];
      }
    });
    saveScorekeeperState();

    const tiedTeams = getTeamFinishEntries().reduce((list, entry) => {
      const score = entry.score;
      const firstValue = list[0]?.score;
      if (!firstValue) {
        list.push(entry);
        return list;
      }
      if (score === firstValue) {
        list.push(entry);
      }
      return list;
    }, [] as Array<{ teamName: string; score: number; playoffDistance: number }>);

    const winner = tiedTeams.reduce((best, current) => {
      const bestDistance = getTeamPlayoffDistance(best.teamName);
      const currentDistance = getTeamPlayoffDistance(current.teamName);
      return currentDistance < bestDistance ? current : best;
    }, tiedTeams[0]);

    if (winner) {
      const allTeams = getTeamFinishEntries();
      const winnerSet = new Set([winner.teamName]);
      const reordered = [...allTeams].sort((left, right) => {
        if (winnerSet.has(left.teamName)) {
          return -1;
        }
        if (winnerSet.has(right.teamName)) {
          return 1;
        }
        return left.score - right.score || (getTeamPlayoffDistance(left.teamName) - getTeamPlayoffDistance(right.teamName));
      });
      finishOrder = reordered.map((entry) => entry.teamName);
      teamFinishOrderConfirmed = false;
      delete confirmedEventScores[getSelectedTournamentId()];
      saveScorekeeperState();
      renderApp();
    }
    return;
  }

  const confirmTeamFinishOrderButton = event.target instanceof HTMLElement ? event.target.closest('[data-confirm-team-finish-order]') : null;
  if (confirmTeamFinishOrderButton) {
    confirmSelectedTournamentResults();
    return;
  }

  const playoffDistanceInput = event.target instanceof HTMLInputElement && event.target.matches('[data-playoff-distance-team]') ? event.target : null;
  if (playoffDistanceInput) {
    const teamName = playoffDistanceInput.getAttribute('data-playoff-distance-team');
    if (teamName) {
      const value = Number.parseFloat(playoffDistanceInput.value);
      if (Number.isFinite(value)) {
        teamPlayoffDistances[teamName] = value;
      } else {
        delete teamPlayoffDistances[teamName];
      }
      saveScorekeeperState();
    }
    return;
  }

  const moveFinishOrderButton = event.target instanceof HTMLElement ? event.target.closest('[data-move-finish-order]') : null;
  if (moveFinishOrderButton) {
    const groupName = moveFinishOrderButton.getAttribute('data-move-finish-order');
    const direction = moveFinishOrderButton.getAttribute('data-finish-direction');
    if (groupName && (direction === 'up' || direction === 'down')) {
      const nextOrder = [...finishOrder];
      const index = nextOrder.findIndex((entry) => entry === groupName);
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (index >= 0 && targetIndex >= 0 && targetIndex < nextOrder.length) {
        [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
        finishOrder = normalizeFinishOrder(scorekeeperGroupLabels, nextOrder);
        saveScorekeeperState();
        renderApp();
      }
    }
    return;
  }

  const seedAllScoresButton = event.target instanceof HTMLElement ? event.target.closest('[data-seed-all-group-scores]') : null;
  if (seedAllScoresButton) {
    seedAllGroupScoresForTesting();
    return;
  }

  const seedDraftButton = event.target instanceof HTMLElement ? event.target.closest('[data-seed-fantasy-draft]') : null;
  if (seedDraftButton) {
    seedFantasyDraft();
    return;
  }

  const seedScoredEventButton = event.target instanceof HTMLElement ? event.target.closest('[data-seed-scored-event]') : null;
  if (seedScoredEventButton) {
    seedScoredEventAndDraft();
    return;
  }

  const advanceDraftButton = event.target instanceof HTMLElement ? event.target.closest('[data-advance-draft]') : null;
  if (advanceDraftButton) {
    advanceFantasyDraftPicks(Number(advanceDraftButton.getAttribute('data-advance-draft')) || 1);
    return;
  }

  const draftTournamentButton = event.target instanceof HTMLElement ? event.target.closest('[data-draft-tournament]') : null;
  if (draftTournamentButton) {
    stopDraftClock();
    selectedDraftTournamentId = draftTournamentButton.getAttribute('data-draft-tournament');
    renderApp();
    return;
  }

  const startDraftButton = event.target instanceof HTMLElement ? event.target.closest('[data-start-fantasy-draft]') : null;
  if (startDraftButton) {
    startFantasyDraft();
    return;
  }

  const draftPickButton = event.target instanceof HTMLElement ? event.target.closest('[data-draft-pick]') : null;
  if (draftPickButton) {
    makeDraftPick(draftPickButton.getAttribute('data-draft-pick') ?? '');
    return;
  }

  const draftTimerButton = event.target instanceof HTMLElement ? event.target.closest('[data-draft-timer]') : null;
  if (draftTimerButton) {
    setFantasyDraftTimer(Number(draftTimerButton.getAttribute('data-draft-timer')) || 60);
    return;
  }

  const autoPickToggle = event.target instanceof HTMLElement ? event.target.closest('[data-toggle-draft-autopick]') : null;
  if (autoPickToggle) {
    draftAutoPickEnabled = !draftAutoPickEnabled;
    renderApp();
    return;
  }

  const resetDraftButton = event.target instanceof HTMLElement ? event.target.closest('[data-reset-fantasy-draft]') : null;
  if (resetDraftButton) {
    resetFantasyDraft();
    return;
  }

  const resetStateButton = event.target instanceof HTMLElement ? event.target.closest('[data-reset-scorekeeper-state]') : null;
  if (resetStateButton) {
    resetScorekeeperState();
    return;
  }

  const resetAllDataButton = event.target instanceof HTMLElement ? event.target.closest('[data-reset-all-mock-data]') : null;
  if (resetAllDataButton) {
    resetAllMockData();
    return;
  }

  const scoreHoleInput = event.target instanceof HTMLInputElement && event.target.name === 'scoreHole' && event.target.closest('form[data-action="edit-player-score"]') ? event.target : null;
  if (scoreHoleInput) {
    const form = scoreHoleInput.closest('form');
    if (form) {
      refreshScoreEditModalFromSelection(form);
    }
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target.closest('a[href]') : null;
  if (!target) {
    return;
  }

  const href = target.getAttribute('href');
  if (!href || !href.startsWith('/')) {
    return;
  }

  event.preventDefault();
  window.history.pushState({}, '', href);
  renderApp();
});

app.addEventListener('submit', (event) => {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) {
    return;
  }

  event.preventDefault();
  const action = form.dataset.action;

  if (action === 'scorekeeper-assignment') {
    const allAssigned = scorekeeperGroupLabels.every((group) => {
      const assignmentField = form.querySelector(`select[name="${group}"]`) as HTMLSelectElement | null;
      const selected = assignmentField?.value?.trim();
      if (selected) {
        scorekeeperAssignments[group] = selected;
        return true;
      }
      return false;
    });

    if (allAssigned) {
      scorekeeperScoringStage = 'scoring';
      currentScoringHoleIndex = 0;
      scorekeeperScoresByHole = {};
      approvedGroups = {};
      saveScorekeeperState();
    }
    renderApp();
    return;
  }

  if (action === 'scorekeeper-scoring') {
    const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
    const fallbackSubmitter = form.querySelector('[data-score-direction]') as HTMLElement | null;
    const direction = (submitter?.getAttribute('data-score-direction') ?? lastScoreDirection ?? fallbackSubmitter?.getAttribute('data-score-direction') ?? 'next') as 'next' | 'previous';
    lastScoreDirection = 'next';
    submitScorekeeperScoringForm(form, direction);
    return;
  }

  if (action === 'login') {
    const selection = form.querySelector('select[name="userId"]') as HTMLSelectElement | null;
    if (!selection) {
      return;
    }
    setCurrentUser(selection.value);
    renderApp();
    return;
  }

  if (action === 'create-season') {
    const seasonName = form.querySelector('input[name="seasonName"]') as HTMLInputElement | null;
    const purseInput = form.querySelector('input[name="purseAmount"]') as HTMLInputElement | null;
    const currentUser = getCurrentUser();
    if (!seasonName || !purseInput || !SeasonService.canCreateSeason(currentUser)) {
      return;
    }

    const trimmedName = seasonName.value.trim();
    const purseValue = Number(purseInput.value || 4000000);
    if (!trimmedName) {
      seasonFormMessage = 'Enter a season name before creating the season.';
      seasonName.focus();
      renderApp();
      return;
    }

    const seasonId = `season-${Date.now()}`;
    const purseAmount = Number.isFinite(purseValue) && purseValue > 0 ? purseValue : 4_000_000;
    const nextSeed = SeasonService.createNamedSeason(seasonId, trimmedName, purseAmount);

    seed = nextSeed;
    selectedCourseId = seed.courseOptions?.[0]?.id ?? seed.course.id;
    window.localStorage.setItem(SEASON_STORAGE_KEY, JSON.stringify({ id: seasonId, name: trimmedName, purseAmount }));
    seasonFormMessage = `Season "${trimmedName}" is live.`;
    renderApp();
    return;
  }

  if (action === 'post') {
    const content = form.querySelector('textarea[name="content"]') as HTMLTextAreaElement | null;
    const profileId = form.dataset.profileId;
    if (!content || !profileId) {
      return;
    }

    const mediaInputs = Array.from(form.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const selectedFile = mediaInputs.map((input) => input.files?.[0]).find((file): file is File => Boolean(file));
    const text = content.value;

    if (!text.trim() && !selectedFile) {
      postStatusMessage = 'Add a note, a photo, or a video before publishing.';
      renderApp();
      return;
    }

    void (async () => {
      const media = selectedFile ? await readPostMedia(selectedFile) : undefined;
      if (selectedFile && !media) {
        postStatusMessage = 'That file type is not supported. Use a photo or a video.';
        renderApp();
        return;
      }

      const persisted = submitFanPost(profileId, text, media ?? undefined);
      postStatusMessage = persisted
        ? 'Sent to the league for review.'
        : 'Sent for review, but the attachment was too large to keep in local storage.';
      renderApp();
    })();
    return;
  }

  if (action === 'review-post') {
    const submissionId = form.dataset.submissionId;
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const decision = submitter?.value === 'reject' ? 'reject' : 'approve';
    const noteInput = form.querySelector('input[name="reviewNote"]') as HTMLInputElement | null;

    if (submissionId) {
      reviewFanPost(submissionId, decision, getCurrentUser(), noteInput?.value.trim() || undefined);
    }

    renderApp();
    return;
  }

  if (action === 'edit-player-score') {
    const groupName = form.querySelector('input[name="scoreGroup"]') as HTMLInputElement | null;
    const playerName = form.querySelector('input[name="scorePlayer"]') as HTMLInputElement | null;
    const teamName = form.querySelector('input[name="scoreTeam"]') as HTMLInputElement | null;
    const holeInput = form.querySelector('input[name="scoreHole"]') as HTMLInputElement | null;
    const valueInput = form.querySelector('input[name="scoreValue"]') as HTMLInputElement | null;

    if (!groupName || !playerName || !teamName || !holeInput || !valueInput) {
      return;
    }

    const holeNumber = Number.parseInt(holeInput.value, 10);
    const playerKey = `${groupName.value}|${teamName.value}|${playerName.value}`;
    const storedValue = convertDisplayedHoleValueToStoredScore(valueInput.value);

    if (Number.isInteger(holeNumber) && holeNumber >= 1 && holeNumber <= 18) {
      if (!scorekeeperScoresByHole[holeNumber - 1]) {
        scorekeeperScoresByHole[holeNumber - 1] = {};
      }
      scorekeeperScoresByHole[holeNumber - 1][playerKey] = storedValue;
      saveScorekeeperState();
      renderApp();
      openPlayerScoreReviewModal(groupName.value, playerName.value, teamName.value);
    }
  }
});

window.addEventListener('popstate', renderApp);
renderApp();
