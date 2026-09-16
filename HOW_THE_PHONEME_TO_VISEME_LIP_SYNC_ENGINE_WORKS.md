# How the Phoneme-to-Viseme Lip Sync Engine Works

This document explains the architecture, phonetic modeling, mathematical interpolation, and runtime implementation of the **Articulatory Phoneme-to-Viseme Lip Sync Engine** developed for **Watt**, the 3D AI Moderator for the **Con Edison Tech Day: AI in Action** keynote stage.

---

## 1. Executive Overview & Problem Statement

### The "Acoustic Volume Only" Pitfall
In simple 3D speech animations, lip movement is driven solely by **Root-Mean-Square (RMS) audio volume** or FFT frequency bin averages. Whenever audio energy exceeds a threshold, the engine opens the jaw; when audio is silent, it closes the jaw.

This naive approach causes two major visual defects:
1. **The Acoustic Paradox**: In human speech, an **"M"** (e.g., in *"welcome"*, *"smart"*, *"modeling"*) has substantial vocal cord vibration and loud acoustic volume, yet the lips must be **firmly sealed together** (`mouthClose: 0.95`). Conversely, an open vowel like **"AH"** requires a wide open oral posture. An amplitude-only tracker cannot differentiate between these sounds, causing the avatar to flap its mouth open on closed-lip consonants.
2. **The "Static Flapping Puppet" Effect**: Without phonetic knowledge, the mouth repeats the exact same symmetrical opening and closing motion on every single syllable regardless of whether the word contains bilabials (*P, B, M*), sibilants (*S, Z*), rounded vowels (*W, OO*), or spread smiles (*EE, AY*).

### The Solution: Dual-Track Articulatory Engine
The engine unifies **phonetic speech text parsing** with **live audio envelope tracking**:
- **Track 1 (Articulatory Shape - "What")**: Spoken English text is parsed into a normalized Grapheme-to-Phoneme (G2P) timeline mapped to 12 distinct anatomical viseme groups on the avatar's Apple ARKit morph target rig.
- **Track 2 (Temporal Position - "When")**: The active playback progress of the HTML5 `<audio>` element (`currentTime / duration`) locates the precise phonetic segment in real time.
- **Track 3 (Vocal Intensity - "How Much")**: Web Audio API FFT analysis extracts perceived loudness to dynamically modulate blendshape displacement, ensuring stressed syllables articulate vigorously while unstressed syllables articulate delicately.

---

## 2. High-Level Engine Architecture

```mermaid
flowchart TD
    subgraph Input ["1. Input Ingestion"]
        Text[Spoken Text\nAgenda Script or GECX Response]
        Audio[HTML5 Audio Track\nGoogle Cloud TTS / en-US-Journey-F]
    end

    subgraph G2P ["2. Grapheme-to-Phoneme Engine"]
        Tokenizer[Token & Punctuation Parser]
        PhonemeMap[Grapheme-to-Viseme Mapper]
        Timeline[Normalized Timeline Generator\n[0.0 to 1.0]]
        Text --> Tokenizer --> PhonemeMap --> Timeline
    end

    subgraph PlaybackTracking ["3. Real-Time Tracking & Analysis"]
        Audio --> |currentTime / duration| Progress[Playback Progress alpha]
        Audio --> |Web Audio AnalyserNode| RMS[RMS Perceived Energy & Formant Filter]
    end

    subgraph Articulation ["4. Articulatory Co-Articulation"]
        Timeline --> Lookup[Phoneme Segment Lookup]
        Progress --> Lookup
        Lookup --> CoArt[Co-Articulation Linear Interpolation]
        RMS --> Modulate[Audio Intensity Scaling]
        CoArt --> Modulate
    end

    subgraph FacialRig ["5. ARKit Blendshape Application"]
        Modulate --> Constraints[Anatomical Clamps:\nmouthPucker = 0.0\njawOpen <= 0.34\nSmiling Baseline = 0.22]
        Constraints --> AsymmLerp[Asymmetric Smoothing:\nmouthClose Attack = 0.75\nGeneral Attack = 0.65\nRelease = 0.35]
        AsymmLerp --> ThreeJS[Three.js Morph Target Rig:\nWolf3D_Head & Wolf3D_Teeth]
    end
```

---

## 3. The 12 Articulatory Viseme Groups & ARKit Blendshapes

The avatar's 3D mesh (`Wolf3D_Head` and `Wolf3D_Teeth`) uses the **Apple ARKit 52-blendshape standard**. Rather than using generic Oculus visemes which lack lower teeth articulation and distort facial symmetry, the engine maps phonetics into 12 distinct anatomical target states:

