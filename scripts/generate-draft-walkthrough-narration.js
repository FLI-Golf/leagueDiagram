/**
 * Adds narration to the draft walkthrough.
 *
 * Generates one ElevenLabs clip for the single-segment recording (when
 * ELEVENLABS_API_KEY is set, via env or .env), muxes it with the video
 * (audio padded/trimmed to the video length), and writes the narrated
 * draft-walkthrough.mp4 back to demo/captures/draft-walkthrough/.
 *
 * Usage: node scripts/generate-draft-walkthrough-narration.js
 * Prereq: run `npx playwright test draft-walkthrough` first so the WebM exists.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'draft-walkthrough');
const VIDEO_WEBM = path.join(CAPTURE_DIR, 'draft-walkthrough.webm');
const AUDIO_MP3 = path.join(CAPTURE_DIR, 'draft-narration.mp3');
const FINAL_MP4 = path.join(CAPTURE_DIR, 'draft-walkthrough.mp4');

const VOICE_ID = process.env.DEMO_NARRATION_VOICE ?? '21m00Tcm4TlvDq8ikWAM';

// Sized to the ~35-second single-take recording.
const NARRATION_TEXT =
  'With the league full at six of six, the owner seeds the draft. The Sunset Open draft is ready, so the owner starts the clock. ' +
  'Each pick runs seven seconds; at zero, the recommended pro is taken automatically. Then we fast-forward through the remaining picks. ' +
  'The draft completes — all six rosters are set, with the leaderboard showing projected ratings until scores are confirmed.';

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
    throw new Error(`Missing ${VIDEO_WEBM}. Run \`npx playwright test draft-walkthrough\` first.`);
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

  execFileSync('ffmpeg', [
    '-y',
    '-i', VIDEO_WEBM,
    '-i', AUDIO_MP3,
    '-filter_complex',
    `[1:a]apad,atrim=0:${videoDuration.toFixed(2)},afade=t=out:st=${Math.max(0, videoDuration - 0.4).toFixed(2)}:d=0.4[a]`,
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

  console.log(`Narrated walkthrough: ${FINAL_MP4} (${durationOf(FINAL_MP4).toFixed(1)}s)`);
};

await main();
