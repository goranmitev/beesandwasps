// ============================================================
//  CONSTANTS
// ============================================================
const GRAVITY        = -5;        // units/s^2  (gentle — bee is flying)
const BOOST_IMPULSE  = 3;         // upward boost per press
const MAX_FALL_SPEED = -8;        // terminal velocity so bee floats down
const MOVE_SPEED     = 8;         // horizontal movement speed (units/s)
const GROUND_Y       = -8;        // y position of ground (death line)
const PLAYER_RADIUS  = 0.5;
const HONEY_RADIUS   = 0.35;
const WASP_HALF      = 0.45;
const BOMB_RADIUS    = 0.28;
const BOMB_FORWARD_SPEED = 11;
const BOMB_START_VERTICAL_SPEED = 0;
const BOMB_GRAVITY = -11;
const INITIAL_BOMBS  = 10;
const MAX_BOMBS      = 10;
const HONEY_ITEMS_PER_BOMB = 10;
const EXPLOSION_LIFE = 0.65;
const PLATFORM_HW    = 1.1;       // platform half-width
const PLATFORM_HH    = 0.225;     // platform half-height
const HONEY_OFFSET_Y = 0.65;      // honey floats this far above platform center

// Platform generation
const PLAT_MIN_GAP_X = 3;         // min horizontal distance between platforms
const PLAT_MAX_GAP_X = 6;         // max horizontal distance
const PLAT_MIN_H     = 2;         // min flower height above ground
const PLAT_MAX_H     = 8;         // max flower height above ground
const PLAT_MAX_DH    = 3.5;       // max height difference between consecutive flowers

// Flower color palettes: [headColor, petalColor, stemColor]
const FLOWER_PALETTES = [
  [0xe91e63, 0xff6090, 0x4caf50],  // pink
  [0xff9800, 0xffcc80, 0x388e3c],  // orange
  [0x9c27b0, 0xce93d8, 0x558b2f],  // purple
  [0xf44336, 0xff8a80, 0x33691e],  // red
  [0x2196f3, 0x90caf9, 0x2e7d32],  // blue
  [0xffeb3b, 0xfff59d, 0x43a047],  // yellow
  [0xff5722, 0xffab91, 0x4caf50],  // deep orange
  [0x00bcd4, 0x80deea, 0x388e3c],  // teal
];

// ============================================================
//  SOUND MANAGER - Web Audio API procedural sounds
// ============================================================
class SoundManager {
  constructor() {
    this.audioContext = null;
    this.masterVolume = 0.3;
    this.enabled = true;
    this.musicEnabled = true;
    this.ambientEnabled = true;

    // Background music state
    this.musicOscillators = [];
    this.musicGainNode = null;
    this.musicPlaying = false;
    this.musicRequested = false;
    this.musicLoopTimer = null;

    // Ambient sound timers
    this.lastAmbientSound = 0;
    this.ambientInterval = 3000; // 3 seconds between ambient sounds

    // Initialize audio context on first user interaction
    this._initAudio = () => {
      if (this.audioContext) return;
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      document.removeEventListener('click', this._initAudio);
      document.removeEventListener('keydown', this._initAudio);
      document.removeEventListener('touchstart', this._initAudio);
      if (this.musicRequested && this.musicEnabled) {
        this.startMusic();
      }
    };

    document.addEventListener('click', this._initAudio);
    document.addEventListener('keydown', this._initAudio);
    document.addEventListener('touchstart', this._initAudio);
  }

  /** Play a buzzing sound for boost */
  playBuzz() {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Buzzing sound: rapid frequency modulation
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.1);

    // Volume envelope
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.4, this.audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

