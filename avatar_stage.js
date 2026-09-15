/**
 * Con Edison Tech Day - 3D Avatar Stage Engine (Candidate B: Clara)
 * Powered by Three.js & glTF 2.0
 */

class AvatarStageEngine {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.modelPath = '/public/assets/avatars/brunette.glb';
    
    // Morph Target references
    this.morphMeshes = [];
    this.visemes = {
      viseme_aa: 0,
      viseme_O: 0,
      viseme_U: 0,
      viseme_E: 0,
      viseme_I: 0,
      viseme_PP: 0,
      viseme_FF: 0,
      viseme_TH: 0,
      viseme_SS: 0,
      viseme_CH: 0,
      mouthFunnel: 0,
      mouthPucker: 0,
      mouthStretchLeft: 0,
      mouthStretchRight: 0,
      mouthSmile: 0.22, // Warm, cheerful resting smile
      browInnerUp: 0,
      eyeBlinkLeft: 0,
      eyeBlinkRight: 0
    };
    this.targetVisemes = { ...this.visemes };

    // Bones references for idle motion
    this.neckBone = null;
    this.headBone = null;
    this.spineBone = null;

    // Audio Analysis
    this.audioContext = null;
    this.analyser = null;
    this.audioSource = null;
    this.dataArray = null;
    this.isSpeaking = false;

    // Animation & timing
    this.clock = new THREE.Clock();
    this.blinkTimer = 0;
    this.nextBlinkInterval = 3.5;
    this.isBlinking = false;
    this.blinkDuration = 0.16;
    this.blinkElapsed = 0;

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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    // Front Key Light
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.keyLight.position.set(0.6, 2.0, 2.0);
    this.scene.add(this.keyLight);

    // Cool Con Edison Fill Light
    this.fillLight = new THREE.DirectionalLight(0x00d2ff, 1.1);
    this.fillLight.position.set(-1.8, 1.2, 1.0);
    this.scene.add(this.fillLight);

    // Stage Backlight / Rim Light (Cyan/Electric Blue)
    this.rimLight = new THREE.DirectionalLight(0x00ffff, 1.6);
    this.rimLight.position.set(0, 2.5, -2.0);
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

