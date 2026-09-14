# Con Edison Tech Day 2026: AI in Action Panel Moderator ("Clara")

An interactive, holographic 3D AI Moderator application designed for the **Con Edison Tech Day: "AI in Action at Con Edison"** keynote and panel showcase.

The AI moderator, **Clara** (Candidate B persona: smart, youthful tech lead in Con Edison tech wear with glasses), guides the audience through the partnership between Con Edison Business and Enterprise Technology Solutions (ETS) across five core AI use cases.

---

## 🌟 Live Cloud Deployment

* **Cloud Run URL**: [https://coned-tech-day-832497031659.us-central1.run.app](https://coned-tech-day-832497031659.us-central1.run.app)
* **Status**: 100% active and serving traffic in `us-central1`.

---

## 🚀 Key Features

1. **3D Photo-Realistic Avatar (Candidate B - "Clara")**:
   - WebGL 3D avatar rendered via Three.js with studio 3-point lighting and electric blue rim illumination.
   - Real-time procedural lip-sync: Web Audio API FFT frequency analysis maps speech cadence to ARKit/Oculus visemes (`viseme_aa`, `viseme_O`, `viseme_E`, `viseme_I`, `viseme_SS`).
   - Procedural life simulation: natural eye blinking cycles and sinusoidal breathing motion.

2. **Google Cloud Text-to-Speech (Journey-F Voice)**:
   - Powered by Google Cloud's `en-US-Journey-F` ultra-realistic conversational female voice model.
   - Articulate, cheerful, youthful, and strictly professional (zero slang).
   - In-memory MD5 caching on the Express backend provides instantaneous (<100ms) speech playback.

3. **Con Edison Panel Agenda & Dynamic Lower-Thirds**:
   - **`00 INTRO`**: Keynote Welcome & Opening Remarks (Clara)
   - **`01 BILLING`**: Customer Operations & Generative Billing Agent (Patrick Hooper)
   - **`02 IDLING`**: Fleet Vehicle Idling Reduction AI (Fleet Modernization Team)
   - **`03 MANHOLE`**: Subsurface Manhole Safety & Acoustic Sensing (Subsurface Engineering Team)
   - **`04 WEATHER`**: Severe Weather Modeling & Grid Resilience (Tom Langlois)
   - **`05 CLEAN HEAT`**: Customer Energy Solutions & Clean Heat AI (Clean Energy Solutions Team)
   - **`06 Q&A`**: Interactive Audience & Panel Q&A (Clara powered by Gemini 3.6 Flash)

4. **Presenter Stage HUD & Hotkeys**:
   - **`Spacebar`**: Toggle Play / Pause speech.
   - **`→` (Right Arrow)**: Advance to next topic.
   - **`←` (Left Arrow)**: Return to previous topic.
   - **`M`**: Toggle live microphone for audience voice Q&A (Web Speech API).
   - **`F` / Stage Mode**: Fullscreen clean broadcast view for stage projectors or giant LED walls.
   - **URL Direct Hash**: Jump or bookmark any use case directly (e.g., `#billing`, `#weather`, `#manhole`).

---

## 📂 Repository Structure

```
├── avatar_stage.js          # Three.js 3D avatar engine, lighting, visemes & procedural life
├── stage_controller.js      # Presentation state machine, Google Cloud TTS audio & hotkeys
├── index.html               # Main holographic stage broadcast interface
├── styles.css               # Con Edison glassmorphism HUD, lower-thirds & stage animations
├── server.js                # Express backend: /api/tts (Journey-F), /api/chat (Gemini), /api/agenda
├── package.json             # Node.js dependencies (@google-cloud/text-to-speech, express)
├── Dockerfile               # Production container definition for Cloud Run
├── public/
│   ├── agenda.json          # Master talk tracks, use case metadata, speaker bios
│   └── assets/avatars/
│       ├── brunette.glb     # Selected Candidate B avatar (4.6 MB)
│       └── avaturn.glb      # Alternate candidate avatar
└── lib/
    └── three.min.js         # Three.js core library
```

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+
- Google Cloud credentials with access to Text-to-Speech API (or Application Default Credentials)

### Setup
```bash
# Clone the repository
git clone https://github.com/pparthas83/TechDay_AI_App.git
cd TechDay_AI_App

# Install dependencies
npm install

# Start local server
npm start
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## ☁️ Cloud Run Deployment

```bash
# Deploy to Google Cloud Run
gcloud run deploy coned-tech-day \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project pradeep-demo-1 \
  --memory 1Gi \
  --cpu 1
```

---

## 📄 License
Internal Con Edison Demonstration — Enterprise AI & Technology Solutions (ETS).