    oscillator.type = 'sawtooth';
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.15);
  }

  /** Play a chime sound for honey pickup */
  playChime() {
    if (!this.enabled || !this.audioContext) return;

    const oscillator1 = this.audioContext.createOscillator();
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Pleasant chime: two harmonics
    oscillator1.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
    oscillator2.frequency.setValueAtTime(659.25, this.audioContext.currentTime); // E5

    // Volume envelope
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.3, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.8);

    oscillator1.type = 'sine';
    oscillator2.type = 'sine';
    oscillator1.start();
    oscillator2.start();
    oscillator1.stop(this.audioContext.currentTime + 0.8);
    oscillator2.stop(this.audioContext.currentTime + 0.8);
  }

  /** Play a sting sound for wasp hit */
  playSting() {
    if (!this.enabled || !this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Sharp sting: descending frequency with noise-like quality
    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.2);

    // Low-pass filter for sharpness
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(2000, this.audioContext.currentTime);
    filterNode.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.2);

    // Volume envelope - sharp attack
    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.6, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.3);

    oscillator.type = 'sawtooth';
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.3);
  }

  /** Play a short pop for bomb explosions. */
  playBomb() {
    if (!this.enabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;

    // Low boom with a fast pitch dive.
    const boom = this.audioContext.createOscillator();
    const boomGain = this.audioContext.createGain();
    const boomFilter = this.audioContext.createBiquadFilter();

    boom.connect(boomFilter);
    boomFilter.connect(boomGain);
    boomGain.connect(this.audioContext.destination);

    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(180, now);
    boom.frequency.exponentialRampToValueAtTime(32, now + 0.42);
    boomFilter.type = 'lowpass';
    boomFilter.frequency.setValueAtTime(900, now);
    boomFilter.frequency.exponentialRampToValueAtTime(120, now + 0.42);
    boomGain.gain.setValueAtTime(0, now);
    boomGain.gain.linearRampToValueAtTime(this.masterVolume * 0.8, now + 0.015);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    boom.start(now);
    boom.stop(now + 0.55);

    // Short filtered noise burst for the explosive crack.
    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.28, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < output.length; i++) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / output.length);
    }

    const crack = this.audioContext.createBufferSource();
    const crackGain = this.audioContext.createGain();
    const crackFilter = this.audioContext.createBiquadFilter();
    crack.buffer = noiseBuffer;
    crack.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(this.audioContext.destination);

    crackFilter.type = 'bandpass';
    crackFilter.frequency.setValueAtTime(750, now);
    crackFilter.Q.setValueAtTime(0.9, now);
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(this.masterVolume * 0.7, now + 0.005);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    crack.start(now);

    // Tiny bright ping so hits feel sharp, not muddy.
    const ping = this.audioContext.createOscillator();
    const pingGain = this.audioContext.createGain();
    ping.connect(pingGain);
    pingGain.connect(this.audioContext.destination);
    ping.type = 'square';
    ping.frequency.setValueAtTime(920, now + 0.02);
    ping.frequency.exponentialRampToValueAtTime(280, now + 0.18);
    pingGain.gain.setValueAtTime(0, now + 0.02);
    pingGain.gain.linearRampToValueAtTime(this.masterVolume * 0.18, now + 0.035);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    ping.start(now + 0.02);
    ping.stop(now + 0.2);
  }

  /** Start background music - gentle ambient melody */
  startMusic() {
    if (!this.musicEnabled) return;
    this.musicRequested = true;
    if (!this.audioContext || this.musicPlaying) return;

    this.musicGainNode = this.audioContext.createGain();
    this.musicGainNode.connect(this.audioContext.destination);
    this.musicGainNode.gain.setValueAtTime(this.masterVolume * 0.15, this.audioContext.currentTime);

    // Create a gentle 4-note melody that loops
    const melody = [
      { freq: 261.63, duration: 1.5 }, // C4
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 392.00, duration: 1.0 }, // G4
      { freq: 523.25, duration: 2.0 }, // C5
    ];

    let currentTime = this.audioContext.currentTime;
    let totalDuration = 0;

    // Calculate total duration for looping
    melody.forEach(note => totalDuration += note.duration);

    // Create oscillators for the melody
    melody.forEach((note, index) => {
      const oscillator = this.audioContext.createOscillator();
      const noteGain = this.audioContext.createGain();

      oscillator.connect(noteGain);
      noteGain.connect(this.musicGainNode);

      oscillator.frequency.setValueAtTime(note.freq, currentTime);
      oscillator.type = 'sine';

      // Gentle attack and release
      noteGain.gain.setValueAtTime(0, currentTime);
      noteGain.gain.linearRampToValueAtTime(this.masterVolume * 0.08, currentTime + 0.1);
      noteGain.gain.setValueAtTime(this.masterVolume * 0.08, currentTime + note.duration - 0.2);
      noteGain.gain.linearRampToValueAtTime(0, currentTime + note.duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);

      this.musicOscillators.push(oscillator);
      currentTime += note.duration;
    });

    this.musicPlaying = true;

    // Schedule the next loop
    this._scheduleMusicLoop(totalDuration);
  }

  /** Stop background music */
  stopMusic() {
    this.musicRequested = false;
    if (this.musicLoopTimer) {
      clearTimeout(this.musicLoopTimer);
      this.musicLoopTimer = null;
    }
    if (!this.musicPlaying) return;

    this.musicOscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    this.musicOscillators = [];
    this.musicPlaying = false;
  }

  /** Loop the background music */
  _loopMusic() {
    this.musicLoopTimer = null;
    if (!this.musicRequested || !this.musicPlaying || !this.musicEnabled || !this.audioContext) return;

    const melody = [
      { freq: 261.63, duration: 1.5 }, // C4
      { freq: 329.63, duration: 1.0 }, // E4
      { freq: 392.00, duration: 1.0 }, // G4
      { freq: 523.25, duration: 2.0 }, // C5
    ];

    let currentTime = this.audioContext.currentTime;
    let totalDuration = 0;

    melody.forEach(note => totalDuration += note.duration);

    melody.forEach((note, index) => {
      const oscillator = this.audioContext.createOscillator();
      const noteGain = this.audioContext.createGain();

      oscillator.connect(noteGain);
      noteGain.connect(this.musicGainNode);

      oscillator.frequency.setValueAtTime(note.freq, currentTime);
      oscillator.type = 'sine';

      noteGain.gain.setValueAtTime(0, currentTime);
      noteGain.gain.linearRampToValueAtTime(this.masterVolume * 0.08, currentTime + 0.1);
      noteGain.gain.setValueAtTime(this.masterVolume * 0.08, currentTime + note.duration - 0.2);
      noteGain.gain.linearRampToValueAtTime(0, currentTime + note.duration);

      oscillator.start(currentTime);
      oscillator.stop(currentTime + note.duration);

      this.musicOscillators.push(oscillator);
      currentTime += note.duration;
    });

    // Schedule next loop
    this._scheduleMusicLoop(totalDuration);
  }

  _scheduleMusicLoop(delaySeconds) {
    if (this.musicLoopTimer) clearTimeout(this.musicLoopTimer);
    this.musicLoopTimer = setTimeout(() => this._loopMusic(), delaySeconds * 1000);
  }

  /** Play ambient nature sounds */
  playAmbientSounds() {
    if (!this.enabled || !this.ambientEnabled || !this.audioContext) return;

    const now = this.audioContext.currentTime;
    if (now - this.lastAmbientSound < this.ambientInterval / 1000) return;

    this.lastAmbientSound = now;

    // Randomly choose an ambient sound
    const ambientTypes = ['wind', 'birds', 'distant_bee', 'leaves'];
    const soundType = ambientTypes[Math.floor(Math.random() * ambientTypes.length)];

    switch (soundType) {
      case 'wind':
        this._playWindSound();
        break;
      case 'birds':
        this._playBirdSound();
        break;
      case 'distant_bee':
        this._playDistantBeeSound();
        break;
      case 'leaves':
        this._playLeavesSound();
        break;
    }
  }

  /** Gentle wind sound */
  _playWindSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // Low frequency wind-like sound
    oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(120, this.audioContext.currentTime + 2);

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(200, this.audioContext.currentTime);
    filterNode.frequency.linearRampToValueAtTime(300, this.audioContext.currentTime + 2);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.05, this.audioContext.currentTime + 0.5);
    gainNode.gain.setValueAtTime(this.masterVolume * 0.05, this.audioContext.currentTime + 1.5);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 2);

    oscillator.type = 'sawtooth';
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 2);
  }

  /** Bird chirping sounds */
  _playBirdSound() {
    const chirps = Math.floor(Math.random() * 3) + 1; // 1-3 chirps

    for (let i = 0; i < chirps; i++) {
      const delay = i * 0.3 + Math.random() * 0.2;
      setTimeout(() => {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const freq = 800 + Math.random() * 400; // 800-1200 Hz
        oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(freq * 0.8, this.audioContext.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.03, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.15);

        oscillator.type = 'sine';
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + 0.15);
      }, delay * 1000);
    }
  }

  /** Distant bee buzzing */
  _playDistantBeeSound() {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    // High frequency, distant buzzing
    oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(350, this.audioContext.currentTime + 1.5);

    filterNode.type = 'highpass';
    filterNode.frequency.setValueAtTime(200, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.02, this.audioContext.currentTime + 0.2);
    gainNode.gain.setValueAtTime(this.masterVolume * 0.02, this.audioContext.currentTime + 1.3);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1.5);

    oscillator.type = 'sawtooth';
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 1.5);
  }

  /** Rustling leaves */
  _playLeavesSound() {
    const noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.8, this.audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Generate noise
    for (let i = 0; i < output.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    const filterNode = this.audioContext.createBiquadFilter();

    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    source.buffer = noiseBuffer;

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(800, this.audioContext.currentTime);
    filterNode.Q.setValueAtTime(0.5, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(this.masterVolume * 0.04, this.audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(this.masterVolume * 0.04, this.audioContext.currentTime + 0.7);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.8);

    source.start();
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  setAmbientEnabled(enabled) {
    this.ambientEnabled = enabled;
    this.setEnabled(enabled);
  }
}

// ============================================================
//  OBJECT POOL - reuse meshes instead of creating/destroying
// ============================================================
class ObjectPool {
  constructor(factory, initialSize = 10) {
    this._factory = factory;
    this._pool = [];
    for (let i = 0; i < initialSize; i++) {
      const obj = this._factory();
      obj.visible = false;
      this._pool.push(obj);
    }
  }

  acquire() {
    let obj = this._pool.find(o => !o.visible);
    if (!obj) {
      obj = this._factory();
      this._pool.push(obj);
    }
    obj.visible = true;
    return obj;
  }

  release(obj) {
    obj.visible = false;
  }

  forEachActive(fn) {
    for (const obj of this._pool) {
      if (obj.visible) fn(obj);
    }
  }

  releaseAll() {
    for (const obj of this._pool) obj.visible = false;
  }
}

// ============================================================
//  INPUT HANDLER - arrow keys (held) + space/B (one-shot)
// ============================================================
class InputHandler {
  constructor() {
    this._keys = {};          // held keys
    this._jumpPressed = false; // consumed once per press
    this._bombPressed = false;
    this._pausePressed = false;
    this._touchDir = 0;       // touch horizontal direction

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyB') {
        e.preventDefault();
      }
      this._keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'ArrowUp') this._jumpPressed = true;
      if (e.code === 'KeyB' && !e.repeat) this._bombPressed = true;
      if (e.code === 'KeyP' || e.code === 'Escape') this._pausePressed = true;
    });

    window.addEventListener('keyup', e => {
      this._keys[e.code] = false;
    });

    // Click / tap to start & jump (only non-button taps)
    window.addEventListener('mousedown', e => {
      if (!e.target.closest('#audioControls, #touchControls, #desktopBombControl, #pauseOverlay')) this._jumpPressed = true;
    });
    window.addEventListener('touchstart', e => {
      if (!e.target.closest('#audioControls, #touchControls, #desktopBombControl, #pauseOverlay')) this._jumpPressed = true;
    });

    // Mobile touch controls
    this._setupTouchControls();
  }

  _setupTouchControls() {
    const btnLeft  = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    const btnBoost = document.getElementById('btnBoost');
    const btnBombTouch = document.getElementById('btnBombTouch');
    const btnBombDesktop = document.getElementById('btnBombDesktop');
    if (!btnLeft) return;

    const hold = (btn, action, release) => {
      const start = e => { e.preventDefault(); action(); };
      const end   = e => { e.preventDefault(); release(); };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('touchcancel', end, { passive: false });
    };

    hold(btnLeft,  () => { this._touchDir = -1; }, () => { if (this._touchDir === -1) this._touchDir = 0; });
    hold(btnRight, () => { this._touchDir = 1; },  () => { if (this._touchDir === 1)  this._touchDir = 0; });

    btnBoost.addEventListener('touchstart', e => {
      e.preventDefault();
      this._jumpPressed = true;
    }, { passive: false });

    const pressBomb = e => {
      e.preventDefault();
      this._bombPressed = true;
    };
    if (btnBombTouch) {
      btnBombTouch.addEventListener('touchstart', pressBomb, { passive: false });
    }
    if (btnBombDesktop) {
      btnBombDesktop.addEventListener('click', pressBomb);
    }
  }

  /** Returns -1 (left), 0 (none), or 1 (right). */
  getHorizontal() {
    let dir = 0;
    if (this._keys['ArrowLeft'])  dir -= 1;
    if (this._keys['ArrowRight']) dir += 1;
    if (dir === 0) dir = this._touchDir;
    return dir;
  }

  /** Consume the jump flag (returns true once per press). */
  consumeJump() {
    if (this._jumpPressed) { this._jumpPressed = false; return true; }
    return false;
  }

  /** Consume the bomb flag. */
  consumeBomb() {
    if (this._bombPressed) { this._bombPressed = false; return true; }
    return false;
  }

  /** Consume the pause flag. */
  consumePause() {
    if (this._pausePressed) { this._pausePressed = false; return true; }
    return false;
  }
}

