/**
 * Con Edison Tech Day - 3D Avatar Stage Engine (Candidate B: Watt)
 * Powered by Three.js & glTF 2.0
 */

// 12 Articulatory Viseme Target Groups (Apple ARKit Blendshapes)
const VISEME_MAP = {
  P_B_M: {
    jawOpen: 0.02,
    mouthClose: 0.95,
    mouthPressLeft: 0.35,
    mouthPressRight: 0.35,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.0,
    mouthStretchRight: 0.0,
    mouthSmile: 0.15
  },
  F_V: {
    jawOpen: 0.09,
    mouthClose: 0.45,
    mouthPressLeft: 0.15,
    mouthPressRight: 0.15,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.18,
    mouthStretchRight: 0.18,
    mouthSmile: 0.22
  },
  TH: {
    jawOpen: 0.14,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.22,
    mouthStretchRight: 0.22,
    mouthSmile: 0.22
  },
  T_D_S_Z: {
    jawOpen: 0.08,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.40,
    mouthStretchRight: 0.40,
    mouthSmile: 0.30
  },
  K_G: {
    jawOpen: 0.22,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.20,
    mouthStretchRight: 0.20,
    mouthSmile: 0.22
  },
  L_R: {
    jawOpen: 0.18,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.12,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.15,
    mouthStretchRight: 0.15,
    mouthSmile: 0.20
  },
  W_OO: {
    jawOpen: 0.16,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.42,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.0,
    mouthStretchRight: 0.0,
    mouthSmile: 0.06
  },
  O_OH: {
    jawOpen: 0.26,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.28,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.08,
    mouthStretchRight: 0.08,
    mouthSmile: 0.12
  },
  AA_AH: {
    jawOpen: 0.34,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.18,
    mouthStretchRight: 0.18,
    mouthSmile: 0.22
  },
  E_EH: {
    jawOpen: 0.20,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.34,
    mouthStretchRight: 0.34,
    mouthSmile: 0.30
  },
  EE_IY: {
    jawOpen: 0.12,
    mouthClose: 0.0,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.48,
    mouthStretchRight: 0.48,
    mouthSmile: 0.42
  },
  PAUSE: {
    jawOpen: 0.0,
    mouthClose: 0.05,
    mouthPressLeft: 0.0,
    mouthPressRight: 0.0,
    mouthFunnel: 0.0,
    mouthPucker: 0.0,
    mouthStretchLeft: 0.0,
    mouthStretchRight: 0.0,
    mouthSmile: 0.22
  }
};

/**
 * G2P Phonetic Parser: Maps English text into a timed sequence of visemes
 */
