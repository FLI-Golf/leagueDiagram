import * as fs from 'node:fs';
import * as path from 'node:path';

import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Demo-only fantasy league lobby API (local/test persistence stand-in).
 *
 * The prototype has no backend, and league memberships are otherwise kept in
 * page memory. The "Fill the league" walkthrough needs five participants to
 * join from separate authenticated browser contexts and the memberships to
 * survive page reloads, so the Vite dev server holds the lobby in memory here.
 * It mirrors the domain rules in `MockDraftSeries.join()`: the owner is seeded
 * first, the league holds exactly six participants, and nobody can join twice.
 * This API only exists while running `npm run dev`; the production build and
 * `vite preview` do not serve it.
 */
const DEMO_LEAGUE_ID = 'league-demo';
const DEMO_OWNER_ID = 'fantasy-owner';
const DEMO_LEAGUE_CAPACITY = 6;

type DemoLeagueLobby = {
  leagueId: string;
  ownerId: string;
  participantIds: string[];
};

const createInitialLobby = (): DemoLeagueLobby => ({
  leagueId: DEMO_LEAGUE_ID,
  ownerId: DEMO_OWNER_ID,
  participantIds: [DEMO_OWNER_ID],
});

let lobby = createInitialLobby();

const sendJson = (res: import('node:http').ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

/**
 * Returns the live source of the 6-of-6 trigger (`join()` through
 * `buildIfReady()`) straight from the domain file, so the demo's "how it
 * works" callout always shows the real code with real line numbers.
 */
const TRIGGER_SOURCE_FILE = 'src/domain/draft/MockDraftSeries.ts';
const TRIGGER_MARKERS = ['this.participants.push', 'this.buildIfReady();', 'for (const tournamentId', 'new DraftRoom('];

const getTriggerSource = () => {
  const absolute = path.resolve(process.cwd(), TRIGGER_SOURCE_FILE);
  const fileLines = fs.readFileSync(absolute, 'utf8').split('\n');
  const startIndex = fileLines.findIndex((line) => line.includes('join(participantId'));
  const endIndex = fileLines.findIndex((line) => line.includes('isFull(): boolean'));
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  return {
    file: TRIGGER_SOURCE_FILE,
    startLine: startIndex + 1,
    lines: fileLines.slice(startIndex, endIndex).map((text, offset) => ({
      no: startIndex + offset + 1,
      text: text.replace(/\s+$/, ''),
      trigger: TRIGGER_MARKERS.some((marker) => text.includes(marker)),
    })),
  };
};

const demoFantasyLeagueApi = (): Plugin => ({
  name: 'demo-fantasy-league-api',
  configureServer(server) {
    server.middlewares.use('/api/demo/fantasy-league', (req, res) => {
      if (req.method === 'GET') {
        const getPath = req.url ?? '';
        if (getPath.endsWith('/trigger-source')) {
          const source = getTriggerSource();
          if (!source) {
            sendJson(res, 500, { error: 'Trigger source unavailable' });
            return;
          }
          sendJson(res, 200, source);
          return;
        }
        sendJson(res, 200, lobby);
        return;
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      let rawBody = '';
      req.on('data', (chunk) => {
        rawBody += chunk;
      });
      req.on('end', () => {
        const path = req.url ?? '';

        if (path.endsWith('/reset')) {
          lobby = createInitialLobby();
          sendJson(res, 200, lobby);
          return;
        }

        if (path.endsWith('/join')) {
          let userId: unknown;
          try {
            userId = (JSON.parse(rawBody || '{}') as { userId?: unknown }).userId;
          } catch {
            sendJson(res, 400, { error: 'Invalid JSON body' });
            return;
          }

          if (typeof userId !== 'string' || userId.trim() === '') {
            sendJson(res, 400, { error: 'A userId is required to join the league.' });
            return;
          }

          if (lobby.participantIds.includes(userId)) {
            sendJson(res, 409, { error: 'That participant has already joined the league.', lobby });
            return;
          }

          if (lobby.participantIds.length >= DEMO_LEAGUE_CAPACITY) {
            sendJson(res, 409, { error: `A fantasy league holds exactly ${DEMO_LEAGUE_CAPACITY} participants.`, lobby });
            return;
          }

          lobby.participantIds.push(userId);
          sendJson(res, 200, lobby);
          return;
        }

        sendJson(res, 404, { error: 'Unknown demo league action' });
      });
    });
  },
});

export default defineConfig({
  plugins: [demoFantasyLeagueApi()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