// ============================================================
//  PLAYER (the bee) - moves with arrow keys, jumps with space
// ============================================================
class Player {
  constructor(scene) {
    this.group = new THREE.Group();

    // Body (yellow circle)
    const bodyGeo = new THREE.CircleGeometry(PLAYER_RADIUS, 24);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xffc107 });
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.group.add(this.body);

    // Stripes
    for (let i = -1; i <= 1; i++) {
      const stripe = new THREE.Mesh(
        new THREE.PlaneGeometry(PLAYER_RADIUS * 1.6, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x333300 })
      );
      stripe.position.set(0, i * 0.18, 0.01);
      this.group.add(stripe);
    }

    // Legs (6 total — 3 on each side, angling outward and down)
    const legMat = new THREE.MeshBasicMaterial({ color: 0x333300 });
    const legXPositions = [-0.2, 0.0, 0.2]; // along the body
    for (const lx of legXPositions) {
      // Left leg — starts from left side of body, angles down-left
      const legL = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.28), legMat);
      legL.position.set(lx - 0.18, -PLAYER_RADIUS + 0.0, 0.005);
      legL.rotation.z = -0.6; // angles down to the left
      this.group.add(legL);
      // Right leg — starts from right side of body, angles down-right
      const legR = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.28), legMat);
      legR.position.set(lx + 0.18, -PLAYER_RADIUS + 0.0, 0.005);
      legR.rotation.z = 0.6;  // angles down to the right
      this.group.add(legR);
    }

    // Head (smaller yellow circle in front of body)
    const headGeo = new THREE.CircleGeometry(PLAYER_RADIUS * 0.55, 20);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffca28 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(PLAYER_RADIUS * 0.85, 0.05, 0.02);
    this.group.add(head);

    // Eyes (two small black dots on the head)
    const eyeGeo = new THREE.CircleGeometry(0.055, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(PLAYER_RADIUS * 1.0, 0.15, 0.03);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(PLAYER_RADIUS * 1.2, 0.15, 0.03);
    this.group.add(eyeL, eyeR);

    // Smile (arc made from small segments)
    const smileMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const smileRadius = 0.12;
    const segments = 8;
    for (let i = 0; i < segments; i++) {
      // Arc from -30deg to -150deg (bottom half = smile)
      const a1 = Math.PI * (1.15 + (i / segments) * 0.7);
      const a2 = Math.PI * (1.15 + ((i + 1) / segments) * 0.7);
      const cx = PLAYER_RADIUS * 1.1;
      const cy = 0.06;
      const x1 = cx + Math.cos(a1) * smileRadius;
      const y1 = cy + Math.sin(a1) * smileRadius;
      const x2 = cx + Math.cos(a2) * smileRadius;
      const y2 = cy + Math.sin(a2) * smileRadius;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const seg = new THREE.Mesh(
        new THREE.PlaneGeometry(len, 0.03),
        smileMat
      );
      seg.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.03);
      seg.rotation.z = Math.atan2(dy, dx);
      this.group.add(seg);
    }

    // Antennae (two thin lines extending from the top of the head)
    const antMat = new THREE.MeshBasicMaterial({ color: 0x333300 });
    // Left antenna — angled up-left
    const antL = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.35), antMat);
    antL.position.set(PLAYER_RADIUS * 0.95, 0.42, 0.02);
    antL.rotation.z = 0.5;  // tilt outward
    this.group.add(antL);
    // Right antenna — angled up-right
    const antR = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.35), antMat);
    antR.position.set(PLAYER_RADIUS * 1.15, 0.42, 0.02);
    antR.rotation.z = -0.3;
    this.group.add(antR);

    // Small dots at antenna tips
    const tipGeo = new THREE.CircleGeometry(0.04, 6);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x333300 });
    const tipL = new THREE.Mesh(tipGeo, tipMat);
    tipL.position.set(PLAYER_RADIUS * 0.72, 0.58, 0.02);
    const tipR = new THREE.Mesh(tipGeo, tipMat);
    tipR.position.set(PLAYER_RADIUS * 1.28, 0.6, 0.02);
    this.group.add(tipL, tipR);

    // Wings (larger so the flapping is visible)
    const wingGeo = new THREE.CircleGeometry(0.32, 12);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
    this.wingL = new THREE.Mesh(wingGeo, wingMat);
    this.wingL.position.set(-0.2, 0.42, 0.01);
    this.wingR = new THREE.Mesh(wingGeo, wingMat);
    this.wingR.position.set(0.2, 0.42, 0.01);
    this.group.add(this.wingL, this.wingR);

    // Wing animation state — speed ramps up on boost
    this._wingSpeed = 18;       // base flap speed (rad/s in sine)
    this._wingBoostTimer = 0;   // time remaining for fast flap after boost

    scene.add(this.group);

    // Physics state
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = PLAYER_RADIUS;
    this.onPlatform = false;
    this.facingRight = true;
  }

  /** Boost upward — can be used any time (mid-air included). */
  boost() {
    this.vy = Math.min(this.vy + BOOST_IMPULSE, BOOST_IMPULSE * 1.3);
    this.onPlatform = false;
    // Trigger fast wing flap for 0.4s after each boost
    this._wingBoostTimer = 0.4;
  }

  update(dt, hDir) {
    // Horizontal movement from arrow keys
    this.vx = hDir * MOVE_SPEED;
    this.x += this.vx * dt;

    // Flip sprite based on direction
    if (hDir > 0) this.facingRight = true;
    else if (hDir < 0) this.facingRight = false;
    this.group.scale.x = this.facingRight ? 1 : -1;

    // Gravity (gentle drift down)
    this.vy += GRAVITY * dt;
    // Terminal fall speed so bee floats rather than plummets
    if (this.vy < MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;
    this.y += this.vy * dt;

    // Tilt based on vertical velocity
    const tilt = THREE.MathUtils.clamp(this.vy * 0.04, -0.6, 0.5);
    this.group.rotation.z = this.facingRight ? tilt : -tilt;

    // -- Animated wings: sine-driven scale to simulate flapping --
    // Flap faster right after a boost, then ease back to idle speed
    this._wingBoostTimer = Math.max(0, this._wingBoostTimer - dt);
    const boosting = this._wingBoostTimer > 0;
    const flapSpeed = boosting ? 45 : (this.onPlatform ? 8 : 18);
    const t = performance.now() * 0.001 * flapSpeed;

    // scaleY oscillates 0.3..1.0 — squash simulates wings folding in
    const flapPhase = Math.sin(t);
    const scaleY = 0.65 + 0.35 * flapPhase;
    // scaleX grows slightly as wings open for a stretch effect
    const scaleX = 1.0 + 0.15 * flapPhase;

    this.wingL.scale.set(scaleX, scaleY, 1);
    this.wingR.scale.set(scaleX, scaleY, 1);

    // Offset y so wings pivot from their base (near body) not center
    const baseY = 0.42;
    const lift = flapPhase * 0.08;
    this.wingL.position.y = baseY + lift;
    this.wingR.position.y = baseY + lift;

    // Opacity pulses slightly with flap
    const opacity = 0.35 + 0.2 * (0.5 + 0.5 * flapPhase);
    this.wingL.material.opacity = opacity;
    this.wingR.material.opacity = opacity;

    // Sync mesh position
    this.group.position.set(this.x, this.y, 0);
  }

  reset(startX, startY) {
    this.x = startX;
    this.y = startY;
    this.vx = 0;
    this.vy = 0;
    this.onPlatform = false;
    this.facingRight = true;
    this.group.rotation.z = 0;
    this.group.scale.x = 1;
    this._wingBoostTimer = 0;
    this.wingL.scale.set(1, 1, 1);
    this.wingR.scale.set(1, 1, 1);
  }
}

