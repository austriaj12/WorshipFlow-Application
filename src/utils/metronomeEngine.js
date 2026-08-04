/**
 * Metronome & Advance Voice Cue Engine
 * High-precision Web Audio API Lookahead Scheduler for WorshipFlow
 */

class MetronomeEngine {
  constructor() {
    this.audioCtx = null;
    this.bpm = 120;
    this.timeSignature = '4/4';
    this.beatsPerMeasure = 4;
    this.enableClick = true;
    this.enableVoiceCues = true;
    this.voiceGender = 'female'; // 'female' | 'male'
    this.isPlaying = false;
    
    // Scheduler parameters
    this.lookahead = 25.0; // How frequently to call scheduling function (in ms)
    this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (in sec)
    this.nextNoteTime = 0.0; // When the next note is due (in sec)
    this.currentBeat = 0; // Current beat in measure (0 to beatsPerMeasure - 1)
    this.timerId = null;
    this.outputDeviceId = '';
    
    // Callbacks
    this.onBeatCallback = null;
    
    // Track last triggered voice cue to avoid duplicates
    this.lastTriggeredCue = '';
    this.lastCueTime = 0;

    // Cache available speech synthesis voices
    this.voices = [];
    this.initVoices();
  }

  initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices() || [];
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  getBestVoice(gender) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return null;
    }

    const availableVoices = window.speechSynthesis.getVoices() || [];
    if (availableVoices.length === 0) return null;

    const targetGender = (gender || this.voiceGender || 'female').toLowerCase();
    const isMale = targetGender === 'male';

    let match = null;
    if (isMale) {
      match = availableVoices.find(v => /david|mark|george|james|richard|sean|guy|male/i.test(v.name));
      if (!match) {
        match = availableVoices.find(v => !/zira|eva|samantha|hazel|susan|catherine|female/i.test(v.name) && (v.lang || '').startsWith('en'));
      }
    } else {
      match = availableVoices.find(v => /zira|eva|samantha|hazel|susan|catherine|female/i.test(v.name));
      if (!match) {
        match = availableVoices.find(v => /zira|eva|female/i.test(v.name));
      }
    }

    if (!match && availableVoices.length > 0) {
      match = availableVoices.find(v => (v.lang || '').startsWith('en')) || availableVoices[0];
    }

    return match;
  }

  initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  parseBeatsPerMeasure(tsStr) {
    if (!tsStr) return 4;
    const parts = tsStr.toString().split('/');
    const beats = parseInt(parts[0], 10);
    return isNaN(beats) || beats < 1 ? 4 : beats;
  }

  start({ bpm = 120, timeSignature = '4/4', enableClick = true, enableVoiceCues = true, voiceGender = 'female', deviceId = '' } = {}) {
    this.initAudioContext();
    if (!this.audioCtx) return;

    this.bpm = Math.max(30, Math.min(300, parseInt(bpm, 10) || 120));
    this.timeSignature = timeSignature || '4/4';
    this.beatsPerMeasure = this.parseBeatsPerMeasure(this.timeSignature);
    this.enableClick = !!enableClick;
    this.enableVoiceCues = !!enableVoiceCues;
    this.voiceGender = voiceGender === 'male' ? 'male' : 'female';
    
    if (deviceId && deviceId !== this.outputDeviceId) {
      this.setAudioOutputDevice(deviceId);
    }

    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;
    this.currentBeat = 0;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;

    this.timerId = setInterval(() => this.scheduler(), this.lookahead);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isPlaying = false;
    this.currentBeat = 0;
    if (this.onBeatCallback) {
      this.onBeatCallback(-1, this.beatsPerMeasure);
    }
  }

  updateTempo(bpm, timeSignature) {
    if (bpm) {
      this.bpm = Math.max(30, Math.min(300, parseInt(bpm, 10) || 120));
    }
    if (timeSignature) {
      this.timeSignature = timeSignature;
      this.beatsPerMeasure = this.parseBeatsPerMeasure(timeSignature);
    }
  }

  setEnableClick(enabled) {
    this.enableClick = !!enabled;
  }

  setEnableVoiceCues(enabled) {
    this.enableVoiceCues = !!enabled;
  }

  setVoiceGender(gender) {
    this.voiceGender = gender === 'male' ? 'male' : 'female';
  }

  async setAudioOutputDevice(deviceId) {
    this.outputDeviceId = deviceId || '';
    if (this.audioCtx && typeof this.audioCtx.setSinkId === 'function') {
      try {
        await this.audioCtx.setSinkId(this.outputDeviceId);
        console.log('Metronome audio output routed to device:', deviceId);
      } catch (err) {
        console.warn('Failed setting metronome AudioContext sinkId:', err);
      }
    }
  }

  scheduler() {
    if (!this.isPlaying || !this.audioCtx) return;

    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentBeat, this.nextNoteTime);
      this.advanceNote();
    }
  }

  advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    this.nextNoteTime += secondsPerBeat;
    this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
  }

  scheduleNote(beatNumber, time) {
    const isFirstBeat = beatNumber === 0;

    // Play Click Sound if click enabled
    if (this.enableClick) {
      this.playClick(time, isFirstBeat);
    }

    // Trigger visual beat pulse callback
    if (this.onBeatCallback) {
      const delayMs = Math.max(0, (time - this.audioCtx.currentTime) * 1000);
      setTimeout(() => {
        if (this.isPlaying && this.onBeatCallback) {
          this.onBeatCallback(beatNumber, this.beatsPerMeasure);
        }
      }, delayMs);
    }
  }

  playClick(time, isFirstBeat) {
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      // Accent Beat 1 (1200Hz high pitch) vs sub-beats (800Hz medium pitch)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFirstBeat ? 1200 : 800, time);

      const peakGain = isFirstBeat ? 0.8 : 0.5;
      const decayDuration = isFirstBeat ? 0.04 : 0.03;

      gain.gain.setValueAtTime(peakGain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decayDuration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(time);
      osc.stop(time + decayDuration);
    } catch (e) {
      console.warn('Click audio synthesis error:', e);
    }
  }

  /**
   * Advance Section Voice Cue Dispatcher
   * Announces upcoming section label (e.g. "Chorus", "Verse 2", "Bridge") 
   * in advance matching natural voice gender (Female vs Male)
   */
  triggerVoiceCue(sectionLabel, forceGender = null) {
    if (!this.enableVoiceCues || !sectionLabel) return;

    const targetGender = forceGender || this.voiceGender || 'female';
    const now = Date.now();
    const cleanLabel = sectionLabel.toString().trim();
    if (!cleanLabel) return;

    // Avoid duplicate cues within 1.5 seconds
    if (this.lastTriggeredCue === cleanLabel && (now - this.lastCueTime) < 1500) {
      return;
    }

    this.lastTriggeredCue = cleanLabel;
    this.lastCueTime = now;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel(); // Clear any queued speech
        const speechText = cleanLabel.toUpperCase().startsWith('SLIDE') 
          ? cleanLabel 
          : cleanLabel.replace(/x\d+/gi, '').replace(/\d+/g, '').trim() || cleanLabel;
          
        const utterance = new SpeechSynthesisUtterance(speechText);
        // Use natural 1.0 pitch and rate for organic, human-like voice quality
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voice = this.getBestVoice(targetGender);
        if (voice) {
          utterance.voice = voice;
        }

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis voice cue error:', err);
      }
    }
  }

  setOnBeatCallback(cb) {
    this.onBeatCallback = cb;
  }
}

export const metronomeEngine = new MetronomeEngine();
