# Gemini 3.8 Live with Live Avatar — Isolated Evaluation Sandbox

This sandbox allows evaluating Google's newly announced **Gemini 3.8 Live with Live Avatar** model in complete isolation from the production Con Edison Tech Day codebase and live Cloud Run deployment.

---

## 🛡️ Production Isolation Guarantees

* **Zero Impact on Production Service**: Does not touch, modify, or redeploy the live `coned-tech-day` service.
* **Zero Impact on Production Playbook**: The active GECX Agent (`668bd4db-b76d-4f1b-be6b-8e290bb741bd`) remains untouched.
* **Isolated Port**: Runs locally on `http://localhost:8888`.
* **Isolated Git Branch**: Stored on branch `sandbox/gemini-live-avatar-eval`.

---

## 🚀 Quick Start

### 1. Run the Sandbox Locally
From within `tech_day_hologram/experiments/gemini_live_avatar/`:
```bash
node server.js
```
Or with custom port:
```bash
SANDBOX_PORT=8888 node server.js
```

### 2. Open the Interface
Open your browser to:
👉 **`http://localhost:8888`**

### 3. Key Capabilities to Evaluate
1. **Interactive Audio Streaming**: Click **"Start Live Mic Session"** to stream 16kHz PCM audio and observe latency/RTT counters.
2. **Preset Avatar Switching**: Select between `Nova`, `Orion`, and `Lyra` to inspect persona and voice configurations.
3. **Turn-taking & Interruption**: Click **"Interrupt Avatar"** while speaking to test real-time dialogue interruption handling.
4. **Asynchronous Background Tool Execution**: Click **"Trigger Async Tool"** to simulate fetching utility AMI meter data without interrupting avatar dialogue.
5. **Direct Cloud Console Studio Access**: Click **"Open Cloud Studio"** in the top navigation to test the full video generation model in the Google Cloud Console for project `pradeep-demo-1`.

---

## 🧪 Running Automated Tests
```bash
node test/test_sandbox.js
```
