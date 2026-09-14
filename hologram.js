/**
 * Holographic Avatar 3D Engine (Three.js)
 * Creates a futuristic procedural cyber-mesh humanoid face with:
 * - Dynamic audio-reactive mouth/jaw lip-sync animation
 * - Dual spinning holographic containment rings
 * - Hologram projection base & particle dust field
 * - Mouse parallax tracking and idle breathing/glitch cycles
 */

class HologramAvatar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.themeColor = 0x00e5ff; // Con Ed Electric Blue
    this.glowColor = 0x80deea;
    
    // Animation & State
    this.mouthOpen = 0;       // 0 (closed) to 1 (wide open)
    this.targetMouthOpen = 0;
    this.speakingIntensity = 0;
    this.isListening = false;
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.clock = new THREE.Clock();
    this.glitchTimer = 0;
    
    this.initScene();
    this.createHologramElements();
    this.setupEventListeners();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050811, 0.04);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 7.5);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Lights for holographic depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    this.pointLight = new THREE.PointLight(this.themeColor, 3, 50);
    this.pointLight.position.set(0, 2, 5);
    this.scene.add(this.pointLight);
  }

  createHologramElements() {
    this.avatarGroup = new THREE.Group();
    this.scene.add(this.avatarGroup);

    // 1. Procedural Humanoid Head Geometry
    this.createProceduralHead();

    // 2. Cybernetic Glowing Eyes
    this.createEyes();

    // 3. Holographic Orbital Rings
    this.createOrbitalRings();

    // 4. Floating Hologram Dust / Cyber Sparks
    this.createParticleCloud();

    // 5. Hologram Pedestal / Base Emitter
    this.createPedestal();
  }

  createProceduralHead() {
    // Construct anatomically-morphed sphere for face & jaw
    const radius = 1.35;
    const widthSegments = 42;
    const heightSegments = 36;
    
    this.baseGeometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    this.headGeometry = this.baseGeometry.clone();
    
    const pos = this.headGeometry.attributes.position;
    this.basePositions = new Float32Array(pos.array);
    this.jawVertexIndices = []; // Vertices affected by mouth opening

    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Shape cranial dome & jaw taper
      if (y > 0.2) {
        // Forehead / cranium
        x *= 0.95;
        z *= 0.95;
      } else if (y < 0.2 && y > -0.4) {
        // Cheekbones & nose bridge
        z += Math.cos(y * 3) * 0.18;
      } else if (y <= -0.4) {
        // Jawline & chin taper
        const taper = 1.0 - Math.abs(y + 0.4) * 0.45;
        x *= taper;
        z *= 0.92;

        // Track lower jaw / mouth vertices for lip-sync morphing
        if (z > 0.15 && y < -0.3) {
          const weight = Math.min(1.0, Math.max(0.1, (y + 1.2) / -0.6));
          this.jawVertexIndices.push({ index: i, weight: weight });
        }
      }

      pos.setXYZ(i, x, y, z);
    }
    this.headGeometry.computeVertexNormals();

    // Holographic Wireframe Material
    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: this.themeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    this.headMesh = new THREE.Mesh(this.headGeometry, this.wireframeMaterial);
    this.avatarGroup.add(this.headMesh);

    // Glowing Vertex Points Layer (cybernetic digital lattice)
    this.pointsMaterial = new THREE.PointsMaterial({
      color: this.glowColor,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    this.headPoints = new THREE.Points(this.headGeometry, this.pointsMaterial);
    this.avatarGroup.add(this.headPoints);

    // Inner Glowing Core (abstract neural brain structure)
    const coreGeo = new THREE.IcosahedronGeometry(0.7, 2);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: this.themeColor,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.avatarGroup.add(this.coreMesh);
  }

  createEyes() {
    this.eyeGroup = new THREE.Group();
    const eyeGeo = new THREE.RingGeometry(0.08, 0.16, 16);
    this.eyeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    const leftEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    leftEye.position.set(-0.42, 0.15, 1.25);
    const rightEye = new THREE.Mesh(eyeGeo, this.eyeMaterial);
    rightEye.position.set(0.42, 0.15, 1.25);

    this.eyeGroup.add(leftEye);
    this.eyeGroup.add(rightEye);
    this.avatarGroup.add(this.eyeGroup);
  }

  createOrbitalRings() {
    this.ringsGroup = new THREE.Group();

    // Outer primary orbital ring
    const ringGeo1 = new THREE.TorusGeometry(2.3, 0.015, 8, 72);
    this.ringMat1 = new THREE.MeshBasicMaterial({
      color: this.themeColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    this.ring1 = new THREE.Mesh(ringGeo1, this.ringMat1);
    this.ring1.rotation.x = Math.PI / 3;
    this.ringsGroup.add(this.ring1);

    // Inner secondary orbital ring
    const ringGeo2 = new THREE.TorusGeometry(2.0, 0.012, 8, 64);
    this.ringMat2 = new THREE.MeshBasicMaterial({
      color: this.glowColor,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    this.ring2 = new THREE.Mesh(ringGeo2, this.ringMat2);
    this.ring2.rotation.y = Math.PI / 4;
    this.ringsGroup.add(this.ring2);

    this.avatarGroup.add(this.ringsGroup);
  }

  createParticleCloud() {
    const particleCount = 750;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 3.2;
      const x = Math.cos(theta) * r;
      const y = (Math.random() - 0.5) * 6;
      const z = Math.sin(theta) * r;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      velocities.push({
        vy: 0.005 + Math.random() * 0.012,
        drift: (Math.random() - 0.5) * 0.004
      });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleVelocities = velocities;

    this.particleMaterial = new THREE.PointsMaterial({
      color: this.themeColor,
      size: 0.035,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.scene.add(this.particles);
  }

  createPedestal() {
    this.pedestalGroup = new THREE.Group();
    this.pedestalGroup.position.y = -2.8;

    // Glowing emitter circles
    for (let r = 0.6; r <= 2.2; r += 0.5) {
      const circleGeo = new THREE.RingGeometry(r - 0.02, r, 48);
      const circleMat = new THREE.MeshBasicMaterial({
        color: this.themeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25 + (2.5 - r) * 0.1,
        blending: THREE.AdditiveBlending
      });
      const circle = new THREE.Mesh(circleGeo, circleMat);
      circle.rotation.x = Math.PI / 2;
      this.pedestalGroup.add(circle);
    }

    // Holographic upward cone light beam
    const coneGeo = new THREE.CylinderGeometry(1.6, 0.4, 3.2, 32, 1, true);
    this.coneMat = new THREE.MeshBasicMaterial({
      color: this.themeColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending
    });
    const cone = new THREE.Mesh(coneGeo, this.coneMat);
    cone.position.y = 1.6;
    this.pedestalGroup.add(cone);

    this.scene.add(this.pedestalGroup);
  }

  setupEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onMouseMove(e) {
    this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 0.7;
    this.mouse.targetY = -(e.clientY / window.innerHeight - 0.5) * 0.5;
  }

  // Update mouth position based on audio speech amplitude
  setMouthOpen(amount) {
    this.targetMouthOpen = Math.max(0, Math.min(1, amount));
  }

  updateLipSync() {
    // Smooth interpolation towards target mouth opening
    this.mouthOpen += (this.targetMouthOpen - this.mouthOpen) * 0.25;

    const pos = this.headGeometry.attributes.position;
    for (let item of this.jawVertexIndices) {
      const idx = item.index;
      const weight = item.weight;
      const baseY = this.basePositions[idx * 3 + 1];
      const baseZ = this.basePositions[idx * 3 + 2];

      // Displace jaw downward and forward when speaking
      const mouthDrop = this.mouthOpen * 0.22 * weight;
      pos.setY(idx, baseY - mouthDrop);
      pos.setZ(idx, baseZ + mouthDrop * 0.2);
    }
    pos.needsUpdate = true;
  }

  setTheme(hexColor, glowHex) {
    this.themeColor = hexColor;
    this.glowColor = glowHex;

    this.wireframeMaterial.color.setHex(hexColor);
    this.pointsMaterial.color.setHex(glowHex);
    this.coreMaterial.color.setHex(hexColor);
    this.ringMat1.color.setHex(hexColor);
    this.ringMat2.color.setHex(glowHex);
    this.particleMaterial.color.setHex(hexColor);
    this.coneMat.color.setHex(hexColor);
    this.pointLight.color.setHex(hexColor);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Mouse Tracking & Parallax
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;
    this.avatarGroup.rotation.y = this.mouse.x;
    this.avatarGroup.rotation.x = -this.mouse.y;

    // 2. Idle Floating / Breathing Animation
    const breathingOffset = Math.sin(time * 1.6) * 0.08;
    this.avatarGroup.position.y = breathingOffset;

    // 3. Orbital Rings Rotation
    if (this.ring1 && this.ring2) {
      this.ring1.rotation.z += 0.008;
      this.ring2.rotation.x += 0.012;
      this.ring2.rotation.y += 0.006;
    }

    // 4. Inner Core Pulse
    if (this.coreMesh) {
      this.coreMesh.rotation.y -= 0.015;
      const scale = 0.95 + Math.sin(time * 3) * 0.05 + this.mouthOpen * 0.15;
      this.coreMesh.scale.set(scale, scale, scale);
    }

    // 5. Lip-Sync Deformation
    this.updateLipSync();

    // 6. Upward Cyber Dust Particle Drift
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + this.particleVelocities[i].vy;
        let x = pos.getX(i) + this.particleVelocities[i].drift;
        if (y > 3.5) {
          y = -3.0; // Wrap around to pedestal
        }
        pos.setY(i, y);
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }

    // 7. Holographic Glitch / Micro-Flicker (occasional authentic sci-fi effect)
    this.glitchTimer += delta;
    if (this.glitchTimer > 4.5 && Math.random() < 0.04) {
      this.avatarGroup.position.x = (Math.random() - 0.5) * 0.08;
      this.wireframeMaterial.opacity = 0.9;
    } else {
      this.avatarGroup.position.x = 0;
      this.wireframeMaterial.opacity = 0.65;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