        // Apply initial pleasant smile
        this.updateMorphTarget('mouthSmile', 0.25);
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
    this.morphMeshes.forEach(({ dict, influences }) => {
      // Direct match
      if (dict[name] !== undefined) {
        influences[dict[name]] = value;
      }
      // ARKit left/right variants
      if (dict[`${name}Left`] !== undefined) {
        influences[dict[`${name}Left`]] = value;
      }
      if (dict[`${name}Right`] !== undefined) {
        influences[dict[`${name}Right`]] = value;
      }
    });
  }

  processAudioLipSync() {
    if (!this.analyser || !this.isSpeaking) {
      // Smoothly return to resting mouth shape
      for (const key in this.targetVisemes) {
        if (key === 'mouthSmile') {
          this.targetVisemes[key] = 0.22;
        } else if (key !== 'eyeBlinkLeft' && key !== 'eyeBlinkRight') {
          this.targetVisemes[key] = 0;
        }
      }
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Fine-grained acoustic frequency bands
    // 1. Low energy / F1 (jaw drop & open vowel resonance: ~150-750Hz, bins 2-7)
    let lowEnergy = 0;
    for (let i = 2; i <= 7; i++) lowEnergy += this.dataArray[i];
    lowEnergy = (lowEnergy / 6) / 255;

    // 2. Mid energy / F2 (front spread vs back rounded vowels: ~800-2400Hz, bins 8-22)
    let midEnergy = 0;
    for (let i = 8; i <= 22; i++) midEnergy += this.dataArray[i];
    midEnergy = (midEnergy / 15) / 255;

    // 3. High energy / F3 & consonants (~2500-5500Hz, bins 23-50)
    let highEnergy = 0;
    for (let i = 23; i <= 50; i++) highEnergy += this.dataArray[i];
    highEnergy = (highEnergy / 28) / 255;

    // Total perceived speech volume
    const speechVolume = lowEnergy * 0.45 + midEnergy * 0.35 + highEnergy * 0.20;

    if (speechVolume < 0.05) {
      // Inter-syllable silence or pause - relax face
      for (const key in this.targetVisemes) {
        if (key === 'mouthSmile') {
          this.targetVisemes[key] = 0.22;
        } else if (key !== 'eyeBlinkLeft' && key !== 'eyeBlinkRight') {
          this.targetVisemes[key] = 0;
        }
      }
      return;
    }

    // Determine acoustic formant ratios
    const f2Ratio = midEnergy / (lowEnergy + 0.01);
    const f3Ratio = highEnergy / (midEnergy + 0.01);

    let openJaw = 0;
    let roundMouth = 0;
    let tightRound = 0;
    let spreadMouth = 0;
    let sibilant = 0;
    let fricative = 0;

    if (f3Ratio > 1.25 && highEnergy > 0.16) {
      // High frequency consonants / sibilants ('S', 'Z', 'CH', 'T') -> teeth close, lips spread
      sibilant = Math.min(0.85, highEnergy * 1.5);
      fricative = Math.min(0.6, highEnergy * 1.2);
      openJaw = Math.min(0.18, lowEnergy * 0.4);
      spreadMouth = Math.min(0.4, highEnergy * 0.8);
    } else if (f2Ratio > 1.15) {
      // Front spread vowels ('EE', 'IH', 'EH', 'AY') -> wide horizontal lip stretch
      spreadMouth = Math.min(0.85, midEnergy * 1.6);
      openJaw = Math.min(0.4, lowEnergy * 0.7);
    } else if (f2Ratio < 0.75 && lowEnergy > 0.14) {
      // Back rounded vowels ('OH', 'OO', 'W', 'AW') -> lips funnel forward into an 'O'
      roundMouth = Math.min(0.85, lowEnergy * 1.5);
      tightRound = Math.min(0.65, lowEnergy * 1.2);
      openJaw = Math.min(0.35, lowEnergy * 0.6);
    } else {
      // Open / central vowels ('AA', 'AH', 'UH') -> vertical openness
      openJaw = Math.min(0.85, lowEnergy * 1.4);
      roundMouth = Math.min(0.3, lowEnergy * 0.5);
    }

    // Assign to morph targets
    this.targetVisemes.viseme_aa = openJaw;
    this.targetVisemes.viseme_O = roundMouth;
    this.targetVisemes.viseme_U = tightRound;
    this.targetVisemes.viseme_E = spreadMouth * 0.8;
    this.targetVisemes.viseme_I = spreadMouth;
    this.targetVisemes.viseme_SS = sibilant;
    this.targetVisemes.viseme_CH = fricative * 0.7;
    this.targetVisemes.viseme_TH = fricative * 0.4;
    this.targetVisemes.viseme_FF = fricative * 0.5;

    // Organic 3D lip shaping blendshapes
    this.targetVisemes.mouthFunnel = roundMouth * 0.75;
    this.targetVisemes.mouthPucker = tightRound * 0.65;
    this.targetVisemes.mouthStretchLeft = spreadMouth * 0.75;
    this.targetVisemes.mouthStretchRight = spreadMouth * 0.75;

    // Pleasant conversational smile dynamic
    this.targetVisemes.mouthSmile = 0.22 + spreadMouth * 0.25;

    // Expressive eyebrow gesture on vocal emphasis peaks
    this.targetVisemes.browInnerUp = speechVolume > 0.38 ? Math.min(0.4, (speechVolume - 0.38) * 1.2) : 0;
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

  updateIdleMotion(time) {
    // Breathing sway on spine & neck
    const breath = Math.sin(time * 1.8) * 0.015;
    if (this.spineBone) {
      this.spineBone.rotation.x = breath;
    }

    // Subtle natural head movement & mouse tracking
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    const microTilt = Math.sin(time * 0.8) * 0.02;
    const microYaw = Math.cos(time * 0.6) * 0.02;
    const speechNod = this.isSpeaking ? Math.sin(time * 3.2) * 0.014 : 0;

    if (this.headBone) {
      this.headBone.rotation.y = this.mouse.x * 0.18 + microYaw;
      this.headBone.rotation.x = -this.mouse.y * 0.12 + breath * 0.5 + speechNod;
      this.headBone.rotation.z = -this.mouse.x * 0.06 + microTilt;
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

    // 1. Process audio lip-sync
    this.processAudioLipSync();

    // 2. Smoothly interpolate all visemes with fast attack & natural release
    for (const key in this.targetVisemes) {
      const target = this.targetVisemes[key];
      const current = this.visemes[key] || 0;
      // Fast attack (0.65) opens mouth instantaneously with speech consonants/vowels; release (0.28) is smooth
      const lerpSpeed = target > current ? 0.65 : 0.28;
      this.visemes[key] += (target - current) * lerpSpeed;
      if (key !== 'eyeBlinkLeft' && key !== 'eyeBlinkRight') {
        this.updateMorphTarget(key, this.visemes[key]);
      }
    }

    // 3. Process natural blinking
    this.updateBlinking(delta);

    // 4. Process subtle idle breathing and head motion
    this.updateIdleMotion(elapsedTime);

    this.renderer.render(this.scene, this.camera);
  }
}

window.AvatarStageEngine = AvatarStageEngine;
