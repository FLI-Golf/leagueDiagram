import './styles.css';
import { SeasonService } from './application/SeasonService';

const seed = SeasonService.createRealisticLeagueSeed('league-demo', 'Summer League');

const app = document.querySelector('#app');
if (!app) {
  throw new Error('App root not found');
}

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

app.innerHTML = `
  <main class="page-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">League seed</p>
        <h1>${seed.season.league.name}</h1>
      </div>
      <span class="status-pill">6-player league ready</span>
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
