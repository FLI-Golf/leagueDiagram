import './styles.css';
import { resolveAppRoute, getProPlayers, getTeamSummaries } from './application/AppRoutes';
import { SeasonService } from './application/SeasonService';
import { UserProfile } from './domain/user/UserProfile';

const seed = SeasonService.createRealisticLeagueSeed('league-demo', 'App Development');
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
  new UserProfile('league-admin', 'League Admin', 'admin@fli.example.com', ['leagueAdmin', 'scorekeeper', 'viewer'], 'League operations and scoring lead'),
  new UserProfile('fantasy-owner', 'Fantasy Owner', 'fantasy-owner@fli.example.com', ['fantasyLeagueOwner', 'fantasyParticipant', 'viewer'], 'Controls the fantasy league and participant rules'),
];

const userDirectory = [...proProfiles, ...adminProfiles];

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

const renderNav = (active: 'home' | 'teams' | 'pros' | 'diagram') => `
  <nav class="top-nav" aria-label="Primary navigation">
    <a class="nav-link ${active === 'home' ? 'active' : ''}" href="/">Overview</a>
    <a class="nav-link ${active === 'teams' ? 'active' : ''}" href="/teams">Teams</a>
    <a class="nav-link ${active === 'pros' ? 'active' : ''}" href="/pros">Pros</a>
    <a class="nav-link ${active === 'diagram' ? 'active' : ''}" href="/diagram">Diagram</a>
  </nav>
`;

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

