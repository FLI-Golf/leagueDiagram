/**
 * Adds narration to a single-take walkthrough recording.
 *
 * Generates one ElevenLabs clip (when ELEVENLABS_API_KEY is set, via env or
 * .env), freezes the last frame to fit the audio if the narration runs long,
 * and writes narrated MP4 + WebM to demo/exports/<name>/.
 *
 * Usage: node scripts/generate-walkthrough-narration.js --name=scorekeeping-pipeline
 * Prereq: run the matching `npx playwright test <name>` first so the WebM exists.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const nameArg = process.argv.find((arg) => arg.startsWith('--name='));
const NAME = nameArg ? nameArg.slice('--name='.length) : '';

const NARRATIONS = {
  'scorekeeping-pipeline':
    'Ava Park, the scorekeeper, enters hole scores for her group and submits the card hole by hole. ' +
    'Fast-forward: every group completes its card. Now the league admin reviews — approval stays blocked until every card is in. ' +
    'One click approves all scores, and the team finish order is confirmed. Official results feed the standings and the fantasy leagues.',
  'fantasy-scoring':
    'The draft is complete, and the leaderboard shows projected ratings — not official yet. ' +
    'Then the event scores are confirmed by the admin, and the same leaderboard flips from projected to real: ' +
    'every pro carries their round score onto the fantasy roster that drafted them, and the lowest four-player total wins.',
  'content-approval':
    'Simon Lizotte, a pro, writes an update and submits it for review — it stays private while pending. ' +
    'The league admin opens content review, sees the pending post, and approves it. ' +
    "The update is now published on Simon's public profile.",
};

const NARRATION_TEXT = NARRATIONS[NAME];
if (!NARRATION_TEXT) {
  throw new Error(`Unknown walkthrough "${NAME}". Known: ${Object.keys(NARRATIONS).join(', ')}`);
}

const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', NAME);
const VIDEO_WEBM = path.join(CAPTURE_DIR, `${NAME}.webm`);
const AUDIO_MP3 = path.join(CAPTURE_DIR, `${NAME}-narration.mp3`);
// Finals live outside demo/captures, which Playwright wipes on every run.
const EXPORT_DIR = path.resolve(process.cwd(), 'demo', 'exports', NAME);
const FINAL_MP4 = path.join(EXPORT_DIR, `${NAME}.mp4`);
const FINAL_WEBM = path.join(EXPORT_DIR, `${NAME}.webm`);

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
    throw new Error(`Missing ${VIDEO_WEBM}. Run \`npx playwright test ${NAME}\` first.`);
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
    '-y', '-i', VIDEO_WEBM, '-i', AUDIO_MP3,
    '-filter_complex', filterGraph,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart',
    FINAL_MP4,
  ], { stdio: 'ignore' });

  execFileSync('ffmpeg', [
    '-y', '-i', VIDEO_WEBM, '-i', AUDIO_MP3,
    '-filter_complex', filterGraph,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libvpx-vp9', '-crf', '33',
    '-c:a', 'libopus', '-b:a', '128k',
    FINAL_WEBM,
  ], { stdio: 'ignore' });

  console.log(`Narrated walkthrough: ${FINAL_MP4} (${durationOf(FINAL_MP4).toFixed(1)}s)`);
  console.log(`Narrated WebM: ${FINAL_WEBM}`);
};

await main();