| Group | Phonemes / Sounds | Anatomical Mouth Configuration | ARKit Blendshape Targets |
| :--- | :--- | :--- | :--- |
| **`P_B_M`** | P, B, M | **Bilabial Closure**: Lips press tightly together; jaw almost closed; upper and lower lips seal completely. | `mouthClose: 0.95`<br>`jawOpen: 0.02`<br>`mouthPressLeft: 0.35`<br>`mouthPressRight: 0.35` |
| **`F_V`** | F, V, PH | **Labiodental Tuck**: Lower lip pulls slightly inward and presses against upper incisors; mouth stretched slightly. | `mouthClose: 0.45`<br>`jawOpen: 0.09`<br>`mouthPressLeft: 0.15`<br>`mouthPressRight: 0.15`<br>`mouthStretchLeft: 0.18` |
| **`TH`** | TH | **Dental Fricative**: Tongue tip touches incisors; slight oral opening with moderate lateral stretch. | `jawOpen: 0.14`<br>`mouthStretchLeft: 0.22`<br>`mouthStretchRight: 0.22`<br>`mouthSmile: 0.22` |
| **`T_D_S_Z`**| T, D, S, Z, C, J, CH, SH | **Alveolar / Sibilant Bite**: Teeth meet closely; lips stretch laterally exposing teeth edges for crisp dental consonants. | `jawOpen: 0.08`<br>`mouthStretchLeft: 0.40`<br>`mouthStretchRight: 0.40`<br>`mouthSmile: 0.30` |
| **`K_G`** | K, G, NG, Q, X | **Velar Posture**: Tongue body lifts against soft palate; open oral cavity without excessive lip displacement. | `jawOpen: 0.22`<br>`mouthStretchLeft: 0.20`<br>`mouthStretchRight: 0.20`<br>`mouthSmile: 0.22` |
| **`L_R`** | L, R, Y | **Liquid Resonance**: Mild jaw drop with subtle circular rounding and lateral expansion. | `jawOpen: 0.18`<br>`mouthFunnel: 0.12`<br>`mouthStretchLeft: 0.15`<br>`mouthStretchRight: 0.15` |
| **`W_OO`** | W, OO, OU, U | **High Back Rounded Funnel**: Lips project forward into a circular aperture; zero horizontal stretch. | `jawOpen: 0.16`<br>`mouthFunnel: 0.42`<br>`mouthStretchLeft: 0.0`<br>`mouthStretchRight: 0.0` |
| **`O_OH`** | O, OH, OW, OA | **Mid Back Rounded**: Medium jaw drop with circular lip funneling. | `jawOpen: 0.26`<br>`mouthFunnel: 0.28`<br>`mouthStretchLeft: 0.08`<br>`mouthStretchRight: 0.08` |
| **`AA_AH`** | A, AH, AU, AW | **Low Open Vowel**: Deepest vertical jaw depression; relaxed lips exposing oral cavity. | `jawOpen: 0.34`<br>`mouthStretchLeft: 0.18`<br>`mouthStretchRight: 0.18`<br>`mouthSmile: 0.22` |
| **`E_EH`** | E, EH | **Mid Front Vowel**: Balanced oral opening with lateral widening. | `jawOpen: 0.20`<br>`mouthStretchLeft: 0.34`<br>`mouthStretchRight: 0.34`<br>`mouthSmile: 0.30` |
| **`EE_IY`** | EE, EA, AY, I, EYE | **High Front Spread Smile**: Wide horizontal grin retracting lip corners; upper and lower teeth exposed. | `jawOpen: 0.12`<br>`mouthStretchLeft: 0.48`<br>`mouthStretchRight: 0.48`<br>`mouthSmile: 0.42` |
| **`PAUSE`** | Punctuation, Spaces | **Conversational Resting Smile**: Relaxed lips with a warm, engaged presenter smile. | `jawOpen: 0.0`<br>`mouthClose: 0.05`<br>`mouthSmile: 0.22` |

> [!IMPORTANT]
> **Strict Zero-Pucker Mandate (`mouthPucker: 0.0`)**:
> On Ready Player Me / Wolf3D character meshes, `mouthPucker` pinches the vertices into an unnatural, cylindrical beak that detaches from the internal teeth mesh. The engine hard-clamps `mouthPucker = 0.0` across all 12 viseme groups. Circular vowel shapes (*W*, *OO*, *OH*) are articulated exclusively through `mouthFunnel`.

---

## 4. Grapheme-to-Phoneme (G2P) Timeline Generation

When spoken text is passed to `AvatarStageEngine.setSpokenText(text, audioElement)`, the engine converts prose into a normalized temporal sequence:

### 1. Multi-Character Digraph Parsing
The parser scans text using a greedy lookahead to capture multi-letter phonetic combinations before single letters:
- `"th"` $\to$ `TH`
- `"ch"`, `"sh"` $\to$ `T_D_S_Z`
- `"ph"` $\to$ `F_V`
- `"ee"`, `"ea"`, `"ay"`, `"ai"` $\to$ `EE_IY`
- `"oo"`, `"ou"` $\to$ `W_OO`
- `"ow"`, `"oa"` $\to$ `O_OH`