// ============================================================
//  PLATFORM MANAGER - static flowers; bee jumps between them
//  Each platform has a honey collectible sitting on top.
// ============================================================
class PlatformManager {
  constructor(scene) {
    this.scene = scene;

    // Platform pool — each flower is built with configurable parts
    this.pool = new ObjectPool(() => {
      const g = new THREE.Group();

      // Stem (height/color set on acquire)
      const stem = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),  // geometry replaced on configure
        new THREE.MeshBasicMaterial({ color: 0x4caf50 })
      );
      g.add(stem);
      g.userData._stem = stem;

      // Flower head / landing surface
      const head = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xe91e63 })
      );
      g.add(head);
      g.userData._head = head;

      // Petals (up to 7, hide extras)
      g.userData._petals = [];
      for (let i = 0; i < 7; i++) {
        const p = new THREE.Mesh(
          new THREE.CircleGeometry(0.22, 8),
          new THREE.MeshBasicMaterial({ color: 0xff6090 })
        );
        p.visible = false;
        g.add(p);
        g.userData._petals.push(p);
      }

      // Leaves on stem (2, toggled per flower)
      g.userData._leaves = [];
      for (let side = -1; side <= 1; side += 2) {
        const leaf = new THREE.Mesh(
          new THREE.CircleGeometry(0.3, 8),
          new THREE.MeshBasicMaterial({ color: 0x4caf50 })
        );
        leaf.scale.set(1, 0.5, 1); // flatten into oval
        leaf.visible = false;
        g.add(leaf);
        g.userData._leaves.push(leaf);
      }

      g.visible = false;
      this.scene.add(g);
      return g;
    }, 16);

    // Track last spawned height for reachable gap generation
    this._lastSpawnX = 0;
    this._lastSpawnH = 4;          // height above ground of last flower head
    this._spawnedUpTo = 0;
  }

  /** Configure a flower's visual appearance based on its height. */
  _configureFlower(g, height) {
    // Pick random palette
    const pal = FLOWER_PALETTES[Math.floor(Math.random() * FLOWER_PALETTES.length)];
    const [headColor, petalColor, stemColor] = pal;

    // Random head width variation (0.85x to 1.15x)
    const widthScale = 0.85 + Math.random() * 0.3;
    const hw = PLATFORM_HW * widthScale;
    g.userData.hw = hw; // store for collision

    // Stem: stretches from ground (y=0 in group-local space) up to the head
    const stemW = 0.2 + Math.random() * 0.15;
    const stemH = height;
    const stem = g.userData._stem;
    stem.geometry.dispose();
    stem.geometry = new THREE.PlaneGeometry(stemW, stemH);
    stem.position.set(0, stemH / 2, -0.02);
    stem.material.color.setHex(stemColor);

    // Flower head at the top of the stem
    const head = g.userData._head;
    head.geometry.dispose();
    head.geometry = new THREE.PlaneGeometry(hw * 2, PLATFORM_HH * 2);
    head.position.set(0, height, 0);
    head.material.color.setHex(headColor);

    // Petal style: randomly choose circle petals or ring-of-petals
    const petalStyle = Math.floor(Math.random() * 3); // 0=ring, 1=top-row, 2=large-few
    const petals = g.userData._petals;
    petals.forEach(p => { p.visible = false; });

    if (petalStyle === 0) {
      // Ring of petals around the head center
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count && i < petals.length; i++) {
        const angle = (i / count) * Math.PI * 2;
        const pr = hw * 0.7;
        petals[i].position.set(Math.cos(angle) * pr, height + Math.sin(angle) * 0.3, -0.01);
        petals[i].material.color.setHex(petalColor);
        petals[i].geometry.dispose();
        petals[i].geometry = new THREE.CircleGeometry(0.2 + Math.random() * 0.08, 8);
        petals[i].visible = true;
      }
    } else if (petalStyle === 1) {
      // Petals along the top edge
      const count = 3 + Math.floor(Math.random() * 3);
      const spacing = (hw * 1.6) / count;
      for (let i = 0; i < count && i < petals.length; i++) {
        petals[i].position.set(-hw * 0.8 + (i + 0.5) * spacing, height + 0.2, -0.01);
        petals[i].material.color.setHex(petalColor);
        petals[i].geometry.dispose();
        petals[i].geometry = new THREE.CircleGeometry(0.18 + Math.random() * 0.1, 8);
        petals[i].visible = true;
      }
    } else {
      // Few large petals
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count && i < petals.length; i++) {
        const px = -hw * 0.5 + (i / (count - 1 || 1)) * hw;
        petals[i].position.set(px, height + 0.15, -0.01);
        petals[i].material.color.setHex(petalColor);
        petals[i].geometry.dispose();
        petals[i].geometry = new THREE.CircleGeometry(0.25 + Math.random() * 0.1, 10);
        petals[i].visible = true;
      }
    }

    // Leaves on the stem (random position along height)
    const leaves = g.userData._leaves;
    leaves.forEach((leaf, i) => {
      if (height > 3 && Math.random() > 0.3) {
        const ly = 1 + Math.random() * (height - 2);
        const side = i === 0 ? -1 : 1;
        leaf.position.set(side * (stemW / 2 + 0.2), ly, -0.01);
        leaf.rotation.z = side * -0.4;
        leaf.material.color.setHex(stemColor);
        leaf.visible = true;
      } else {
        leaf.visible = false;
      }
    });

    // Store the head Y in world-relative terms for collision
    g.userData.headLocalY = height;
  }

  /** Generate platforms ahead of the camera so there's always something to land on. */
  spawnAhead(camRight) {
    while (this._spawnedUpTo < camRight + 25) {
      const gapX = PLAT_MIN_GAP_X + Math.random() * (PLAT_MAX_GAP_X - PLAT_MIN_GAP_X);
      const newX = this._lastSpawnX + gapX;

      // Constrain height so the player can always reach the next flower
      const minH = Math.max(PLAT_MIN_H, this._lastSpawnH - PLAT_MAX_DH);
      const maxH = Math.min(PLAT_MAX_H, this._lastSpawnH + PLAT_MAX_DH);
      const newH = minH + Math.random() * (maxH - minH);

      const plat = this.pool.acquire();
      // Group positioned at ground level; flower built upward from there
      plat.position.set(newX, GROUND_Y, 0);
      plat.userData.honeyCollected = false;
      this._configureFlower(plat, newH);

      this._lastSpawnX = newX;
      this._lastSpawnH = newH;
      this._spawnedUpTo = newX;
    }
  }

  /** Recycle platforms that are far behind the camera. */
  cleanup(camLeft) {
    this.pool.forEachActive(p => {
      if (p.position.x < camLeft - 10) this.pool.release(p);
    });
  }

  /** Resolve landing collision: player circle vs flower head AABB (top only). */
  collide(player) {
    player.onPlatform = false;
    this.pool.forEachActive(p => {
      const px = p.position.x;
      const hw = p.userData.hw || PLATFORM_HW;
      // Flower head world Y = group Y (GROUND_Y) + local head height
      const headWorldY = p.position.y + p.userData.headLocalY;

      // Check if player is within horizontal range
      if (player.x + player.radius > px - hw &&
          player.x - player.radius < px + hw) {

        const platTop = headWorldY + PLATFORM_HH;
        const playerBottom = player.y - player.radius;

        // Only land if falling and feet are near the top of the platform
        if (player.vy <= 0 &&
            playerBottom < platTop &&
            playerBottom > platTop - 1.0) {
          player.y = platTop + player.radius;
          player.vy = 0;
          player.onPlatform = true;
        }
      }
    });
  }

  reset() {
    this.pool.releaseAll();
    this._lastSpawnX = 0;
    this._lastSpawnH = 4;
    this._spawnedUpTo = 0;
  }
}

