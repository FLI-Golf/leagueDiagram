import './styles.css';
import { SeasonService } from './application/SeasonService';

const seed = SeasonService.createRealisticLeagueSeed('league-demo', 'Summer League');

const app = document.querySelector('#app');
if (!app) {
  throw new Error('App root not found');
}

const getRoute = (): string => {
  const pathname = window.location.pathname === '/' ? '/' : window.location.pathname;
  return pathname === '/diagram' ? '/diagram' : '/';
};

const renderHomePage = (): string => {
  const leagueMembers = seed.season.league.getParticipants();
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

  return `
    <main class="page-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">League seed</p>
          <h1>${seed.season.league.name}</h1>
        </div>
        <nav class="top-nav" aria-label="Primary navigation">
          <a class="nav-link active" href="/">Overview</a>
          <a class="nav-link" href="/diagram">Diagram</a>
        </nav>
      </header>

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
        <nav class="top-nav" aria-label="Primary navigation">
          <a class="nav-link" href="/">Overview</a>
          <a class="nav-link active" href="/diagram">Diagram</a>
        </nav>
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
  app.innerHTML = route === '/diagram' ? renderDiagramPage() : renderHomePage();
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

window.addEventListener('popstate', renderApp);
renderApp();
