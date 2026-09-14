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
      viseme_E: 0,
      viseme_I: 0,
      viseme_PP: 0,
      viseme_SS: 0,
      viseme_TH: 0,
      mouthSmile: 0.22, // Warm, cheerful resting smile
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
        this.analyser.smoothingTimeConstant = 0.45;
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
      this.targetVisemes.viseme_aa = 0;
      this.targetVisemes.viseme_O = 0;
      this.targetVisemes.viseme_E = 0;
      this.targetVisemes.viseme_I = 0;
      this.targetVisemes.viseme_PP = 0;
      this.targetVisemes.viseme_SS = 0;
      this.targetVisemes.mouthSmile = 0.25;
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate energy across frequency bands
    // Vowels (Low-mid: 200-800Hz bins ~2 to 8)
    let lowEnergy = 0;
    for (let i = 2; i <= 8; i++) lowEnergy += this.dataArray[i];
    lowEnergy = (lowEnergy / 7) / 255;

    // Mid energy (800-2500Hz bins ~9 to 24)
    let midEnergy = 0;
    for (let i = 9; i <= 24; i++) midEnergy += this.dataArray[i];
    midEnergy = (midEnergy / 16) / 255;

    // High energy (sibilants/consonants bins ~25 to 50)
    let highEnergy = 0;
    for (let i = 25; i <= 50; i++) highEnergy += this.dataArray[i];
    highEnergy = (highEnergy / 26) / 255;

    const totalVolume = (lowEnergy * 0.5 + midEnergy * 0.35 + highEnergy * 0.15);

    if (totalVolume > 0.08) {
      // Vowel articulation
      this.targetVisemes.viseme_aa = Math.min(1.0, lowEnergy * 1.6);
      this.targetVisemes.viseme_O = Math.min(0.9, (lowEnergy * 0.7 + midEnergy * 0.3) * 1.3);
      this.targetVisemes.viseme_E = Math.min(0.8, midEnergy * 1.4);
      this.targetVisemes.viseme_I = Math.min(0.7, (midEnergy * 0.5 + highEnergy * 0.5) * 1.2);
      this.targetVisemes.viseme_SS = Math.min(0.8, highEnergy * 1.5);
      this.targetVisemes.mouthSmile = 0.25 + lowEnergy * 0.2;
    } else {
      this.targetVisemes.viseme_aa = 0;
      this.targetVisemes.viseme_O = 0;
      this.targetVisemes.viseme_E = 0;
      this.targetVisemes.viseme_I = 0;
      this.targetVisemes.viseme_SS = 0;
      this.targetVisemes.mouthSmile = 0.25;
    }
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

    if (this.headBone) {
      this.headBone.rotation.y = this.mouse.x * 0.18 + microYaw;
      this.headBone.rotation.x = -this.mouse.y * 0.12 + breath * 0.5;
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

    // 2. Smoothly interpolate all visemes
    const lerpSpeed = 0.35;
    for (const key in this.targetVisemes) {
      this.visemes[key] += (this.targetVisemes[key] - this.visemes[key]) * lerpSpeed;
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