// ============================================================
//  COLLECTIBLE MANAGER - honey sits ON each platform
// ============================================================
class CollectibleManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(() => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(HONEY_RADIUS, 6), // hexagonal look
        new THREE.MeshBasicMaterial({ color: 0xffd700 })
      );
      m.visible = false;
      this.scene.add(m);
      return m;
    }, 20);

    // Map platform -> honey mesh so we don't double-spawn
    this._platformHoneyMap = new Map();
  }

  /** Spawn honey on any active platform that doesn't have one yet. */
  spawnOnPlatforms(platformPool) {
    platformPool.forEachActive(p => {
      if (this._platformHoneyMap.has(p) || p.userData.honeyCollected) return;

      const h = this.pool.acquire();
      // Place honey centered above the flower head (group Y + local head height)
      const headWorldY = p.position.y + (p.userData.headLocalY || 0);
      h.position.set(p.position.x, headWorldY + HONEY_OFFSET_Y, 0.01);
      h.userData.platform = p; // link back to platform
      this._platformHoneyMap.set(p, h);
    });
  }

  /** Animate honey (gentle bob + spin) and clean up off-screen. */
  update(dt, camLeft) {
    this.pool.forEachActive(h => {
      // Bob gently
      h.position.y += Math.sin(performance.now() * 0.004 + h.position.x) * 0.003;
      h.rotation.z += dt * 1.5;

      // If linked platform was recycled, release the honey too
      const plat = h.userData.platform;
      if (plat && !plat.visible) {
        this._platformHoneyMap.delete(plat);
        this.pool.release(h);
      }
    });
  }

  /** Circle-circle collision with player. Returns number collected. */
  collect(player) {
    let count = 0;
    this.pool.forEachActive(h => {
      const dx = player.x - h.position.x;
      const dy = player.y - h.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < player.radius + HONEY_RADIUS + 0.1) {
        const plat = h.userData.platform;
        if (plat) {
          plat.userData.honeyCollected = true;
          this._platformHoneyMap.delete(plat);
        }
        this.pool.release(h);
        count++;
      }
    });
    return count;
  }

  reset() {
    this.pool.releaseAll();
    this._platformHoneyMap.clear();
  }
}

// ============================================================
//  ENEMY MANAGER - wasps patrol between platforms
// ============================================================
class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(() => {
      const g = new THREE.Group();
      const S = 1.2; // 20% bigger than the bee

      // Body (dark orange/amber)
      const body = new THREE.Mesh(
        new THREE.CircleGeometry(WASP_HALF * S, 20),
        new THREE.MeshBasicMaterial({ color: 0xcc7700 })
      );
      g.add(body);

      // Stripes (darker, more menacing)
      for (let i = -1; i <= 1; i++) {
        const s = new THREE.Mesh(
          new THREE.PlaneGeometry(WASP_HALF * S * 1.8, 0.09 * S),
          new THREE.MeshBasicMaterial({ color: 0x1a0a00 })
        );
        s.position.set(0, i * 0.2 * S, 0.01);
        g.add(s);
      }

      // Head (darker than body)
      const headR = WASP_HALF * S * 0.55;
      const head = new THREE.Mesh(
        new THREE.CircleGeometry(headR, 16),
        new THREE.MeshBasicMaterial({ color: 0xb86800 })
      );
      head.position.set(WASP_HALF * S * 0.85, 0.05 * S, 0.02);
      g.add(head);

      // Red eyes (larger, glowing)
      const eyeGeo = new THREE.CircleGeometry(0.08 * S, 10);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(WASP_HALF * S * 0.95, 0.16 * S, 0.03);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(WASP_HALF * S * 1.2, 0.16 * S, 0.03);
      g.add(eyeL, eyeR);

      // Red pupil dots
      const pupilGeo = new THREE.CircleGeometry(0.035 * S, 6);
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x440000 });
      const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
      pupilL.position.set(WASP_HALF * S * 0.97, 0.16 * S, 0.035);
      const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
      pupilR.position.set(WASP_HALF * S * 1.22, 0.16 * S, 0.035);
      g.add(pupilL, pupilR);

      // Scary mouth (wide dark opening)
      const mouth = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22 * S, 0.08 * S),
        new THREE.MeshBasicMaterial({ color: 0x220000 })
      );
      mouth.position.set(WASP_HALF * S * 1.08, -0.04 * S, 0.03);
      g.add(mouth);

      // Teeth (jagged white triangles along the mouth)
      const toothMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const teethCount = 5;
      const mouthW = 0.22 * S;
      const mouthX = WASP_HALF * S * 1.08;
      const mouthY = -0.04 * S;
      for (let t = 0; t < teethCount; t++) {
        const tx = mouthX - mouthW / 2 + (t + 0.5) * (mouthW / teethCount);
        // Top teeth (point down)
        const toothTop = new THREE.Mesh(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.018 * S, 0, 0),
            new THREE.Vector3(0.018 * S, 0, 0),
            new THREE.Vector3(0, -0.05 * S, 0),
          ]),
          toothMat
        );
        toothTop.position.set(tx, mouthY + 0.04 * S, 0.035);
        g.add(toothTop);
        // Bottom teeth (point up)
        const toothBot = new THREE.Mesh(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.018 * S, 0, 0),
            new THREE.Vector3(0.018 * S, 0, 0),
            new THREE.Vector3(0, 0.05 * S, 0),
          ]),
          toothMat
        );
        toothBot.position.set(tx, mouthY - 0.04 * S, 0.035);
        g.add(toothBot);
      }

      // Antennae (spiky, angled forward)
      const antMat = new THREE.MeshBasicMaterial({ color: 0x1a0a00 });
      const antL = new THREE.Mesh(new THREE.PlaneGeometry(0.04 * S, 0.4 * S), antMat);
      antL.position.set(WASP_HALF * S * 0.9, 0.48 * S, 0.02);
      antL.rotation.z = 0.5;
      g.add(antL);
      const antR = new THREE.Mesh(new THREE.PlaneGeometry(0.04 * S, 0.4 * S), antMat);
      antR.position.set(WASP_HALF * S * 1.15, 0.48 * S, 0.02);
      antR.rotation.z = -0.3;
      g.add(antR);

      // Antenna tips
      const tipGeo = new THREE.CircleGeometry(0.04 * S, 6);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0x1a0a00 });
      const tipL = new THREE.Mesh(tipGeo, tipMat);
      tipL.position.set(WASP_HALF * S * 0.65, 0.65 * S, 0.02);
      const tipR = new THREE.Mesh(tipGeo, tipMat);
      tipR.position.set(WASP_HALF * S * 1.3, 0.68 * S, 0.02);
      g.add(tipL, tipR);

      // Wings (larger, darker tinted)
      const wingGeo = new THREE.CircleGeometry(0.38 * S, 12);
      const wingMat = new THREE.MeshBasicMaterial({ color: 0xddddff, transparent: true, opacity: 0.35 });
      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-0.2 * S, 0.45 * S, 0.01);
      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(0.2 * S, 0.45 * S, 0.01);
      g.add(wingL, wingR);
      g.userData.wingL = wingL;
      g.userData.wingR = wingR;

      // Legs (longer than bee's — 6 total)
      const legMat = new THREE.MeshBasicMaterial({ color: 0x1a0a00 });
      const legPositions = [-0.25 * S, 0.0, 0.25 * S];
      for (const lx of legPositions) {
        const legL = new THREE.Mesh(new THREE.PlaneGeometry(0.035 * S, 0.42 * S), legMat);
        legL.position.set(lx - 0.2 * S, -WASP_HALF * S + 0.0, 0.005);
        legL.rotation.z = -0.5;
        g.add(legL);
        const legR = new THREE.Mesh(new THREE.PlaneGeometry(0.035 * S, 0.42 * S), legMat);
        legR.position.set(lx + 0.2 * S, -WASP_HALF * S + 0.0, 0.005);
        legR.rotation.z = 0.5;
        g.add(legR);
      }

      // Stinger (pointed triangle at the back)
      const stinger = new THREE.Mesh(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0.06 * S, 0),
          new THREE.Vector3(0, -0.06 * S, 0),
          new THREE.Vector3(-0.2 * S, 0, 0),
        ]),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      stinger.position.set(-WASP_HALF * S * 0.95, 0, 0.01);
      g.add(stinger);

      g.visible = false;
      this.scene.add(g);
      return g;
    }, 10);

    this._nextSpawnX = 18; // first wasp appears a bit ahead
  }

  /** Spawn wasps ahead of camera. They hover at a set position. */
  spawnAhead(camRight) {
    while (this._nextSpawnX < camRight + 25) {
      const w = this.pool.acquire();
      const baseY = GROUND_Y + PLAT_MIN_H + Math.random() * (PLAT_MAX_H - PLAT_MIN_H);
      w.position.set(this._nextSpawnX, baseY, 0);
      w.userData.phase = Math.random() * Math.PI * 2;
      w.userData.baseY = baseY;
      w.userData.baseX = this._nextSpawnX;
      // Patrol range (moves left-right)
      w.userData.patrolRadius = 1.5 + Math.random() * 2;
      this._nextSpawnX += 10 + Math.random() * 8;
    }
  }

  /** Animate wasps: patrol, bob, and flap wings. */
  update(dt, camLeft) {
    const t = performance.now() * 0.002;
    const flapT = performance.now() * 0.001 * 22; // fast aggressive flap
    this.pool.forEachActive(w => {
      // Horizontal patrol
      w.position.x = w.userData.baseX + Math.sin(t + w.userData.phase) * w.userData.patrolRadius;
      // Vertical bob
      w.position.y = w.userData.baseY + Math.cos(t * 1.3 + w.userData.phase) * 1.0;
      // Slight tilt
      w.rotation.z = Math.sin(t + w.userData.phase) * 0.2;

      // Face direction of horizontal movement (cos is derivative of sin)
      const vx = Math.cos(t + w.userData.phase);
      w.scale.x = vx >= 0 ? 1 : -1;

      // Wing flap (sine-driven scale, similar to bee but faster)
      if (w.userData.wingL && w.userData.wingR) {
        const flapPhase = Math.sin(flapT + w.userData.phase);
        const scaleY = 0.5 + 0.5 * flapPhase;
        const scaleX = 1.0 + 0.2 * flapPhase;
        w.userData.wingL.scale.set(scaleX, scaleY, 1);
        w.userData.wingR.scale.set(scaleX, scaleY, 1);
        w.userData.wingL.position.y = 0.45 * 1.2 + flapPhase * 0.1;
        w.userData.wingR.position.y = 0.45 * 1.2 + flapPhase * 0.1;
        w.userData.wingL.material.opacity = 0.25 + 0.15 * (0.5 + 0.5 * flapPhase);
        w.userData.wingR.material.opacity = 0.25 + 0.15 * (0.5 + 0.5 * flapPhase);
      }

      if (w.userData.baseX < camLeft - 12) this.pool.release(w);
    });
  }

  /** Circle-circle collision with player. */
  checkHit(player) {
    let hit = false;
    this.pool.forEachActive(w => {
      const dx = player.x - w.position.x;
      const dy = player.y - w.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < player.radius + WASP_HALF * 0.8) hit = true;
    });
    return hit;
  }

  reset() {
    this.pool.releaseAll();
    this._nextSpawnX = 18;
  }
}

