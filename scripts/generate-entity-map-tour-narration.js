/**
 * Adds narration to an entity map tour recording.
 *
 * Generates one ElevenLabs clip for the single-segment recording (when
 * ELEVENLABS_API_KEY is set, via env or .env), muxes it with the video, and
 * writes the narrated outputs to demo/exports/entity-map-tour/.
 *
 * Usage: node scripts/generate-entity-map-tour-narration.js [--view league]
 * Prereq: run `DIAGRAM_VIEW=<view> npx playwright test entity-map-tour` first.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const viewArg = process.argv.find((arg) => arg.startsWith('--view='));
const VIEW_KEY = viewArg ? viewArg.slice('--view='.length) : 'pros';

const NARRATION_BY_VIEW = {
  pros:
    'A guided tour of the pros entity map — first the whole map at a glance. Green edges mean has many; blue edges mean has one. ' +
    'UserProfile is the account behind a pro, admin, scorekeeper, or fan. Player is a pro on a team, with scorecards and an account. ' +
    'A Team is a mixed pair of pros entered in the tournament. The Scorecard holds hole-by-hole results for one pro in one round. ' +
    'A ContentSubmission is a post with its review status. And the ContentPipeline holds pro posts until an admin approves them.',
  league:
    'Here is the league entity map at a glance — then each entity in turn. Green edges mean has many; blue edges mean has one. ' +
    'A UserLeague is the membership container that owns invites, participants, and draft orders. The Season is the parent record with its purse and sponsorship program. ' +
    'The SponsorshipProgram holds the season sponsorships, and each Sponsorship is one agreement with a brand. ' +
    'SeasonBootstrapResult is the assembled seed handed to the app. The EventSchedule carries the dated tournaments, ' +
    'TournamentResult the ranked results for one event, and the LeagueTable rolls every event up into cumulative standings.',
  fantasy:
    'Here is the fantasy entity map at a glance — then each entity in turn. Green edges mean has many; blue edges mean has one. ' +
    'The FantasyLeague is the competition that owns the teams and the draft. Each FantasyTeam is one manager and the roster they drafted. ' +
    'The FantasyRoster holds the drafted set, and each FantasyPlayer is a league pro wrapped with fantasy scoring. ' +
    'FantasyScoring turns approved event scores into fantasy standings, based on the TournamentResult. ' +
    'The FantasyDraft holds the rounds, picks, and resulting rosters, and the DraftRoom is the live draft state with pick timers and auto picks.',
  course:
    'Here is the course entity map at a glance. Green edges mean has many; blue edges mean has one. ' +
    'The Course is a playable layout used by a tournament. Each Hole carries distance, basket placement, and sponsor branding. ' +
    'And a Sponsor is the brand attached to a hole or the league.',
  sponsorship:
    'Here is the sponsorship entity map at a glance — who is paying for what. Green edges mean has many; blue edges mean has one. ' +
    'The SponsorshipProgram holds all of a season\u2019s sponsorships, starting with the single title sponsor. Each Sponsorship is one agreement: sponsor, tier, scope, amount, and status. ' +
    'A Sponsor is the brand behind an agreement. The Season carries the title sponsorship, the Course carries venue deals, ' +
    'each Hole carries branding, and Players and Teams carry endorsement deals.',
  pipelines:
    'Here is the pipelines entity map at a glance — nothing becomes official without review. Green edges mean has many; blue edges mean has one. ' +
    'The ScorekeeperPipeline blocks approval until every team has a score for every hole. TournamentResult holds the ranked scorecards, ' +
    'and FantasyScoring derives fantasy standings from approved scores. A Group is the paired teams a scorekeeper covers; each ScoreEntry is one team score on one hole. ' +
    'And the ContentPipeline holds pro posts until an admin approves them, one ContentSubmission at a time.',
  overview:
    'Here is the full entity map at a glance — everything hangs off the season. Green edges mean has many; blue edges mean has one. ' +
    'The Season is the parent record; the UserLeague owns memberships, invites, and draft orders; the EventSchedule carries the tournaments, ' +
    'and each TournamentResult is one event\u2019s teams and ranked scorecards. The ScorekeeperPipeline blocks approval until every card is complete, ' +
    'and the LeagueTable rolls results into standings. A Course is the layout played, Teams are mixed pairs, and each Player carries scorecards and an account. ' +
    'The ContentPipeline gates pro posts, and on the fantasy side the FantasyLeague owns the teams and the draft, while FantasyScoring turns approved scores into fantasy standings.',
};

const NARRATION_TEXT = NARRATION_BY_VIEW[VIEW_KEY];
if (!NARRATION_TEXT) {
  throw new Error(`Unknown view "${VIEW_KEY}". Known views: ${Object.keys(NARRATION_BY_VIEW).join(', ')}`);
}

const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', `entity-map-tour-${VIEW_KEY}`);
const VIDEO_WEBM = path.join(CAPTURE_DIR, `entity-map-tour-${VIEW_KEY}.webm`);
const AUDIO_MP3 = path.join(CAPTURE_DIR, `entity-map-tour-${VIEW_KEY}-narration.mp3`);
// Finals live outside demo/captures, which Playwright wipes on every run.
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'entity-map-tour');
const FINAL_MP4 = path.join(EXPORT_DIR, `entity-map-tour-${VIEW_KEY}.mp4`);
const FINAL_WEBM = path.join(EXPORT_DIR, `entity-map-tour-${VIEW_KEY}.webm`);

const VOICE_ID = process.env.DEMO_NARRATION_VOICE ?? '21m00Tcm4TlvDq8ikWAM';

const loadApiKey = () => {
  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }
  const envFile = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) {
    return null;
  }
  const line = fs
    .readFileSync(envFile, 'utf8')
    .split('\n')
    .find((entry) => entry.startsWith('ELEVENLABS_API_KEY='));
  return line ? line.slice('ELEVENLABS_API_KEY='.length).trim().replace(/^['"]|['"]$/g, '') : null;
};

const durationOf = (file) =>
  Number.parseFloat(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim(),
  );

const main = async () => {
  if (!fs.existsSync(VIDEO_WEBM)) {
    throw new Error(`Missing ${VIDEO_WEBM}. Run \`DIAGRAM_VIEW=${VIEW_KEY} npx playwright test entity-map-tour\` first.`);
  }

  const apiKey = loadApiKey();
  if (apiKey) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text: NARRATION_TEXT,
        model_id: 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
      }),
    });
    if (!response.ok) {
      throw new Error(`ElevenLabs request failed: ${await response.text()}`);
    }
    fs.writeFileSync(AUDIO_MP3, Buffer.from(await response.arrayBuffer()));
  } else if (!fs.existsSync(AUDIO_MP3)) {
    throw new Error('No ELEVENLABS_API_KEY found and no existing narration clip to reuse.');
  }

  const videoDuration = durationOf(VIDEO_WEBM);
  const audioDuration = durationOf(AUDIO_MP3);

  // Never cut narration off: freeze the video's last frame to fit the audio,
  // plus a short tail so the video does not end abruptly.
  const tailSeconds = 0.4;
  const targetDuration = Math.max(videoDuration, audioDuration) + tailSeconds;
  const videoPadSeconds = targetDuration - videoDuration;
  if (audioDuration > videoDuration) {
    console.log(`Narration (${audioDuration.toFixed(1)}s) runs past the video (${videoDuration.toFixed(1)}s); freezing the last frame to fit.`);
  }

  const filterGraph = `[0:v]tpad=stop_mode=clone:stop=${videoPadSeconds.toFixed(2)}[v];[1:a]apad,atrim=0:${targetDuration.toFixed(2)},afade=t=out:st=${(targetDuration - 0.6).toFixed(2)}:d=0.6[a]`;

  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  execFileSync('ffmpeg', [
    '-y',
    '-i', VIDEO_WEBM,
    '-i', AUDIO_MP3,
    '-filter_complex',
    filterGraph,
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libx264',
    '-crf', '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    FINAL_MP4,
  ], { stdio: 'ignore' });

  // Also produce a narrated WebM (Playwright records raw video without audio).
  execFileSync('ffmpeg', [
    '-y',
    '-i', VIDEO_WEBM,
    '-i', AUDIO_MP3,
    '-filter_complex',
    filterGraph,
    '-map', '[v]',
    '-map', '[a]',
    '-c:v', 'libvpx-vp9',
    '-crf', '33',
    '-c:a', 'libopus',
    '-b:a', '128k',
    FINAL_WEBM,
  ], { stdio: 'ignore' });

  console.log(`Narrated tour: ${FINAL_MP4} (${durationOf(FINAL_MP4).toFixed(1)}s)`);
  console.log(`Narrated WebM: ${FINAL_WEBM}`);
};

await main();
