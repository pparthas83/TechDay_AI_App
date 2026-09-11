# How It Works: Option 2 — Native Voice-to-Voice WebSocket Gateway via Gemini Multimodal Live API

> **Executive Summary**: Option 2 transforms Watts into a true real-time, bidirectional conversational AI avatar. By bypassing traditional serialized speech-to-text (STT) and text-to-speech (TTS) pipelines, raw audio flows directly into and out of **Gemini 2.5 Flash Native Audio (`bidiGenerateContent`)** over persistent WebSockets, delivering natural human conversational cadence (**sub-400ms latency**), spontaneous stage banter, natural vocal inflections, and seamless conversational barge-in.

---

## 1. High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               STAGE CLIENT (Browser / Edge)                            │
│                                                                                        │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐  │
│  │   AudioWorklet Input  │   │     Stage Webcam      │   │   AudioWorklet Output    │  │
│  │  16kHz Linear16 PCM   │   │  1 FPS JPEG Frames    │   │  24kHz PCM Ring Buffer   │  │
│  └───────────┬───────────┘   └───────────┬───────────┘   └────────────▲─────────────┘  │
│              │                           │                            │                │
│              │                           │                            │ FFT Frequency  │
│              │                           │                            │ Analysis       │
│              ▼                           ▼                            ▼                │
│       ┌───────────────────────────────────────────────────────────────────────┐        │
│       │               Bi-Directional WebSocket Client (WSS)                   │        │
│       │      - Streams Outgoing Audio & Video Frames                          │        │
│       │      - Receives Incoming Audio Chunks & Tool Events                   │        │
│       └──────────────────────────────────┬────────────────────────────────────┘        │
│                                          │                                             │
│                                          │  Three.js 60FPS Morph Targets & Particles   │
│                                          ▼                                             │
│       ┌───────────────────────────────────────────────────────────────────────┐        │
│       │                    3D Holographic Rendering Canvas                    │        │
│       │     - Dynamic Jaw Morphing (Lip-Sync)     - 750+ Orbiting Particles   │        │
│       │     - Contextual 3D Object Spawns         - Dynamic Lighting Modes    │        │
│       └───────────────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           │ Persistent TLS WebSocket (wss://)
                                           │ ~15ms latency
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        TIER 2: REAL-TIME STREAMING GATEWAY (Cloud Run)                 │
│                                                                                        │
│  - Session Lifecycle & JWT Client Authentication                                       │
│  - WebSocket Connection Multiplexing & Heartbeat Monitor                               │
│  - Bidirectional Stream Bridge to Google Gemini Multimodal Live API                    │
│  - Stage Tool & Function Call Event Dispatcher                                         │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           │ BiDi WebSocket Stream (`bidiGenerateContent`)
                                           │ Google Cloud Backbone Network
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 TIER 3: GOOGLE CLOUD GEMINI INTELLIGENCE BACKBONE                      │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │             gemini-2.5-flash-native-audio-latest (Multimodal Live API)           │  │
│  │                                                                                  │  │
│  │   • Native Audio-in ➔ Native Audio-out (No intermediate text translation)       │  │
│  │   • Sub-250ms Audio Synthesis with Natural Inflection, Laughs & Stage Pacing     │  │
│  │   • Built-in Barge-In / Interruption Engine                                      │  │
│  │   • Multimodal Visual Reasoning over Webcam Frames                               │  │
│  │   • Structured JSON Tool Calling (3D models, stage triggers, lighting presets)   │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. End-to-End Latency Comparison: Why Option 2 is Game-Changing

### The Bottleneck of Traditional Conversational AI
In conventional architectures (including the initial prototype):
```
1. Microphone Audio ➔ 2. STT Engine ➔ 3. Text Transcript ➔ 4. LLM Generation ➔ 5. Full Text ➔ 6. TTS Engine ➔ 7. Audio File ➔ 8. Playback
Latency: 1,400ms – 2,200ms (Noticeable stage hesitation)
```

### The Option 2 Multimodal Live Pipeline
```
1. Mic Audio (PCM) ➔ 2. WebSocket ➔ 3. Gemini Native Audio Model ➔ 4. WebSocket ➔ 5. AudioWorklet Playback
Latency: 350ms – 450ms (Matches human conversational reaction time)
```

---

## 3. Core Capabilities Breakdown

### Capability 1: Native Speech-to-Speech Streaming (No STT / TTS Lag)
* **How It Works**:
  * The stage microphone audio is captured in the browser using the Web Audio API **`AudioWorkletNode`** at **16,000 Hz, 16-bit mono Linear16 PCM**.
  * Chunks of 100ms are streamed directly over the WebSocket to Cloud Run, which pipes them to Gemini's `bidiGenerateContent` endpoint.
  * Gemini processes the acoustic tokens natively—understanding pitch, tone, pace, and vocal emphasis directly without transcribing to text first.
  * Gemini streams back **24,000 Hz PCM audio chunks**. The client `AudioWorklet` queues them into a low-latency ring buffer and begins playback within **15–20ms** of the first chunk arriving.
* **Stage Value**:
  * True **conversational immediacy**.
  * Audio sounds alive: Watts can whisper, laugh at a joke, pause for comedic effect, or raise vocal energy during an exciting announcement.

---

### Capability 2: Built-in Conversational Barge-In & Interruption
* **How It Works**:
  * In a traditional system, if the AI starts speaking, it cannot be interrupted until the sound file finishes playing unless cumbersome client-side cancel buttons are pressed.
  * In Option 2, **barge-in is native to the Gemini protocol**.
  * If the human host begins speaking while Watts is talking:
    1. The microphone streams the presenter's voice into the live session.
    2. Gemini immediately detects human speech, halts its generation stream, and emits an `interrupted: true` signal.
    3. The Cloud Run gateway forwards the signal, and the client's `AudioWorklet` flushes its playback buffer instantly.
    4. Watts stops mid-syllable, closes his mouth, and listens.
* **Stage Value**:
  * Presenters can talk over or cut off Watts naturally, exactly like co-hosting with a human partner.

---

### Capability 3: Multimodal Stage Vision (Webcam Awareness)
* **How It Works**:
  * The browser captures the stage camera or webcam stream using `navigator.mediaDevices.getUserMedia()`.
  * Every 1,000ms (1 FPS), a canvas snapshot is downscaled, compressed to JPEG, and sent as a `realtimeInput` image frame over the existing WebSocket.
  * Gemini ingests these visual frames alongside the audio stream within the same context window.
* **Stage Value**:
  * Presenter: *"Watts, what do you think of this slide?"* ➔ Watts looks at the screen and comments.
  * Presenter: *"Watts, can you see how many hands are up in the room?"* ➔ Watts scans the auditorium and estimates the count.
  * Watts reacts to presenter hand gestures, stage attire, or props held up on stage.

---

### Capability 4: Real-Time Function Calling (3D Scene Manipulation)
* **How It Works**:
  * Tools are registered in the Gemini session configuration:
    ```json
    {
      "functionDeclarations": [
        {
          "name": "setStageMode",
          "description": "Changes the visual theme and particle behavior of Watts",
          "parameters": { "type": "OBJECT", "properties": { "mode": { "enum": ["normal", "overclock", "glitch", "ambient"] } } }
        },
        {
          "name": "spawn3DObject",
          "description": "Spawns an interactive rotating 3D holographic wireframe model next to Watts",
          "parameters": { "type": "OBJECT", "properties": { "model": { "enum": ["wind_turbine", "solar_cell", "ny_grid", "tpu_chip"] } } }
        }
      ]
    }
    ```
  * When Watts decides to demonstrate a concept visually, Gemini emits a `toolCall` message down the WebSocket *concurrently* with his voice response.
  * The browser intercepts the `toolCall` and commands Three.js:
    * Spawns the rotating 3D wind turbine wireframe.
    * Or shifts particle containment rings to amber "overclock" mode.
* **Stage Value**:
  * Eliminates the need for manual button clicking—the AI commands the 3D graphics engine through its own thoughts.

---

### Capability 5: High-Precision 60FPS 3D Lip-Sync & Jaw Morphing
* **How It Works**:
  * Rather than relying on simple volume thresholds, the client's `AudioWorkletProcessor` feeds the incoming 24kHz PCM stream into a real-time **`AnalyserNode` (Fast Fourier Transform - FFT)**.
  * The FFT decomposes the audio into specific acoustic frequency bins:
    * **Low Frequencies (100Hz – 400Hz)**: Drives vertical jaw opening (`morphTargetInfluences[0]`).
    * **Mid Frequencies (800Hz – 2.5kHz)**: Drives mouth widening and vowel mouth shapes (`viseme_open`).
    * **High Frequencies (3kHz – 6kHz)**: Drives particle shimmer intensity and vocal aura radiance.
* **Stage Value**:
  * Jaw and lip movements synchronize frame-by-frame with speech cadence at 60 FPS without pre-calculated phoneme files.

---

## 4. Step-by-Step Data Flow Trace

| Step | Component | Action | Time Elapsed |
| :---: | :--- | :--- | :---: |
| **1** | **Presenter Mic** | Presenter finishes asking: *"Watts, what's our energy efficiency outlook for 2030?"* | `0 ms` |
| **2** | **Browser AudioWorklet** | Captures final 16kHz PCM audio chunk; packages binary WebSocket frame. | `+10 ms` |
| **3** | **Network Uplink** | Frame arrives at Cloud Run WebSocket Gateway over persistent TLS pipe. | `+25 ms` |
| **4** | **Cloud Run Gateway** | Forwards frame over Google Backbone to `gemini-2.5-flash-native-audio-latest`. | `+35 ms` |
| **5** | **Gemini Live Engine** | Ingests audio, resolves context, and generates first 24kHz audio chunk + `toolCall` event. | `+220 ms` |
| **6** | **Network Downlink** | First audio chunk + tool call arrives at stage browser. | `+245 ms` |
| **7** | **AudioWorklet & Three.js** | Audio plays through stage speakers; jaw morphs in sync; Three.js triggers amber theme. | **~265 ms** ⚡ |

*(Sub-300ms total round-trip time enables seamless, instantaneous stage dialogue!)*

---

## 5. Fail-Safe & Stage Reliability Architecture

Keynotes cannot fail. Option 2 incorporates three defense layers:

1. **Automatic Heartbeat & Reconnection**:
   * The client and Cloud Run exchange lightweight `ping/pong` frames every 5 seconds.
   * If Wi-Fi blips, the client automatically re-establishes the WebSocket session in <200ms with preserved conversation history.
2. **Graceful Fallback to HTTP/SSE (Option 1)**:
   * If the stage network drops WebSockets (e.g., restrictive corporate firewalls blocking WebSocket handshakes), the gateway automatically downgrades to standard HTTP streaming.
3. **Local Offline Stage Brain**:
   * If external internet connectivity is severed entirely, [`moderator.js`](file:///usr/local/google/home/pradeepsarathy/AntiGravity_Projects/Project_3/coned_demo/tech_day_hologram/moderator.js) instantly engages the offline state machine with client-side Web Audio vocoder synthesis, ensuring Watts never freezes or displays an error screen on stage.

---

## 6. Summary of Architectural Advantages

| Dimension | Legacy Prototype | Option 2 (Gemini Multimodal Live) |
| :--- | :--- | :--- |
| **Conversational Latency** | 1,400ms – 2,200ms (Hesitant) | **300ms – 450ms (Instantaneous banter)** |
| **Speech Pipeline** | Serialized STT ➔ LLM ➔ TTS | **Native Audio-to-Audio stream** |
| **Interruption Handling** | None (Audio plays to completion) | **Instant Native Barge-In** |
| **Visual Awareness** | None (Blind) | **1 FPS Live Stage Camera / Webcam** |
| **Stage 3D Control** | Manual user clicks | **Autonomous Gemini Tool Calling** |
| **Voice Realism** | Flat browser robotic synthesis | **Expressive neural voice with emotion** |
