const fs = require('fs');
const path = require('path');
const textToSpeech = require('@google-cloud/text-to-speech');

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'pradeep-demo-1';
const client = new textToSpeech.TextToSpeechClient({ projectId: GCP_PROJECT_ID });

const agendaPath = path.join(__dirname, '..', 'public', 'agenda.json');
const agenda = JSON.parse(fs.readFileSync(agendaPath, 'utf8'));

const outputDir = path.join(__dirname, '..', 'public', 'assets', 'audio');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateAll() {
  console.log(`Starting audio pre-generation for ${agenda.use_cases.length} topics...`);

  for (const topic of agenda.use_cases) {
    const filename = `topic_${topic.number}.mp3`;
    const outputPath = path.join(outputDir, filename);

    console.log(`Synthesizing [${topic.number}] ${topic.title}...`);
    const cleanText = topic.script.replace(/[\*\_`#]/g, '').trim();

    const request = {
      input: { text: cleanText },
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Journey-F'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.88,
        pitch: 0.0
      }
    };

    try {
      const [response] = await client.synthesizeSpeech(request);
      fs.writeFileSync(outputPath, response.audioContent, 'binary');
      console.log(`  ✓ Saved ${filename} (${(response.audioContent.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.error(`  ✗ Error synthesizing topic ${topic.number}:`, err.message);
      process.exit(1);
    }
  }

  console.log('All 7 topic audio files successfully generated!');
}

generateAll();
