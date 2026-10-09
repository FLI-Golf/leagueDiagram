/**
 * Adds narration to the "Fill the league" walkthrough.
 *
 * Regenerates one ElevenLabs clip per recorded segment (when
 * ELEVENLABS_API_KEY is set, via env or .env), muxes each clip with its
 * segment video (audio padded/trimmed to the segment length), and stitches the
 * narrated segments into demo/captures/fill-the-league/fill-the-league-walkthrough.mp4.
 *
 * Usage: node scripts/generate-fill-the-league-narration.js
 * Prereq: run `npx playwright test fill-the-league` first so the WebM segments exist.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const CAPTURE_DIR = path.resolve(process.cwd(), 'demo', 'captures', 'fill-the-league');
const NARRATION_DIR = path.join(CAPTURE_DIR, 'narration');
const FINAL_MP4 = path.join(CAPTURE_DIR, 'fill-the-league-walkthrough.mp4');

const VOICE_ID = process.env.DEMO_NARRATION_VOICE ?? '21m00Tcm4TlvDq8ikWAM';

// One short line per recorded segment, sized to fit each segment's duration.
const SEGMENTS = [
  { video: '01-owner-league-of-one.webm', audio: '01-owner.mp3', text: 'The league starts with just its owner — one of six.' },
  { video: '02-join-owen-bell.webm', audio: '02-owen.mp3', text: 'Owen Bell signs in and joins the league. Two of six.' },
  { video: '03-join-nina-alvarez.webm', audio: '03-nina.mp3', text: 'Nina Alvarez joins. Three of six participants.' },
  { video: '04-join-harper-quinn.webm', audio: '04-harper.mp3', text: 'Harper Quinn joins. Four of six.' },
  { video: '05-join-marcus-webb.webm', audio: '05-marcus.mp3', text: 'Marcus Webb joins. Five of six.' },
  { video: '06-join-taylor-reed.webm', audio: '06-taylor.mp3', text: 'Taylor Reed joins and fills the league. Six of six.' },
  {
    video: '07-owner-verifies-full-league.webm',
    audio: '07-verify.mp3',
    text: 'After reloading, all six memberships remain. The owner seeds the draft, and the Sunset Open draft is ready to start.',
  },
];

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

const generateNarration = async (apiKey, text, outputFile) => {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed for "${text}": ${await response.text()}`);
  }

  fs.writeFileSync(outputFile, Buffer.from(await response.arrayBuffer()));
};

const main = async () => {
  fs.mkdirSync(NARRATION_DIR, { recursive: true });

  for (const segment of SEGMENTS) {
    if (!fs.existsSync(path.join(CAPTURE_DIR, segment.video))) {
      throw new Error(`Missing segment ${segment.video}. Run \`npx playwright test fill-the-league\` first.`);
    }
  }

  const apiKey = loadApiKey();
  if (!apiKey) {
    console.log('No ELEVENLABS_API_KEY found; reusing any existing clips in', NARRATION_DIR);
  }

  for (const segment of SEGMENTS) {
    const audioFile = path.join(NARRATION_DIR, segment.audio);
    if (apiKey) {
      await generateNarration(apiKey, segment.text, audioFile);
    }
    if (!fs.existsSync(audioFile)) {
      throw new Error(`No narration clip at ${audioFile} and no API key to generate it.`);
    }
  }

  const narratedSegments = [];
  for (const segment of SEGMENTS) {
    const videoFile = path.join(CAPTURE_DIR, segment.video);
    const audioFile = path.join(NARRATION_DIR, segment.audio);
    const videoDuration = durationOf(videoFile);
    const audioDuration = durationOf(audioFile);
    if (audioDuration > videoDuration) {
      console.log(`Note: narration (${audioDuration.toFixed(1)}s) exceeds segment ${segment.video} (${videoDuration.toFixed(1)}s); it will fade out early.`);
    }

    const narratedFile = path.join(NARRATION_DIR, segment.video.replace('.webm', '.narrated.mp4'));
    execFileSync('ffmpeg', [
      '-y',
      '-i', videoFile,
      '-i', audioFile,
      '-filter_complex',
      `[1:a]apad,atrim=0:${videoDuration.toFixed(2)},afade=t=out:st=${Math.max(0, videoDuration - 0.4).toFixed(2)}:d=0.4[a]`,
      '-map', '0:v',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
      narratedFile,
    ], { stdio: 'ignore' });
    narratedSegments.push(narratedFile);
  }

  const inputs = narratedSegments.flatMap((segment) => ['-i', segment]);
  execFileSync('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex',
    `concat=n=${narratedSegments.length}:v=1:a=1[outv][outa]`,
    '-map', '[outv]',
    '-map', '[outa]',
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