// ============================================================
//  BOMB MANAGER - bee shoots bombs that destroy wasps
// ============================================================
class BombManager {
  constructor(scene) {
    this.scene = scene;
    this.pool = new ObjectPool(() => {
      const g = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.CircleGeometry(BOMB_RADIUS, 18),
        new THREE.MeshBasicMaterial({ color: 0x222222 })
      );
      g.add(body);

      const shine = new THREE.Mesh(
        new THREE.CircleGeometry(BOMB_RADIUS * 0.28, 8),
        new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.65 })
      );
      shine.position.set(-BOMB_RADIUS * 0.28, BOMB_RADIUS * 0.24, 0.02);
      g.add(shine);

      const fuse = new THREE.Mesh(
        new THREE.PlaneGeometry(0.06, 0.34),
        new THREE.MeshBasicMaterial({ color: 0x5a3515 })
      );
      fuse.position.set(0.08, BOMB_RADIUS + 0.1, 0.01);
      fuse.rotation.z = -0.45;
      g.add(fuse);

      const spark = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd54f })
      );
      spark.position.set(0.2, BOMB_RADIUS + 0.24, 0.02);
      g.add(spark);
      g.userData.spark = spark;

      g.visible = false;
      this.scene.add(g);
      return g;
    }, 6);
  }

  drop(player) {
    const bomb = this.pool.acquire();
    const forward = player.facingRight ? 1 : -1;
    bomb.position.set(player.x + forward * player.radius * 0.8, player.y - player.radius * 0.25, 0.05);
    bomb.rotation.z = 0;
    bomb.userData.vx = forward * BOMB_FORWARD_SPEED + player.vx * 0.15;
    bomb.userData.vy = BOMB_START_VERTICAL_SPEED;
  }

  update(dt, camLeft, camRight) {
    const t = performance.now() * 0.01;
    this.pool.forEachActive(bomb => {
      bomb.userData.vy += BOMB_GRAVITY * dt;
      bomb.position.x += bomb.userData.vx * dt;
      bomb.position.y += bomb.userData.vy * dt;
      bomb.rotation.z += dt * 8 * Math.sign(bomb.userData.vx || 1);

      if (bomb.userData.spark) {
        const pulse = 0.8 + Math.sin(t + bomb.position.x) * 0.25;
        bomb.userData.spark.scale.set(pulse, pulse, 1);
      }

      if (bomb.position.y < GROUND_Y - 1 ||
          bomb.position.x < camLeft - 8 ||
          bomb.position.x > camRight + 8) {
        this.pool.release(bomb);
      }
    });
  }

  destroyHitWasps(enemyManager, effectsManager) {
    let destroyed = 0;
    this.pool.forEachActive(bomb => {
      enemyManager.pool.forEachActive(wasp => {
        if (!bomb.visible || !wasp.visible) return;

        const dx = bomb.position.x - wasp.position.x;
        const dy = bomb.position.y - wasp.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < BOMB_RADIUS + WASP_HALF * 1.1) {
          effectsManager.spawnWaspExplosion(wasp);
          this.pool.release(bomb);
          enemyManager.pool.release(wasp);
          destroyed++;
        }
      });
    });
    return destroyed;
  }

  reset() {
    this.pool.releaseAll();
  }
}

// ============================================================
//  EFFECT MANAGER - explosions and wasp breakup pieces
// ============================================================
class EffectManager {
  constructor(scene) {
    this.scene = scene;
    this._effects = [];
  }

  spawnWaspExplosion(wasp) {
    const effect = new THREE.Group();
    effect.position.copy(wasp.position);
    effect.scale.copy(wasp.scale);
    effect.rotation.z = wasp.rotation.z;
    effect.userData.life = EXPLOSION_LIFE;
    effect.userData.maxLife = EXPLOSION_LIFE;
    effect.userData.parts = [];

    const flash = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff176, transparent: true, opacity: 0.85 })
    );
    flash.position.z = 0.2;
    flash.userData.effectType = 'flash';
    effect.add(flash);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.34, 28),
      new THREE.MeshBasicMaterial({ color: 0xff6d00, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
    );
    ring.position.z = 0.21;
    ring.userData.effectType = 'ring';
    effect.add(ring);

    for (const child of wasp.children) {
      if (!child.isMesh) continue;

      const part = child.clone();
      part.material = child.material.clone();
      part.material.transparent = true;
      part.material.opacity = child.material.opacity !== undefined ? child.material.opacity : 1;
      part.position.copy(child.position);
      part.rotation.copy(child.rotation);
      part.scale.copy(child.scale);

      const outward = new THREE.Vector2(part.position.x, part.position.y);
      if (outward.lengthSq() < 0.01) {
        outward.set(Math.random() - 0.5, Math.random() - 0.5);
      }
      outward.normalize();

      const speed = 2.6 + Math.random() * 3.2;
      part.userData.vx = outward.x * speed + (Math.random() - 0.5) * 2.4;
      part.userData.vy = outward.y * speed + 2.0 + Math.random() * 2.0;
      part.userData.spin = (Math.random() - 0.5) * 12;
      part.userData.startOpacity = part.material.opacity;
      part.userData.effectType = 'part';

      effect.userData.parts.push(part);
      effect.add(part);
    }

    this.scene.add(effect);
    this._effects.push(effect);
  }

  update(dt, camLeft) {
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const effect = this._effects[i];
      effect.userData.life -= dt;
      const life = Math.max(effect.userData.life, 0);
      const progress = 1 - life / effect.userData.maxLife;

      for (const child of effect.children) {
        if (child.userData.effectType === 'part') {
          child.userData.vy -= 6 * dt;
          child.position.x += child.userData.vx * dt;
          child.position.y += child.userData.vy * dt;
          child.rotation.z += child.userData.spin * dt;
          child.material.opacity = child.userData.startOpacity * life / effect.userData.maxLife;
        } else if (child.userData.effectType === 'flash') {
          const scale = 1 + progress * 1.5;
          child.scale.set(scale, scale, 1);
          child.material.opacity = 0.85 * Math.max(0, 1 - progress * 2.5);
        } else if (child.userData.effectType === 'ring') {
          const scale = 1 + progress * 4;
          child.scale.set(scale, scale, 1);
          child.material.opacity = 0.95 * life / effect.userData.maxLife;
        }
      }

      if (effect.userData.life <= 0 || effect.position.x < camLeft - 10) {
        this._disposeEffect(effect);
        this._effects.splice(i, 1);
      }
    }
  }

  reset() {
    for (const effect of this._effects) {
      this._disposeEffect(effect);
    }
    this._effects = [];
  }

  _disposeEffect(effect) {
    this.scene.remove(effect);
    for (const child of effect.children) {
      if (child.material) child.material.dispose();
      if (child.userData.effectType === 'flash' || child.userData.effectType === 'ring') {
        child.geometry.dispose();
      }
    }
  }
}

