import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const current = process.argv[index];
  const next = process.argv[index + 1];

  if (current.startsWith('--')) {
    if (next && !next.startsWith('--')) {
      args.set(current.slice(2), next);
      index += 1;
    } else {
      args.set(current.slice(2), 'true');
    }
  }
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const scriptText =
  args.get('text') ||
  process.env.DEMO_NARRATION_TEXT ||
  'Welcome to League Diagram. We are on the League Admin home screen. First, we switch accounts and sign in as League Admin. Then we click Switch account. After the account changes, we move to Manage league and review the Create upcoming season form. The purse is four million dollars. The title sponsor is America\'s Mobile. This is the prepopulated season setup screen before launch. The season contains six tournaments. This is the current season overview, and the tournament list is ready for the league. Tee times begin at 3:00 PM Pacific time and run every 10 minutes until the last group. Those tee times are coordinated to keep every round moving smoothly from the first start to the final groups. This overview shows how the platform keeps the league launch details, the tournament calendar, and timing information ready before the season goes live. We are ready to launch.';

const voiceId = args.get('voice') || '21m00Tcm4TlvDq8ikWAM';
const outputDir = path.resolve(args.get('output-dir') || 'demo/captures/part-1-narration');
const outputName = args.get('output') || 'elevenlabs-narration.mp3';
const outputFile = path.join(outputDir, outputName);

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'xi-api-key': apiKey,
  },
  body: JSON.stringify({
    text: scriptText,
    model_id: 'eleven_flash_v2_5',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.6,
      use_speaker_boost: true,
    },
  }),
});

if (!response.ok) {
  const text = await response.text();
  console.error('ElevenLabs request failed:', text);
  process.exit(1);
}

const arrayBuffer = await response.arrayBuffer();
fs.writeFileSync(outputFile, Buffer.from(arrayBuffer));
console.log(`Saved narrated audio to ${outputFile}`);