### 2. Weighted Syllable Durations
Different phonetic elements occupy different physiological time spans:
- **Punctuation pauses** (`,`, `;`, `.`, `!`, `?`): Assigned relative weight `3.0` to create natural inter-phrase breathing room.
- **Word boundary spaces**: Assigned relative weight `1.2`.
- **Diphthongs and elongated vowels** (*EE, OO, OH, AA*): Assigned relative weight `1.8` to reflect prolonged vocal resonance.
- **Plosive and stop consonants** (*P, T, K, B, D*): Assigned relative weight `0.9` for quick acoustic bursts.

### 3. Normalization to $[0.0, 1.0]$
The cumulative sum of weights is computed, and each segment $[i]$ is assigned a normalized start time $S_i$ and end time $E_i$:

$$S_0 = 0.0, \quad E_i = S_i + \frac{w_i}{\sum_{k=0}^{N-1} w_k}, \quad S_{i+1} = E_i$$

This ensures the phonetic timeline seamlessly scales to any audio duration without drift.

---

## 5. Real-Time Co-Articulation & Temporal Blending

Human speech is continuous; our articulators begin moving toward the next sound before the previous sound has finished (co-articulation).

### Linear Interpolation with Boundary Smoothing
At frame time $t$, given normalized progress $p = \frac{\text{currentTime}}{\text{duration}} \in [0.0, 1.0]$:
1. The engine locates the active segment $k$ where $S_k \le p < E_k$.
2. It determines whether $p$ is closer to the previous segment $k-1$ or the subsequent segment $k+1$.
3. It calculates a normalized blending factor $\alpha \in [0.0, 0.5]$:

$$\alpha = \frac{|p - \text{center}_k|}{\text{length}_k} \times 0.5$$

4. The target blendshape vector $\vec{V}$ is smoothly interpolated between the current viseme $\vec{T}_k$ and the neighbor $\vec{T}_{\text{neighbor}}$:

$$\vec{V}(p) = (1 - \alpha) \vec{T}_k + \alpha \vec{T}_{\text{neighbor}}$$

This prevents discrete jumping between phonemes and yields fluid lip motion.

---

## 6. Audio-Phonetic Synchronization & RMS Intensity Modulation

The engine combines the *articulatory shape* from the phoneme timeline with the *perceived volume* from the live audio stream:

```
Final Blendshape Target = Interpolated Viseme Target * Normalized Audio RMS Intensity
```

### RMS Vocal Energy Calculation
During `processAudioLipSync()`, Web Audio API frequency data is sampled into an RMS perceived volume scalar:

$$\text{RMS} = \sqrt{\frac{1}{M} \sum_{i=1}^{M} \left(\frac{\text{dataArray}[i]}{255}\right)^2}$$

Normalized intensity $\text{normIntensity} = \text{clamp}\left(\frac{\text{RMS} - 0.02}{0.16}, 0.0, 1.0\right)$.

- **Stressed Syllables** (e.g., loud emphasis on *"ACTION"*, *"EDISON"*): $\text{normIntensity} \approx 0.8\text{--}1.0 \implies$ full mouth displacement.
- **Unstressed Syllables** (e.g., quiet connectors like *"in"*, *"of"*): $\text{normIntensity} \approx 0.3\text{--}0.5 \implies$ delicate displacement.
- **Inter-Word Pauses**: $\text{normIntensity} \to 0.0 \implies$ blendshapes smoothly return to the warm resting smile (`mouthSmile: 0.22`, `jawOpen: 0.0`).

### Asymmetric Attack and Release Filtering
In Three.js's `animate()` render loop (60 FPS), target blendshapes are smoothed using an asymmetric filter:
- **Fast Attack Rate ($0.65\text{--}0.75$)**: When opening or closing on sharp consonants (e.g., `mouthClose` on *P, B, M*), the lerp snaps forward with an attack factor of `0.75`.
- **Gentle Release Rate ($0.35$)**: When returning to rest or transitioning between syllables, decay is dampened to eliminate jitter and flickering.

---

## 7. Secondary Expressive Gestures