const getRoleMenus = (user: UserProfile): Array<{ label: string; href: string; detail: string }> => {
  const menus: Array<{ label: string; href: string; detail: string }> = [];

  if (user.hasRole('pro')) {
    menus.push({ label: 'Fan feed', href: `/pros/${user.id}`, detail: 'Post updates and share course notes.' });
    menus.push({ label: 'Team profile', href: `/teams`, detail: 'Review your roster and team context.' });
    menus.push({ label: 'Player content', href: `/pros`, detail: 'Browse the pro roster and player pages.' });
  }

  if (user.hasRole('leagueAdmin')) {
    menus.push({ label: 'League admin', href: '/', detail: 'Manage league settings and member access.' });
    menus.push({ label: 'Scorekeeper review', href: '/', detail: 'Review tournament and scoring updates.' });
  }

  if (user.hasRole('scorekeeper')) {
    menus.push({ label: 'Scorekeeper pipeline', href: '/', detail: 'Track score submissions and pipeline status.' });
    menus.push({ label: 'Standings', href: '/', detail: 'Monitor league standings and event results.' });
  }

  if (user.hasRole('fantasyLeagueOwner')) {
    menus.push({ label: 'Fantasy league', href: '/', detail: 'Manage owners, drafts, and roster settings.' });
    menus.push({ label: 'Draft controls', href: '/', detail: 'Review draft order and fantasy decisions.' });
  }

  if (user.hasRole('fantasyParticipant')) {
    menus.push({ label: 'Fantasy roster', href: '/', detail: 'Check drafted players and team performance.' });
    menus.push({ label: 'League activity', href: '/', detail: 'View fantasy movement and updates.' });
  }

  if (menus.length === 0) {
    menus.push({ label: 'Overview', href: '/', detail: 'Standard viewer access for reading the league.' });
  }

  return menus;
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
    access.push('Scorekeeping pipeline and standings review');
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
      <h2>${currentUser.displayName}'s workspace</h2>
      <div class="menu-grid">
        ${menus
          .map(
            (menu) => `
              <a class="menu-card" href="${menu.href}">
                <span class="menu-label">${menu.label}</span>
                <span class="menu-detail">${menu.detail}</span>
              </a>
            `,
          )
          .join('')}
      </div>
    </section>
  `;
};

const renderHomePage = (): string => {
  const leagueMembers = seed.season.league.getParticipants();
  const teamSummaries = getTeamSummaries(seed);
  const proPlayers = getProPlayers(seed);
  const reservePros = seed.reservePros ?? [];
  const holeCards = seed.course
    .getHoles()
    .map((hole) => {
      const prize = seed.holeMetadata.find((entry) => entry.holeNumber === hole.number);
      const sponsorNames = hole.getSponsors().map((sponsor) => sponsor.name).join(', ') || 'No sponsor';
      return `
        <li class="hole-card">
          <h4>Hole ${hole.number}: ${hole.name}</h4>
          <p>${hole.description}</p>
          <p><strong>Basket:</strong> ${hole.basketSetup}</p>
          <p><strong>Sponsor:</strong> ${sponsorNames}</p>
          ${
            prize
              ? `<p><strong>Prize:</strong> ${prize.title} — $${prize.prize.amount} ${prize.prize.currency}</p>`
              : '<p><strong>Prize:</strong> none</p>'
          }
        </li>
      `;
    })
    .join('');

  const currentUser = getCurrentUser();

  return `
    <main class="page-shell">
      <header class="hero">
        <div class="title-group">
          <p class="eyebrow">League seed</p>
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

      <div class="nav-under-dashboard">
        ${renderNav('home')}
      </div>

      <section class="summary-grid">
        <article class="panel">
          <h2>League snapshot</h2>
          <ul>
            <li><strong>League ID:</strong> ${seed.season.league.id}</li>
            <li><strong>Participants:</strong> ${leagueMembers.length}</li>
            <li><strong>Fantasy teams:</strong> ${seed.season.fantasyTeams.length}</li>
            <li><strong>Draft orders:</strong> ${seed.season.draftOrders.length}</li>
          </ul>
        </article>

        <article class="panel">
          <h2>Course</h2>
          <ul>
            <li><strong>Name:</strong> ${seed.course.name}</li>
            <li><strong>Holes:</strong> ${seed.course.getHoles().length}</li>
            <li><strong>Sponsors:</strong> ${seed.sponsors.length}</li>
            <li><strong>Events:</strong> ${seed.schedule.getEvents().length}</li>
          </ul>
        </article>
      </section>

      <section class="panel">
        <h2>Role data access</h2>
        <p class="role-access-note">Viewing as: <strong>${getCurrentUser().displayName}</strong> (${getCurrentUser().getRoles().join(', ')})</p>
        <ul class="list-block">
          ${getRoleAccessSummary(getCurrentUser())
            .map((entry) => `<li><strong>•</strong> ${entry}</li>`)
            .join('')}
        </ul>
      </section>

      <section class="panel">
        <h2>Quick links</h2>
        <div class="stat-list">
          <a class="stat-tile" href="/teams"><strong>${teamSummaries.length}</strong><span>Teams</span></a>
          <a class="stat-tile" href="/pros"><strong>${proPlayers.length}</strong><span>Pros</span></a>
          <a class="stat-tile" href="/pros"><strong>${reservePros.length}</strong><span>Reserves</span></a>
        </div>
      </section>

      <section class="panel">
        <h2>Reserve pros</h2>
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

      <section class="panel">
        <h2>Tournament schedule</h2>
        <ul class="list-block">
          ${seed.schedule
            .getEvents()
            .map(
              (event) => `
                <li>
                  <strong>${event.date}</strong> — ${event.result.name}
                </li>
              `,
            )
            .join('')}
        </ul>
      </section>

      <section class="panel">
        <h2>Course holes</h2>
        <ul class="hole-list">${holeCards}</ul>
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
        ${renderNav('teams')}
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
        ${renderNav('teams')}
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
        ${renderNav('pros')}
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
        ${renderNav('pros')}
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
        ${renderNav('diagram')}
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

  if (action === 'login') {
    const selection = form.querySelector('select[name="userId"]') as HTMLSelectElement | null;
    if (!selection) {
      return;
    }
    setCurrentUser(selection.value);
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
