/**
 * Adds narration to the entity map tour.
 *
 * Generates one ElevenLabs clip for the single-segment recording (when
 * ELEVENLABS_API_KEY is set, via env or .env), muxes it with the video, and
 * writes the narrated outputs to demo/exports/entity-map-tour/.
 *
 * Usage: node scripts/generate-entity-map-tour-narration.js
 * Prereq: run `npx playwright test entity-map-tour` first so the WebM exists.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'entity-map-tour');
const VIDEO_WEBM = path.join(CAPTURE_DIR, 'entity-map-tour.webm');
const AUDIO_MP3 = path.join(CAPTURE_DIR, 'entity-map-tour-narration.mp3');
// Finals live outside demo/captures, which Playwright wipes on every run.
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', 'entity-map-tour');
const FINAL_MP4 = path.join(EXPORT_DIR, 'entity-map-tour.mp4');
const FINAL_WEBM = path.join(EXPORT_DIR, 'entity-map-tour.webm');

const VOICE_ID = process.env.DEMO_NARRATION_VOICE ?? '21m00Tcm4TlvDq8ikWAM';

// Sized to the ~45-second single-take recording.
const NARRATION_TEXT =
  'A guided tour of the pros entity map. Green edges mean has many; blue edges mean has one. ' +
  'UserProfile is the account behind a pro, admin, scorekeeper, or fan. Player is a pro on a team, with scorecards and an account. ' +
  'A Team is a mixed pair of pros entered in the tournament. The Scorecard holds hole-by-hole results for one pro in one round. ' +
  'A ContentSubmission is a post with its review status. And the ContentPipeline holds pro posts until an admin approves them.';

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
    throw new Error(`Missing ${VIDEO_WEBM}. Run \`npx playwright test entity-map-tour\` first.`);
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
  if (audioDuration > videoDuration) {
    console.log(`Note: narration (${audioDuration.toFixed(1)}s) exceeds the video (${videoDuration.toFixed(1)}s); it will fade out early.`);
  }

  const audioFilter = `[1:a]apad,atrim=0:${videoDuration.toFixed(2)},afade=t=out:st=${Math.max(0, videoDuration - 0.4).toFixed(2)}:d=0.4[a]`;

  fs.mkdirSync(EXPORT_DIR, { recursive: true });

  execFileSync('ffmpeg', [
    '-y',
    '-i', VIDEO_WEBM,
    '-i', AUDIO_MP3,
    '-filter_complex',
    audioFilter,
    '-map', '0:v',
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
    audioFilter,
    '-map', '0:v',
    '-map', '[a]',
    '-c:v', 'copy',
    '-c:a', 'libopus',
    '-b:a', '128k',
    FINAL_WEBM,
  ], { stdio: 'ignore' });

  console.log(`Narrated tour: ${FINAL_MP4} (${durationOf(FINAL_MP4).toFixed(1)}s)`);
  console.log(`Narrated WebM: ${FINAL_WEBM}`);
};

await main();