To prevent an uncanny "dead-eyed" appearance while speaking, the engine layers expressive upper-face and head movements:
1. **Dynamic Smiling Speaker Baseline**: Watt maintains a baseline presenter smile (`mouthSmile: 0.22`). As vowels stretch laterally, smiling boosts dynamically to `0.42`, gently triggering cheek squinting (`cheekSquintLeft/Right`).
2. **Emphasis Eyebrow Elevation**: When normalized audio intensity exceeds `0.60` (vocal emphasis peaks), the inner eyebrows raise naturally via `browInnerUp` (up to `0.26`).
3. **Conversational Head Nods**: A subtle sinusoidal pitch oscillation ($\sin(t \times 4.2) \times 0.02$) is applied to the neck bone during speech.
4. **Natural Gaze Saccades**: Every 2.5–5.0 seconds, Watt's eyes perform micro-saccades to simulate natural audience eye contact.
5. **Periodic Blinking**: Natural periodic double-eyelid blinks occur every 3.5–6.0 seconds.

---

## 8. Verification & Automated Testing

The phoneme-viseme engine includes a dedicated automated unit test suite in [`test/test_visemes.js`](file:///usr/local/google/home/pradeepsarathy/AntiGravity_Projects/Project_3/coned_demo/tech_day_hologram/test/test_visemes.js).

### Test Coverage
- **Timeline Generation**: Verifies that sentences produce continuous normalized sequences beginning at $0.0$ and ending at $1.0$.
- **Bilabial Lip Closure**: Asserts that words containing *"m"*, *"p"*, or *"b"* (e.g., *"welcome"*, *"smart"*) activate `mouthClose: 0.95` and `jawOpen: 0.02`.
- **Circular Funneling**: Asserts that words containing *"w"* or *"oo"* (e.g., *"Watt"*, *"to"*) activate `mouthFunnel: 0.42`.
- **Lateral Smiling Spread**: Asserts that words containing *"day"*, *"AI"*, or *"energy"* activate `mouthStretchLeft: 0.48` and `mouthSmile: 0.42`.
- **Co-Articulation**: Verifies that intermediate progress points calculate continuous interpolation between adjacent phonemes.
- **Zero-Pucker Constraint**: Asserts that `mouthPucker === 0.0` across 100% of viseme configurations.

### Running the Tests
```bash
# Run both Dialogflow CX integration tests and Phoneme Viseme unit tests
npm test
```

Test output:
```
======================================================
   CON EDISON TECH DAY: GECX TEST SUITE
======================================================
  ✓ PASS: GECXService initializes with default project and location
  ✓ PASS: GECXService properly formats regional API endpoints
  ✓ PASS: formatSessionPath generates canonical CX resource string
  ✓ PASS: formatSessionPath supports environment qualification
  ✓ PASS: detectIntent rejects invalid or empty utterances
  ✓ PASS: parseResponse extracts and sanitizes spoken text messages
  ✓ PASS: parseResponse extracts custom stage actions and metadata
  ✓ PASS: Live Con Edison Moderator Agent (pradeep-demo-1 / 668bd4db-b76d-4f1b-be6b-8e290bb741bd)
  ✓ PASS: Live Panel Topic Query: Customer Operations Billing Agent

Testing Phoneme-Viseme Engine from avatar_stage.js...
  ✓ PASS: parseTextToVisemeTimeline generates complete normalized sequence
  ✓ PASS: Bilabial consonants (P, B, M) trigger anatomical lip closure
  ✓ PASS: Rounded semivowels and vowels (W, OO) trigger circular lip funnels
  ✓ PASS: Front spread vowels (EE, AY, I) trigger horizontal grin and lateral stretch
  ✓ PASS: getInterpolatedViseme provides smooth co-articulation blending
  ✓ PASS: All visemes adhere strictly to mouthPucker = 0.0

Results: 15 of 15 tests passed.
```

---

## 9. Code References

- **Core Viseme Engine & Math**: [`tech_day_hologram/avatar_stage.js`](file:///usr/local/google/home/pradeepsarathy/AntiGravity_Projects/Project_3/coned_demo/tech_day_hologram/avatar_stage.js)
  - `VISEME_MAP`: Lines 8–105
  - `parseTextToVisemeTimeline()`: Lines 107–215
  - `getInterpolatedViseme()`: Lines 217–264
  - `processAudioLipSync()`: Lines 517–570
  - `animate()`: Lines 695–723
- **Audio Routing & Speech Coordination**: [`tech_day_hologram/stage_controller.js`](file:///usr/local/google/home/pradeepsarathy/AntiGravity_Projects/Project_3/coned_demo/tech_day_hologram/stage_controller.js)
  - `initAudioRouting()`: Lines 38–65
  - `playAudioUrl()`: Lines 215–233
  - `speakText()`: Lines 235–262
  - `fallbackWebSpeech()`: Lines 264–287
- **Unit Test Suite**: [`tech_day_hologram/test/test_visemes.js`](file:///usr/local/google/home/pradeepsarathy/AntiGravity_Projects/Project_3/coned_demo/tech_day_hologram/test/test_visemes.js)
- **Live Cloud Run Deployment**: `https://coned-tech-day-832497031659.us-central1.run.app`
