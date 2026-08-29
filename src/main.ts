import '@picocss/pico/css/pico.min.css';
import './styles.css';
import { resolveAppRoute, getProPlayers, getTeamSummaries } from './application/AppRoutes';
import { buildGroupScorecard } from './application/ScorecardSummary';
import { SeasonService } from './application/SeasonService';
import { Group } from './domain/pipeline/Group';
import { UserProfile } from './domain/user/UserProfile';

let seed = SeasonService.createRealisticLeagueSeed('league-demo', '');
let selectedTournamentIndex = 0;
let selectedCourseId = seed.courseOptions?.[0]?.id ?? seed.course.id;
let selectedCourseNine = 'front';
let selectedDashboardFilter = 'Manage league';
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
const scorekeeperGroupLineups: Record<string, Array<{ teamName: string; players: string[] }>> = Object.fromEntries(
  scorekeeperGroupLabels.map((groupName, groupIndex) => {
    const teams = seed.realLeagueTeams.slice(groupIndex * 2, groupIndex * 2 + 2);
    return [
      groupName,
      teams.map((team) => ({
        teamName: team.name,
        players: team.players.map((player) => player.displayName),
      })),
    ];
  }),
);
let scorekeeperAssignments: Record<string, string> = { ...defaultScorekeeperAssignments };
let scorekeeperScoringStage: 'assignment' | 'scoring' | 'complete' = 'assignment';
let currentScoringHoleIndex = 0;
let scorekeeperScoresByHole: Record<number, Record<string, string>> = {};
let lastScoreDirection: 'next' | 'previous' = 'next';
const app = document.querySelector('#app');
if (!app) {
  throw new Error('App root not found');
}

const PRO_STORAGE_KEY = 'league-demo-pro-fan-posts';
const USER_STORAGE_KEY = 'league-demo-current-user';

const proProfiles = [
  new UserProfile('simon-lizotte', 'Simon Lizotte', 'simon@fli.example.com', ['pro', 'fantasyParticipant', 'viewer'], 'Disc golf pro and content creator'),
  new UserProfile('paul-mcbeth', 'Paul McBeth', 'paul@fli.example.com', ['pro', 'fantasyLeagueOwner', 'viewer'], 'Tour-level competitor and fantasy league owner'),
  new UserProfile('gannon-buhr', 'Gannon Buhr', 'gannon@fli.example.com', ['pro', 'scorekeeper', 'viewer'], 'Player, analyst, and score oversight lead'),
  new UserProfile('ricky-wysocki', 'Ricky Wysocki', 'ricky@fli.example.com', ['pro', 'viewer'], 'Content creator and course strategy expert'),
];

const adminProfiles = [
  new UserProfile('league-admin', 'League Admin', 'admin@fli.example.com', ['leagueAdmin', 'viewer'], 'League operations and scoring lead'),
  new UserProfile('fantasy-owner', 'Fantasy Owner', 'fantasy-owner@fli.example.com', ['fantasyLeagueOwner', 'fantasyParticipant', 'viewer'], 'Controls the fantasy league and participant rules'),
];

const scorekeeperProfiles = [
  new UserProfile('ava-park', 'Ava Park', 'ava@fli.example.com', ['scorekeeper', 'viewer'], 'Covers Group A'),
  new UserProfile('diego-ruiz', 'Diego Ruiz', 'diego@fli.example.com', ['scorekeeper', 'viewer'], 'Covers Group B'),
  new UserProfile('renee-walsh', 'Renee Walsh', 'renee@fli.example.com', ['scorekeeper', 'viewer'], 'Covers Group C'),
  new UserProfile('maya-brooks', 'Maya Brooks', 'maya@fli.example.com', ['scorekeeper', 'viewer'], 'Covers Group D'),
  new UserProfile('noah-chen', 'Noah Chen', 'noah@fli.example.com', ['scorekeeper', 'viewer'], 'Covers Group E'),
  new UserProfile('jamie-lopez', 'Jamie Lopez', 'jamie@fli.example.com', ['scorekeeper', 'viewer'], 'Covers Group F'),
];

const userDirectory = [...proProfiles, ...adminProfiles, ...scorekeeperProfiles];

