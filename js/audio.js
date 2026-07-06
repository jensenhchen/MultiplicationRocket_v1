(function () {
  "use strict";

  const RocketMath = window.RocketMath || {};
  const AUDIO_KEY = "multiplicationRocket.audio.v1";
  const DEFAULT_SETTINGS = {
    soundEnabled: true,
    musicEnabled: false
  };

  let audioContext = null;
  let musicTimer = null;
  let settings = loadSettings();

  function loadSettings() {
    try {
      const saved = window.localStorage.getItem(AUDIO_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
    } catch (error) {
      // Audio preference is helpful, but storage should never block play.
    }
  }

  function unlock() {
    if (!audioContext) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      audioContext = new Context();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    if (settings.musicEnabled) startMusic();
    return true;
  }

  function toggleSound() {
    settings.soundEnabled = !settings.soundEnabled;
    saveSettings();
    if (settings.soundEnabled) play("click");
    return settings.soundEnabled;
  }

  function toggleMusic() {
    settings.musicEnabled = !settings.musicEnabled;
    saveSettings();

    if (settings.musicEnabled) {
      unlock();
      startMusic();
    } else {
      stopMusic();
    }

    return settings.musicEnabled;
  }

  function play(name) {
    if (!settings.soundEnabled || !unlock()) return;

    const patterns = {
      click: [{ frequency: 540, duration: 0.045, type: "triangle", volume: 0.04 }],
      correct: [
        { frequency: 660, duration: 0.08, type: "sine", volume: 0.06 },
        { frequency: 880, duration: 0.11, type: "sine", volume: 0.055, delay: 0.07 }
      ],
      wrong: [
        { frequency: 220, duration: 0.09, type: "triangle", volume: 0.045 },
        { frequency: 170, duration: 0.1, type: "triangle", volume: 0.035, delay: 0.08 }
      ],
      boost: [
        { frequency: 150, duration: 0.12, type: "sawtooth", volume: 0.035 },
        { frequency: 300, duration: 0.16, type: "sawtooth", volume: 0.025, delay: 0.05 }
      ],
      complete: [
        { frequency: 523, duration: 0.09, type: "sine", volume: 0.05 },
        { frequency: 659, duration: 0.09, type: "sine", volume: 0.05, delay: 0.09 },
        { frequency: 784, duration: 0.14, type: "sine", volume: 0.055, delay: 0.18 }
      ],
      applause: [
        { frequency: 880, duration: 0.06, type: "square", volume: 0.025 },
        { frequency: 990, duration: 0.06, type: "square", volume: 0.025, delay: 0.07 },
        { frequency: 1175, duration: 0.12, type: "triangle", volume: 0.04, delay: 0.16 }
      ]
    };

    (patterns[name] || patterns.click).forEach(playTone);
  }

  function playTone(tone) {
    const startAt = audioContext.currentTime + (tone.delay || 0);
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(tone.volume, startAt + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + tone.duration + 0.02);
  }

  function startMusic() {
    if (!audioContext || musicTimer) return;

    const notes = [262, 330, 392, 330, 294, 349, 440, 349];
    let noteIndex = 0;
    musicTimer = window.setInterval(() => {
      if (!settings.musicEnabled) return;
      playMusicTone(notes[noteIndex % notes.length]);
      noteIndex += 1;
    }, 850);
  }

  function stopMusic() {
    if (!musicTimer) return;
    window.clearInterval(musicTimer);
    musicTimer = null;
  }

  function playMusicTone(frequency) {
    if (!audioContext || audioContext.state === "suspended") return;

    const startAt = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.018, startAt + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.55);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.6);
  }

  function getSettings() {
    return { ...settings };
  }

  RocketMath.audio = {
    unlock,
    play,
    toggleSound,
    toggleMusic,
    getSettings
  };

  window.RocketMath = RocketMath;
})();