function parseTextToVisemeTimeline(text) {
  if (!text || typeof text !== 'string') return [];

  const numMap = { '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine' };
  let sanitized = text.replace(/\d/g, d => ' ' + (numMap[d] || d) + ' ');
  sanitized = sanitized.replace(/&/g, ' and ').replace(/@/g, ' at ').replace(/%/g, ' percent ');
  sanitized = sanitized.toLowerCase();

  const visemes = [];
  const tokens = sanitized.match(/[a-z]+|[.,!?:;]+/g) || [];

  const rules = [
    { re: /^th/, viseme: 'TH', weight: 1.0 },
    { re: /^(sh|ch|tch|jh)/, viseme: 'T_D_S_Z', weight: 1.1 },
    { re: /^ph/, viseme: 'F_V', weight: 0.9 },
    { re: /^(wh|qu)/, viseme: 'W_OO', weight: 1.1 },
    { re: /^(ee|ea|ei|ey|ie)/, viseme: 'EE_IY', weight: 1.5 },
    { re: /^(oo|ou|ue|ew|ui)/, viseme: 'W_OO', weight: 1.5 },
    { re: /^(oa|ow|aw|au|al|oi|oy)/, viseme: 'O_OH', weight: 1.5 },
    { re: /^(ai|ay)/, viseme: 'EE_IY', weight: 1.4 },
    { re: /^(ck|ng|nk)/, viseme: 'K_G', weight: 0.9 },
    // Single Consonants
    { re: /^[pbm]/, viseme: 'P_B_M', weight: 0.8 },
    { re: /^[fv]/, viseme: 'F_V', weight: 0.9 },
    { re: /^[tdszj]/, viseme: 'T_D_S_Z', weight: 0.8 },
    { re: /^c(?=[eiy])/, viseme: 'T_D_S_Z', weight: 0.8 },
    { re: /^c/, viseme: 'K_G', weight: 0.8 },
    { re: /^g(?=[eiy])/, viseme: 'T_D_S_Z', weight: 0.8 },
    { re: /^[gkqx]/, viseme: 'K_G', weight: 0.8 },
    { re: /^[lr]/, viseme: 'L_R', weight: 0.9 },
    { re: /^w/, viseme: 'W_OO', weight: 1.1 },
    { re: /^y/, viseme: 'EE_IY', weight: 1.0 },
    // Vowels
    { re: /^a/, viseme: 'AA_AH', weight: 1.4 },
    { re: /^e/, viseme: 'E_EH', weight: 1.3 },
    { re: /^i/, viseme: 'EE_IY', weight: 1.2 },
    { re: /^o/, viseme: 'O_OH', weight: 1.4 },
    { re: /^u/, viseme: 'W_OO', weight: 1.3 }
  ];

  for (const token of tokens) {
    if (/^[.,!?:;]+$/.test(token)) {
      const pauseWeight = token.includes('.') || token.includes('!') || token.includes('?') ? 2.2 : 1.2;
      visemes.push({ viseme: 'PAUSE', weight: pauseWeight, text: token });
      continue;
    }

    let rem = token;
    while (rem.length > 0) {
      let matched = false;
      for (const rule of rules) {
        const m = rem.match(rule.re);
        if (m) {
          visemes.push({ viseme: rule.viseme, weight: rule.weight, text: m[0] });
          rem = rem.slice(m[0].length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        rem = rem.slice(1);
      }
    }
    // Natural inter-word breath boundary
    visemes.push({ viseme: 'PAUSE', weight: 0.35, text: ' ' });
  }

  const totalWeight = visemes.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight <= 0) return [];

  let cur = 0;
  return visemes.map(v => {
    const start = cur / totalWeight;
    cur += v.weight;
    const end = cur / totalWeight;
    return { viseme: v.viseme, start, end, text: v.text };
  });
}

/**
 * Co-articulation Interpolation: Blends smoothly across adjacent phonemes
 */
function getInterpolatedViseme(timeline, progress, visemeMap) {
  if (!timeline || timeline.length === 0) return { viseme: 'PAUSE', target: visemeMap.PAUSE, alpha: 0 };
  
  const clampedProgress = Math.max(0, Math.min(1, progress));
  let idx = 0;
  for (let i = 0; i < timeline.length; i++) {
    if (clampedProgress >= timeline[i].start && clampedProgress <= timeline[i].end) {
      idx = i;
      break;
    }
  }
  const cur = timeline[idx];
  const curTarget = visemeMap[cur.viseme] || visemeMap.PAUSE;

  const mid = (cur.start + cur.end) / 2;
  let blendTarget = curTarget;
  let alpha = 0;
  if (clampedProgress < mid && idx > 0) {
    const prev = timeline[idx - 1];
    blendTarget = visemeMap[prev.viseme] || visemeMap.PAUSE;
    const prevMid = (prev.start + prev.end) / 2;
    alpha = (mid - clampedProgress) / (mid - prevMid);
  } else if (clampedProgress > mid && idx < timeline.length - 1) {
    const next = timeline[idx + 1];
    blendTarget = visemeMap[next.viseme] || visemeMap.PAUSE;
    const nextMid = (next.start + next.end) / 2;
    alpha = (clampedProgress - mid) / (nextMid - mid);
  }
  alpha = Math.max(0, Math.min(0.5, alpha));

  const result = {};
  for (const k of Object.keys(curTarget)) {
    result[k] = curTarget[k] * (1 - alpha) + (blendTarget[k] || 0) * alpha;
  }
  return { viseme: cur.viseme, target: result, alpha };
}

class AvatarStageEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.modelPath = '/public/assets/avatars/brunette.glb';
    
    // Morph Target references (Apple ARKit blendshape standard)
    this.morphMeshes = [];
    this.visemes = {
      jawOpen: 0,
      mouthOpen: 0,
      mouthClose: 0.05,
      mouthFunnel: 0,
      mouthPucker: 0,
      mouthStretchLeft: 0,
      mouthStretchRight: 0,
      mouthSmileLeft: 0.22,
      mouthSmileRight: 0.22,
      mouthPressLeft: 0,
      mouthPressRight: 0,
      cheekSquintLeft: 0.08,
      cheekSquintRight: 0.08,
      browInnerUp: 0,
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0,
      eyeLookInLeft: 0,
      eyeLookOutRight: 0,
      eyeLookOutLeft: 0,
      eyeLookInRight: 0
    };
    this.targetVisemes = { ...this.visemes };

    // Bones references for idle motion
    this.neckBone = null;
    this.headBone = null;
    this.spineBone = null;

    // Audio Analysis & Kinematic Smoothing
    this.audioContext = null;
    this.analyser = null;
    this.audioSource = null;
    this.dataArray = null;
    this.isSpeaking = false;
    this.smoothedVolume = 0;

    // Articulatory Phonetics & Viseme Timeline
    this.visemeTimeline = [];
    this.audioElement = null;
    this.spokenText = '';
    this.speechStartTime = 0;
    this.estimatedDuration = 1000;

    // Animation, Gaze & Blinking timing
    this.clock = new THREE.Clock();
    this.blinkTimer = 0;
    this.nextBlinkInterval = 3.5;
    this.isBlinking = false;
    this.blinkDuration = 0.16;
    this.blinkElapsed = 0;
    this.saccadeTimer = 0;
    this.nextSaccadeInterval = 2.8;

    // Mouse tracking
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    this.initScene();
    this.loadAvatar();
    this.setupEvents();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060b16);

    // Camera framed on head & upper tech wear
    this.camera = new THREE.PerspectiveCamera(
      38,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 1.55, 0.96);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Front Warm Key Light (Soft, flattering facial definition)
    this.keyLight = new THREE.DirectionalLight(0xfff6ec, 1.4);
    this.keyLight.position.set(0.5, 1.8, 1.8);
    this.scene.add(this.keyLight);

    // Cool Con Edison Fill Light (Cyber/Utility cyan)
    this.fillLight = new THREE.DirectionalLight(0x00d2ff, 1.0);
    this.fillLight.position.set(-1.6, 1.1, 1.0);
    this.scene.add(this.fillLight);

    // Stage Backlight / Rim Light (Vibrant cyan silhouette for depth separation)
    this.rimLight = new THREE.DirectionalLight(0x00e5ff, 1.8);
    this.rimLight.position.set(0, 2.2, -1.8);
    this.scene.add(this.rimLight);
  }

  loadAvatar() {
    const loader = new THREE.GLTFLoader();
    loader.load(
      this.modelPath,
      (gltf) => {
        this.avatar = gltf.scene;
        console.log('[Avatar] Candidate B loaded successfully!');

        this.avatar.traverse((node) => {
          if (node.isBone) {
            const name = node.name.toLowerCase();
            if (name.includes('neck')) this.neckBone = node;
            if (name.includes('head')) this.headBone = node;
            if (name.includes('spine')) this.spineBone = node;
          }

          if (node.isMesh && node.morphTargetDictionary && node.morphTargetInfluences) {
            this.morphMeshes.push({
              mesh: node,
              dict: node.morphTargetDictionary,
              influences: node.morphTargetInfluences
            });
          }

          if (node.isMesh && node.material) {
            node.material.depthWrite = true;
            if (node.material.map) node.material.map.encoding = THREE.sRGBEncoding;
          }
        });

        // Initialize resting face & cheerful baseline smile
        this.setVisemesToRest();
        this.updateMorphTarget('mouthSmileLeft', 0.22);
        this.updateMorphTarget('mouthSmileRight', 0.22);
        this.updateMorphTarget('mouthSmile', 0.22);
        this.updateMorphTarget('mouthClose', 0.05);
        this.scene.add(this.avatar);

        if (this.onLoaded) this.onLoaded();
      },
      (progress) => {
        // Optional loading progress
      },
      (error) => {
        console.error('[Avatar] Error loading model:', error);
      }
    );
  }

  // Connect HTML5 Audio Element to Web Audio Analyser
  connectAudio(audioElement) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.12; // Instant attack response without lag
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }

      if (!audioElement._connectedToSource) {
        this.audioSource = this.audioContext.createMediaElementSource(audioElement);
        this.audioSource.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        audioElement._connectedToSource = true;
      }
    } catch (e) {
      console.warn('[Avatar] Audio routing warning:', e);
    }
  }

  updateMorphTarget(name, value) {
    for (let i = 0; i < this.morphMeshes.length; i++) {
      const { dict, influences } = this.morphMeshes[i];
      if (dict[name] !== undefined) {
        influences[dict[name]] = value;
      }
    }
  }

  setVisemesToRest() {
    this.targetVisemes.jawOpen = 0;
    this.targetVisemes.mouthOpen = 0;
    this.targetVisemes.mouthClose = 0.05; // Gentle resting lip seal
    this.targetVisemes.mouthFunnel = 0;
    this.targetVisemes.mouthPucker = 0;
    this.targetVisemes.mouthStretchLeft = 0;
    this.targetVisemes.mouthStretchRight = 0;
    this.targetVisemes.mouthSmileLeft = 0.22;
    this.targetVisemes.mouthSmileRight = 0.22;
    this.targetVisemes.mouthSmile = 0.22;
    this.targetVisemes.mouthPressLeft = 0;
    this.targetVisemes.mouthPressRight = 0;
    this.targetVisemes.cheekSquintLeft = 0.08;
    this.targetVisemes.cheekSquintRight = 0.08;
    this.targetVisemes.browInnerUp = 0;
  }

  setSpokenText(text, audioElement = null) {
    this.spokenText = text || '';
    if (audioElement) this.audioElement = audioElement;
    this.visemeTimeline = parseTextToVisemeTimeline(this.spokenText);
    this.speechStartTime = performance.now();
    const wordCount = this.spokenText.trim().split(/\s+/).filter(Boolean).length;
    this.estimatedDuration = Math.max(1000, (wordCount / 2.5) * 1000);
  }

  clearSpokenText() {
    this.visemeTimeline = [];
    this.spokenText = '';
    this.speechStartTime = 0;
    this.setVisemesToRest();
  }

  processAudioLipSync() {
    if (!this.analyser || !this.isSpeaking) {
      this.smoothedVolume = 0;
      this.setVisemesToRest();
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // 1. RMS Perceived Audio Volume across speech frequencies (bins 1 to 48 ~ 150Hz to 8500Hz)
    let sumSquares = 0;
    for (let i = 1; i <= 48; i++) {
      const v = this.dataArray[i] / 255;
      sumSquares += v * v;
    }
    const rawVolume = Math.sqrt(sumSquares / 48);

    // 2. Asymmetric Envelope Follower: Fast attack (0.60) for instant speech attack, smooth decay (0.22)
    const attackRate = rawVolume > this.smoothedVolume ? 0.60 : 0.22;
    this.smoothedVolume += (rawVolume - this.smoothedVolume) * attackRate;

    // 3. Inter-syllable pause or silence detection: If audio drops below threshold, return to rest
    if (this.smoothedVolume < 0.038) {
      this.setVisemesToRest();
      return;
    }

    // Normalized speech acoustic intensity (0.0 to 1.0)
    const normIntensity = Math.min(1.0, (this.smoothedVolume - 0.038) / 0.35);

    // 4. ARTICULATORY PHONETICS: If spoken text timeline is present, drive exact phonemic mouth shapes
    if (this.visemeTimeline && this.visemeTimeline.length > 0) {
      let progress = 0;
      if (this.audioElement && this.audioElement.duration > 0 && !isNaN(this.audioElement.duration)) {
        progress = Math.min(1.0, Math.max(0.0, this.audioElement.currentTime / this.audioElement.duration));
      } else if (this.speechStartTime > 0) {
        progress = Math.min(1.0, Math.max(0.0, (performance.now() - this.speechStartTime) / this.estimatedDuration));
      }

      const interpolated = getInterpolatedViseme(this.visemeTimeline, progress, VISEME_MAP);
      const target = interpolated.target;

      // Modulate blendshapes by live audio RMS intensity
      this.targetVisemes.jawOpen = (target.jawOpen || 0) * normIntensity;
      this.targetVisemes.mouthClose = (target.mouthClose || 0) * normIntensity;
      this.targetVisemes.mouthFunnel = (target.mouthFunnel || 0) * normIntensity;
      this.targetVisemes.mouthPucker = 0; // Strictly 0.0 to eliminate tubular beak
      this.targetVisemes.mouthPressLeft = (target.mouthPressLeft || 0) * normIntensity;
      this.targetVisemes.mouthPressRight = (target.mouthPressRight || 0) * normIntensity;
      this.targetVisemes.mouthStretchLeft = (target.mouthStretchLeft || 0) * normIntensity;
      this.targetVisemes.mouthStretchRight = (target.mouthStretchRight || 0) * normIntensity;

      // Dynamic smiling co-articulation
      const baseSmile = 0.22;
      const phonemeSmile = target.mouthSmile !== undefined ? target.mouthSmile : 0.22;
      const smileValue = baseSmile + (phonemeSmile - baseSmile) * normIntensity;
      this.targetVisemes.mouthSmileLeft = smileValue;
      this.targetVisemes.mouthSmileRight = smileValue;
      this.targetVisemes.mouthSmile = smileValue;

      this.targetVisemes.cheekSquintLeft = 0.08 + smileValue * 0.25;
      this.targetVisemes.cheekSquintRight = 0.08 + smileValue * 0.25;

      // Subtle expressive eyebrow gesture on vocal emphasis peaks
      this.targetVisemes.browInnerUp = normIntensity > 0.60 ? Math.min(0.26, (normIntensity - 0.60) * 0.65) : 0;
      return;
    }

    // 5. FALLBACK: Frequency Formant Audio Tracker if text is not provided
    let lowEnergy = 0;
    for (let i = 1; i <= 6; i++) lowEnergy += this.dataArray[i];
    lowEnergy = (lowEnergy / 6) / 255;

    let highEnergy = 0;
    for (let i = 18; i <= 45; i++) highEnergy += this.dataArray[i];
    highEnergy = (highEnergy / 28) / 255;

    const targetJaw = Math.min(0.34, normIntensity * 0.46);
    const targetStretch = Math.min(0.26, normIntensity * 0.38);
    const targetSmile = 0.22 + Math.min(0.12, normIntensity * 0.20);

    this.targetVisemes.mouthClose = 0;
    this.targetVisemes.mouthPucker = 0;

    if (highEnergy > 0.16 && highEnergy > lowEnergy * 0.65) {
      this.targetVisemes.jawOpen = targetJaw * 0.6;
      this.targetVisemes.mouthPressLeft = Math.min(0.18, highEnergy * 0.4);
      this.targetVisemes.mouthPressRight = Math.min(0.18, highEnergy * 0.4);
      this.targetVisemes.mouthFunnel = 0;
    } else {
      this.targetVisemes.jawOpen = targetJaw;
      this.targetVisemes.mouthPressLeft = 0;
      this.targetVisemes.mouthPressRight = 0;
      this.targetVisemes.mouthFunnel = lowEnergy > 0.32 ? Math.min(0.16, (lowEnergy - 0.32) * 0.35) : 0;
    }

    this.targetVisemes.mouthStretchLeft = targetStretch;
    this.targetVisemes.mouthStretchRight = targetStretch;
    this.targetVisemes.mouthSmileLeft = targetSmile;
    this.targetVisemes.mouthSmileRight = targetSmile;
    this.targetVisemes.mouthSmile = targetSmile;
    this.targetVisemes.cheekSquintLeft = 0.08 + targetSmile * 0.25;
    this.targetVisemes.cheekSquintRight = 0.08 + targetSmile * 0.25;
    this.targetVisemes.browInnerUp = normIntensity > 0.55 ? Math.min(0.26, (normIntensity - 0.55) * 0.6) : 0;
  }

  updateBlinking(delta) {
    this.blinkTimer += delta;

    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkElapsed = 0;
      this.nextBlinkInterval = 2.5 + Math.random() * 2.5; // Natural 2.5 to 5.0 second interval
    }

    if (this.isBlinking) {
      this.blinkElapsed += delta;
      const halfDuration = this.blinkDuration / 2;
      let blinkVal = 0;

      if (this.blinkElapsed < halfDuration) {
        blinkVal = this.blinkElapsed / halfDuration; // Closing eye
      } else if (this.blinkElapsed < this.blinkDuration) {
        blinkVal = 1.0 - (this.blinkElapsed - halfDuration) / halfDuration; // Opening eye
      } else {
        blinkVal = 0;
        this.isBlinking = false;
        this.blinkTimer = 0;
      }

      this.updateMorphTarget('eyeBlinkLeft', blinkVal);
      this.updateMorphTarget('eyeBlinkRight', blinkVal);
    }
  }

  updateIdleMotion(time, delta) {
    // 1. Natural breathing rhythm on spine & neck
    const breath = Math.sin(time * 1.6) * 0.012;
    if (this.spineBone) {
      this.spineBone.rotation.x = breath;
    }

    // 2. Mouse tracking with damping
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    const microTilt = Math.sin(time * 0.7) * 0.016;
    const microYaw = Math.cos(time * 0.5) * 0.016;
    // Rhythmic speaking nod (conversational cadence)
    const speechNod = this.isSpeaking ? Math.sin(time * 3.4) * 0.012 : 0;

    if (this.headBone) {
      this.headBone.rotation.y = this.mouse.x * 0.16 + microYaw;
      this.headBone.rotation.x = -this.mouse.y * 0.10 + breath * 0.5 + speechNod;
      this.headBone.rotation.z = -this.mouse.x * 0.05 + microTilt;
    }

    // 3. Micro-gaze saccades (prevents dead-eyed stare)
    this.saccadeTimer += delta;
    if (this.saccadeTimer >= this.nextSaccadeInterval) {
      this.saccadeTimer = 0;
      this.nextSaccadeInterval = 2.5 + Math.random() * 2.5;
      const saccadeMag = (Math.random() - 0.5) * 0.07;
      if (saccadeMag > 0) {
        this.targetVisemes.eyeLookOutRight = saccadeMag;
        this.targetVisemes.eyeLookInLeft = saccadeMag;
        this.targetVisemes.eyeLookOutLeft = 0;
        this.targetVisemes.eyeLookInRight = 0;
      } else {
        this.targetVisemes.eyeLookOutLeft = -saccadeMag;
        this.targetVisemes.eyeLookInRight = -saccadeMag;
        this.targetVisemes.eyeLookOutRight = 0;
        this.targetVisemes.eyeLookInLeft = 0;
      }
      setTimeout(() => {
        this.targetVisemes.eyeLookOutRight = 0;
        this.targetVisemes.eyeLookInLeft = 0;
        this.targetVisemes.eyeLookOutLeft = 0;
        this.targetVisemes.eyeLookInRight = 0;
      }, 400 + Math.random() * 300);
    }
  }

  setupEvents() {
    window.addEventListener('resize', () => {
      if (!this.container) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.targetY = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Process audio lip-sync with strict anatomical constraints
    this.processAudioLipSync();

    // 2. Smoothly interpolate all visemes with asymmetric attack/release
    for (const key in this.targetVisemes) {
      const target = this.targetVisemes[key];
      const current = this.visemes[key] || 0;
      // Fast attack (0.65) snaps open on speech consonants/vowels; mouthClose attack (0.75) for crisp bilabials
      const attackRate = key === 'mouthClose' ? 0.75 : 0.65;
      const lerpSpeed = target > current ? attackRate : 0.35;
      this.visemes[key] += (target - current) * lerpSpeed;
      if (key !== 'eyeBlinkLeft' && key !== 'eyeBlinkRight') {
        this.updateMorphTarget(key, this.visemes[key]);
      }
    }

    // 3. Process natural blinking
    this.updateBlinking(delta);

    // 4. Process subtle idle breathing, speaking nod, and gaze saccades
    this.updateIdleMotion(elapsedTime, delta);

    this.renderer.render(this.scene, this.camera);
  }
}

if (typeof window !== 'undefined') {
  window.AvatarStageEngine = AvatarStageEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AvatarStageEngine, VISEME_MAP, parseTextToVisemeTimeline, getInterpolatedViseme };
}