const getStoredPosts = (): Record<string, string[]> => {
  try {
    const raw = window.localStorage.getItem(PRO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredPosts = (posts: Record<string, string[]>): void => {
  window.localStorage.setItem(PRO_STORAGE_KEY, JSON.stringify(posts));
};

const getCurrentUser = (): UserProfile => {
  const storedId = window.localStorage.getItem(USER_STORAGE_KEY) ?? proProfiles[0].id;
  return userDirectory.find((user) => user.id === storedId) ?? proProfiles[0];
};

const setCurrentUser = (userId: string): void => {
  window.localStorage.setItem(USER_STORAGE_KEY, userId);
};

const addFanPost = (authorId: string, body: string): void => {
  const trimmed = body.trim();
  if (!trimmed) {
    return;
  }

  const user = userDirectory.find((entry) => entry.id === authorId);
  if (!user || !user.hasRole('pro')) {
    return;
  }

  const allPosts = getStoredPosts();
  const posts = allPosts[authorId] ?? [];
  posts.unshift(trimmed);
  allPosts[authorId] = posts.slice(0, 6);
  saveStoredPosts(allPosts);
};

const getFanPostsForProfile = (profileId: string): string[] => {
  return getStoredPosts()[profileId] ?? [];
};

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
    { label: 'Diagram', href: '/diagram' },
  ];

  if (user.hasRole('pro')) {
    links.splice(2, 0, { label: 'Fan feed', href: `/pros/${user.id}` });
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
    pro: 'Pro',
    leagueAdmin: 'Admin',
    scorekeeper: 'Scorekeeper',
    fantasyLeagueOwner: 'Fantasy owner',
    fantasyParticipant: 'Fantasy participant',
    viewer: 'Viewer',
  };

  return `
    <div class="role-badges">
      ${user
        .getRoles()
        .filter((role) => roleLabels[role])
        .map((role) => `<span class="role-badge role-${role}">${roleLabels[role]}</span>`)
        .join('')}
    </div>
  `;
};

const getAssignedGroupForUser = (user: UserProfile): string | null => {
  const match = Object.entries(scorekeeperAssignments).find(([, person]) => person === user.displayName);
  return match ? match[0] : null;
};

const getRoleMenus = (user: UserProfile): Array<{ label: string; href: string; detail: string; isActive: boolean }> => {
  const dashboardFilterOptions = ['Manage league', 'Scorekeeper scorecard', 'Standings', 'Fantasy league', 'Draft controls', 'Fantasy roster', 'League activity', 'Fan feed', 'Team profile', 'Player content', 'Overview'];
  const activeFilter = dashboardFilterOptions.includes(selectedDashboardFilter)
    ? selectedDashboardFilter
    : user.hasRole('leagueAdmin')
      ? 'Manage league'
      : user.hasRole('scorekeeper')
        ? 'Scorekeeper scorecard'
        : 'Overview';
  const menus: Array<{ label: string; href: string; detail: string; isActive: boolean }> = [];

  if (user.hasRole('pro')) {
    menus.push({ label: 'Fan feed', href: `/pros/${user.id}`, detail: 'Post updates and share course notes.', isActive: false });
    menus.push({ label: 'Team profile', href: `/teams`, detail: 'Review your roster and team context.', isActive: false });
    menus.push({ label: 'Player content', href: `/pros`, detail: 'Browse the pro roster and player pages.', isActive: false });
  }

  if (user.hasRole('leagueAdmin')) {
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

const renderDashboardMenus = (): string => {
  const currentUser = getCurrentUser();
  const menus = getRoleMenus(currentUser);

  return `
    <section class="panel dashboard-panel">
      <p class="eyebrow">Relevant menus</p>
      <h2>${seed.season.league.name} season workspace</h2>
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
          <input type="text" name="seasonName" value="${seed.season.league.name}" placeholder="Autumn Circuit" />
        </label>
        <label>
          <span>Purse amount</span>
          <input type="number" name="purseAmount" value="${seed.season.league.purseAmount ?? 4000000}" min="0" step="100000" />
        </label>
        <button type="submit">Create season</button>
      </form>
    </section>
  `;
};

const renderScorekeeperDashboard = (): string => {
  const currentUser = getCurrentUser();
  const assignedCount = Object.values(scorekeeperAssignments).filter(Boolean).length;
  const pendingAssignments = scorekeeperGroupLabels.filter((group) => !scorekeeperAssignments[group]);
  const totalHoles = 18;
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

const renderHomePage = (): string => {
  const currentUser = getCurrentUser();
  const selectedFilter = selectedDashboardFilter || 'Manage league';

  if (selectedFilter === 'Scorekeeper scorecard' || selectedFilter === 'Standings' || (currentUser.hasRole('scorekeeper') && !!getAssignedGroupForUser(currentUser))) {
    return `
      <main class="page-shell">
        <header class="hero">
          <div class="title-group">
            <p class="eyebrow">Dashboard</p>
            <div class="title-with-badges">
              <h1>${seed.season.league.name}</h1>
              ${renderRoleBadges(currentUser)}
            </div>
          </div>
        </header>

        <section class="dashboard-layout">
          <div class="dashboard-column">${renderDashboardMenus()}</div>
          <div class="dashboard-column">${renderLoginPane()}</div>
        </section>

        ${renderScorekeeperDashboard()}
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
            <h1>${seed.season.league.name}</h1>
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
        <p class="role-access-note">Current season: <strong>${seed.season.league.name}</strong></p>
        <p class="role-access-note">Purse: <strong>$${(seed.season.league.purseAmount ?? 4000000).toLocaleString()}</strong></p>
        <p class="role-access-note">Tee times begin at 3:00 PM PST and run every 10 minutes.</p>
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
    </main>
  `;
};

const renderDiagramPage = (): string => {
  const nodes = [
    {
      name: 'UserProfile',
      summary: 'People in the league and fantasy system.',
      connections: ['UserLeague', 'FantasyLeague', 'Team'],
    },
    {
      name: 'UserLeague',
      summary: 'The league membership that owns invites, participants, and draft orders.',
      connections: ['UserProfile', 'DraftOrder', 'LeagueInvite'],
    },
    {
      name: 'SeasonBootstrapResult',
      summary: 'The assembled season seed with user league, fantasy teams, and draft orders.',
      connections: ['UserLeague', 'FantasyTeam', 'DraftOrder'],
    },
    {
      name: 'FantasyTeam',
      summary: 'Fantasy managers and player rosters.',
      connections: ['FantasyPlayer', 'FantasyLeague'],
    },
    {
      name: 'TournamentResult',
      summary: 'A tournament event with ranked scorecards and point totals.',
      connections: ['Scorecard', 'LeagueTable', 'EventSchedule'],
    },
    {
      name: 'LeagueTable',
      summary: 'Aggregates all tournament results into cumulative standings.',
      connections: ['TournamentResult', 'Scorecard'],
    },
    {
      name: 'Course',
      summary: 'A round layout with holes and sponsor relationships.',
      connections: ['Hole', 'Sponsor'],
    },
    {
      name: 'Hole',
      summary: 'Each hole belongs to a course and can have a sponsor and prize metadata.',
      connections: ['Course', 'Sponsor'],
    },
    {
      name: 'EventSchedule',
      summary: 'Calendarized tournament results across a season.',
      connections: ['TournamentResult', 'LeagueTable'],
    },
  ];

  return `
    <main class="page-shell">
      <header class="hero diagram-hero">
        <div>
          <p class="eyebrow">Schema view</p>
          <h1>League table diagram</h1>
        </div>
        ${renderNav(getCurrentUser(), 'diagram')}
      </header>

      <section class="panel diagram-intro">
        <h2>How the tables connect</h2>
        <p>
          The league is assembled from user profiles, then expanded into memberships, fantasy rosters, course data,
          and tournament results. The standings table rolls up the results from each event.
        </p>
      </section>

      <section class="diagram-grid">
        ${nodes
          .map(
            (node) => `
              <article class="diagram-card">
                <h3>${node.name}</h3>
                <p>${node.summary}</p>
                <ul>
                  ${node.connections.map((connection) => `<li>${connection}</li>`).join('')}
                </ul>
              </article>
            `,
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
    app.innerHTML = renderDiagramPage();
    return;
  }

  app.innerHTML = renderHomePage();
};

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
      seasonName.focus();
      return;
    }

    const nextSeed = SeasonService.createNamedSeason(
      `season-${Date.now()}`,
      trimmedName,
      Number.isFinite(purseValue) && purseValue > 0 ? purseValue : 4_000_000,
    );

    seed = nextSeed;
    renderApp();
    return;
  }

  if (action === 'post') {
    const content = form.querySelector('textarea[name="content"]') as HTMLTextAreaElement | null;
    const profileId = form.dataset.profileId;
    if (!content || !profileId) {
      return;
    }
    addFanPost(profileId, content.value);
    content.value = '';
    renderApp();
  }
});

window.addEventListener('popstate', renderApp);
renderApp();