// ============================================================
//  GAME - main controller
// ============================================================
class Game {
  constructor() {
    // -- Renderer --
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x87ceeb); // sky blue
    document.body.appendChild(this.renderer.domElement);

    // -- Orthographic camera --
    this.viewH = 16;
    this._setupCamera();

    // -- Scene --
    this.scene = new THREE.Scene();
    this._createParallaxLayers();
    this._createGround();

    // -- Systems --
    this.input        = new InputHandler();
    this.player       = new Player(this.scene);
    this.platforms    = new PlatformManager(this.scene);
    this.collectibles = new CollectibleManager(this.scene);
    this.enemies      = new EnemyManager(this.scene);
    this.bombs        = new BombManager(this.scene);
    this.effects      = new EffectManager(this.scene);
    this.sound        = new SoundManager();

    // -- State --
    this.score = 0;
    this.honeyScore = 0;
    this.bombCount = INITIAL_BOMBS;
    this._honeySinceBomb = 0;
    this.health = 100;           // 0-100, each wasp hit = -10
    this._invincibleTimer = 0;   // seconds of invincibility after a hit
    this.highScore = parseInt(localStorage.getItem('bw_high') || '0', 10);
    this.running = false;
    this.paused = false;
    this._lastTime = 0;
    this._furthestX = 0;

    // -- Screen shake --
    this._shakeTimer = 0;
    this._shakeIntensity = 0;

    // -- DOM refs --
    this._scoreEl      = document.getElementById('scoreDisplay');
    this._highScoreEl  = document.getElementById('highScoreDisplay');
    this._bombEl       = document.getElementById('bombDisplay');
    this._bombButtons  = [
      document.getElementById('btnBombDesktop'),
      document.getElementById('btnBombTouch'),
    ].filter(Boolean);
    this._healthFill   = document.getElementById('healthFill');
    this._overlay      = document.getElementById('overlay');
    this._overlayTitle = document.getElementById('overlayTitle');
    this._finalScore   = document.getElementById('finalScore');
    this._overlayHint  = document.getElementById('overlayHint');
    this._pauseOverlay = document.getElementById('pauseOverlay');

    this._highScoreEl.textContent = `Best: ${this.highScore}`;

    // Load audio preferences
    this._loadAudioSettings();

    // -- Pause buttons --
    document.getElementById('resumeBtn').addEventListener('click', () => this._togglePause());
    document.getElementById('restartBtn').addEventListener('click', () => {
      this.paused = false;
      this._pauseOverlay.classList.add('hidden');
      this.start();
    });

    // -- Audio controls --
    const musicBtn = document.getElementById('musicToggle');
    const ambientBtn = document.getElementById('ambientToggle');

    if (musicBtn) {
      musicBtn.addEventListener('click', () => {
        this.sound.setMusicEnabled(!this.sound.musicEnabled);
        musicBtn.classList.toggle('disabled', !this.sound.musicEnabled);
        this._saveAudioSettings();
      });
    }

    if (ambientBtn) {
      ambientBtn.addEventListener('click', () => {
        this.sound.setAmbientEnabled(!this.sound.enabled);
        ambientBtn.classList.toggle('disabled', !this.sound.enabled);
        this._saveAudioSettings();
      });
    }

    // -- Resize --
    window.addEventListener('resize', () => this._setupCamera());

    // -- Start loop --
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _setupCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    const viewW = this.viewH * aspect;
    this.camera = new THREE.OrthographicCamera(
      -viewW / 2, viewW / 2, this.viewH / 2, -this.viewH / 2, 0.1, 100
    );
    this.camera.position.z = 10;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  _createParallaxLayers() {
    // Three layers at different z-depths, scrolling at different speeds
    // Layer 0 (far): distant hills — slowest
    // Layer 1 (mid): rolling hills — medium
    // Layer 2 (near): bushes — faster
    this._parallaxLayers = [];
    const layerDefs = [
      { color: 0x6ba3d6, y: -3, h: 6,  z: -3, speed: 0.1, segments: 12 },  // far mountains
      { color: 0x5b9b4e, y: -6, h: 5,  z: -2, speed: 0.3, segments: 16 },  // mid hills
      { color: 0x3d7a2e, y: -8, h: 3,  z: -1, speed: 0.6, segments: 20 },  // near bushes
    ];

    for (const def of layerDefs) {
      // Create a wide strip — we'll tile 3 copies and cycle them
      const group = new THREE.Group();
      const stripW = 80;
      for (let i = -1; i <= 1; i++) {
        // Wavy top edge using multiple circles for organic shape
        const base = new THREE.Mesh(
          new THREE.PlaneGeometry(stripW, def.h),
          new THREE.MeshBasicMaterial({ color: def.color })
        );
        base.position.set(i * stripW, def.y, def.z);
        group.add(base);

        // Add bumps on top for hill silhouette
        for (let j = 0; j < def.segments; j++) {
          const bx = i * stripW - stripW / 2 + (j + 0.5) * (stripW / def.segments);
          const br = 1.0 + Math.sin(j * 2.7 + def.z * 3) * 0.8;
          const bump = new THREE.Mesh(
            new THREE.CircleGeometry(br, 10),
            new THREE.MeshBasicMaterial({ color: def.color })
          );
          bump.position.set(bx, def.y + def.h / 2 - 0.3, def.z);
          group.add(bump);
        }
      }
      this.scene.add(group);
      this._parallaxLayers.push({ group, speed: def.speed, stripW });
    }
  }

  _updateParallax(camX) {
    for (const layer of this._parallaxLayers) {
      // Offset position based on camera with parallax factor
      const offsetX = camX * layer.speed;
      // Tile: keep the group centered around offsetX, wrapping every stripW
      const wrap = layer.stripW;
      layer.group.position.x = camX - (offsetX % wrap);
    }
  }

