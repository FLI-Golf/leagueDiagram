import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const scriptText = `Welcome to League Diagram. This fantasy owner demo shows how a user can switch accounts, open the Fantasy league, and review the draft controls. First, select the signed in as menu. Then choose Fantasy Owner. Next, click Switch account. The account is now Fantasy Owner. Finally, open the Fantasy league screen and review the draft controls.`;

const outputDir = path.resolve('demo/captures/fantasy-owner-intro-fantas-64cd2-nt-and-opens-Fantasy-league-chromium');
const outputFile = path.join(outputDir, 'elevenlabs-narration.mp3');

const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
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