  _togglePause() {
    if (!this.running) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.sound.stopMusic(); // Pause music when game is paused
      this._pauseOverlay.classList.remove('hidden');
    } else {
      this.sound.startMusic(); // Resume music when game is unpaused
      this._pauseOverlay.classList.add('hidden');
      this._lastTime = performance.now(); // prevent dt spike
    }
  }

  _triggerShake(intensity, duration) {
    this._shakeIntensity = intensity;
    this._shakeTimer = duration;
  }

  _createGround() {
    // Wide ground strip (scrolls with camera via large size)
    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 4),
      new THREE.MeshBasicMaterial({ color: 0x4a7c2e })
    );
    this.groundMesh.position.set(0, GROUND_Y - 2, -0.1);
    this.scene.add(this.groundMesh);

    // Danger line at ground level
    this.groundLine = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff4444 })
    );
    this.groundLine.position.set(0, GROUND_Y, -0.05);
    this.scene.add(this.groundLine);
  }

  start() {
    this.score = 0;
    this.honeyScore = 0;
    this.bombCount = INITIAL_BOMBS;
    this._honeySinceBomb = 0;
    this.health = 100;
    this._invincibleTimer = 0;
    this._furthestX = 0;
    this.running = true;

    this.platforms.reset();
    this.collectibles.reset();
    this.enemies.reset();
    this.bombs.reset();
    this.effects.reset();

    // Spawn the starting platform directly under the player
    const startH = 4; // starting flower height
    const startPlat = this.platforms.pool.acquire();
    startPlat.position.set(0, GROUND_Y, 0);
    startPlat.userData.honeyCollected = true; // no honey on start platform
    this.platforms._configureFlower(startPlat, startH);
    this.platforms._lastSpawnX = 0;
    this.platforms._lastSpawnH = startH;
    this.platforms._spawnedUpTo = 0;

    // Place player on top of the starting flower
    const startHeadY = GROUND_Y + startH;
    this.player.reset(0, startHeadY + PLATFORM_HH + PLAYER_RADIUS);

    // Start background music
    this.sound.startMusic();

    this._overlay.classList.add('hidden');
    this._updateHUD();
  }

  _gameOver() {
    this.running = false;
    this.sound.stopMusic(); // Stop background music on game over
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('bw_high', String(this.highScore));
      this._highScoreEl.textContent = `Best: ${this.highScore}`;
    }
    this._overlayTitle.textContent = 'Game Over';
    this._finalScore.textContent = `Score: ${this.score}`;
    this._finalScore.classList.remove('hidden');
    this._overlayHint.textContent = 'Press SPACE to retry';
    this._overlay.classList.remove('hidden');
  }

  _loadAudioSettings() {
    const musicEnabled = localStorage.getItem('bw_music_enabled');
    const soundEnabled = localStorage.getItem('bw_sound_enabled') ?? localStorage.getItem('bw_ambient_enabled');

    if (musicEnabled !== null) {
      this.sound.musicEnabled = musicEnabled === 'true';
    }
    if (soundEnabled !== null) {
      this.sound.setAmbientEnabled(soundEnabled === 'true');
    }

    // Update button states
    const musicBtn = document.getElementById('musicToggle');
    const ambientBtn = document.getElementById('ambientToggle');
    if (musicBtn) {
      musicBtn.classList.toggle('disabled', !this.sound.musicEnabled);
    }
    if (ambientBtn) {
      ambientBtn.classList.toggle('disabled', !this.sound.enabled);
    }
  }

  _saveAudioSettings() {
    localStorage.setItem('bw_music_enabled', this.sound.musicEnabled);
    localStorage.setItem('bw_sound_enabled', this.sound.enabled);
    localStorage.setItem('bw_ambient_enabled', this.sound.enabled);
  }

  _updateHUD() {
    this._scoreEl.textContent = this.score;
    this._bombEl.textContent = `Bombs: ${this.bombCount}`;
    for (const btn of this._bombButtons) {
      btn.classList.toggle('empty', this.bombCount <= 0);
      btn.setAttribute('aria-disabled', this.bombCount <= 0 ? 'true' : 'false');
    }
    this._healthFill.style.width = this.health + '%';
  }

  _loop(timestamp) {
    requestAnimationFrame(this._loop);

    const dt = Math.min((timestamp - this._lastTime) / 1000, 0.05);
    this._lastTime = timestamp;

    // -- Pause toggle (works whether running or paused) --
    if (this.input.consumePause()) {
      if (this.running || this.paused) this._togglePause();
    }

    // Handle start / restart
    if (!this.running && !this.paused) {
      this.input.consumeBomb();
      if (this.input.consumeJump()) this.start();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // If paused, just render and return
    if (this.paused) {
      this.input.consumeBomb();
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // -- Input --
    const hDir = this.input.getHorizontal();
    if (this.input.consumeJump()) {
      this.player.boost();
      this.sound.playBuzz();
    }
    if (this.input.consumeBomb() && this.bombCount > 0) {
      this.bombCount--;
      this.bombs.drop(this.player);
      this._updateHUD();
    }

    // -- Update player --
    this.player.update(dt, hDir);

    // -- Camera follows player (smooth lerp) --
    const targetCamX = this.player.x + 3; // slightly ahead
    const targetCamY = THREE.MathUtils.clamp(this.player.y, -4, 2);
    this.camera.position.x += (targetCamX - this.camera.position.x) * 4 * dt;
    this.camera.position.y += (targetCamY - this.camera.position.y) * 3 * dt;

    // -- Screen shake --
    let shakeOffX = 0, shakeOffY = 0;
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const t = this._shakeTimer;
      const intensity = this._shakeIntensity * (t / 0.3); // fade out
      shakeOffX = (Math.random() - 0.5) * 2 * intensity;
      shakeOffY = (Math.random() - 0.5) * 2 * intensity;
    }
    this.camera.position.x += shakeOffX;
    this.camera.position.y += shakeOffY;

    // -- Parallax --
    this._updateParallax(this.camera.position.x - shakeOffX);

    // Keep ground centered on camera horizontally
    this.groundMesh.position.x = this.camera.position.x;
    this.groundLine.position.x = this.camera.position.x;

    // Camera world bounds
    const camLeft  = this.camera.position.x + this.camera.left;
    const camRight = this.camera.position.x + this.camera.right;

    // -- Spawn & update world --
    this.platforms.spawnAhead(camRight);
    this.platforms.cleanup(camLeft);
    this.platforms.collide(this.player);

    // Spawn honey on platforms that don't have any yet
    this.collectibles.spawnOnPlatforms(this.platforms.pool);
    this.collectibles.update(dt, camLeft);

    this.enemies.spawnAhead(camRight);
    this.enemies.update(dt, camLeft);

    this.bombs.update(dt, camLeft, camRight);
    const waspsDestroyed = this.bombs.destroyHitWasps(this.enemies, this.effects);
    if (waspsDestroyed > 0) {
      this._triggerShake(0.4, 0.3);
      this.sound.playBomb();
    }
    this.effects.update(dt, camLeft);

    // -- Collect honey --
    const collected = this.collectibles.collect(this.player);
    if (collected > 0) {
      this.honeyScore += collected * 10;
      this._honeySinceBomb += collected;
      while (this._honeySinceBomb >= HONEY_ITEMS_PER_BOMB && this.bombCount < MAX_BOMBS) {
        this.bombCount++;
        this._honeySinceBomb -= HONEY_ITEMS_PER_BOMB;
      }
      if (this.bombCount >= MAX_BOMBS) {
        this._honeySinceBomb = Math.min(this._honeySinceBomb, HONEY_ITEMS_PER_BOMB - 1);
      }
      this.sound.playChime();
    }

    // -- Ambient sounds --
    this.sound.playAmbientSounds();

    // -- Distance score: furthest x reached --
    if (this.player.x > this._furthestX) {
      this._furthestX = this.player.x;
    }
    this.score = Math.floor(this._furthestX) + this.honeyScore;
    this._updateHUD();

    // -- Invincibility timer --
    if (this._invincibleTimer > 0) {
      this._invincibleTimer -= dt;
      // Flash the bee to show invincibility
      this.player.group.visible = Math.floor(this._invincibleTimer * 10) % 2 === 0;
    } else {
      this.player.group.visible = true;
    }

    // -- Ground collision: land on the ground instead of dying --
    if (this.player.y - this.player.radius < GROUND_Y) {
      this.player.y = GROUND_Y + this.player.radius;
      this.player.vy = 0;
      this.player.onPlatform = true;
    }

    // Wasp hit: -10% health with brief invincibility
    if (this._invincibleTimer <= 0 && this.enemies.checkHit(this.player)) {
      this.health -= 10;
      this._updateHUD();
      this._triggerShake(0.4, 0.3); // screen shake on hit
      this.sound.playSting();
      if (this.health <= 0) {
        this.health = 0;
        this._triggerShake(0.7, 0.5); // bigger shake on death
        this._gameOver();
      } else {
        this._invincibleTimer = 1.0; // 1 second of invincibility
        // Knockback: push bee away from wasp
        this.player.vy = 6;
      }
    }

    // -- Render --
    this.renderer.render(this.scene, this.camera);
  }
}

// ============================================================
//  BOOT
// ============================================================
const game = new Game();
