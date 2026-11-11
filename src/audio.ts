/**
 * TETRIS EL REY - RETRO-FUTURISTA VIP
 * Síntesis de Audio Arcade Neón Web Audio API
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioClass) {
        this.ctx = new AudioClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public triggerHaptic(duration = 10) {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(duration);
      } catch {
        // Ignorar restricciones en navegadores
      }
    }
  }

  public play(type: 'move' | 'rotate' | 'drop' | 'line' | 'tetris' | 'level' | 'gameover' | 'click') {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (type) {
        case 'click': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
          osc.start(now);
          osc.stop(now + 0.04);
          break;
        }

        case 'move': {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(290, now);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
          osc.start(now);
          osc.stop(now + 0.035);
          this.triggerHaptic(8);
          break;
        }

        case 'rotate': {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(680, now + 0.065);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
          osc.start(now);
          osc.stop(now + 0.065);
          this.triggerHaptic(12);
          break;
        }

        case 'drop': {
          osc.type = 'square';
          osc.frequency.setValueAtTime(160, now);
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.start(now);
          osc.stop(now + 0.08);
          this.triggerHaptic(28);
          break;
        }

        case 'line': {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(540, now);
          osc.frequency.linearRampToValueAtTime(920, now + 0.14);
          gain.gain.setValueAtTime(0.16, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          osc.start(now);
          osc.stop(now + 0.16);
          this.triggerHaptic(35);
          break;
        }

        case 'tetris': {
          const chord = [523.25, 659.25, 783.99, 1046.5];
          chord.forEach((freq, idx) => {
            const chordOsc = ctx.createOscillator();
            const chordGain = ctx.createGain();
            chordOsc.type = 'sawtooth';
            chordOsc.frequency.setValueAtTime(freq, now + idx * 0.05);
            chordGain.gain.setValueAtTime(0.1, now + idx * 0.05);
            chordGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
            chordOsc.connect(chordGain);
            chordGain.connect(ctx.destination);
            chordOsc.start(now + idx * 0.05);
            chordOsc.stop(now + idx * 0.05 + 0.22);
          });
          this.triggerHaptic(60);
          break;
        }

        case 'level': {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320, now);
          osc.frequency.exponentialRampToValueAtTime(840, now + 0.25);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          osc.start(now);
          osc.stop(now + 0.25);
          this.triggerHaptic(45);
          break;
        }

        case 'gameover': {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(340, now);
          osc.frequency.exponentialRampToValueAtTime(65, now + 0.5);
          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.start(now);
          osc.stop(now + 0.5);
          this.triggerHaptic(80);
          break;
        }
      }
    } catch {
      // Continuar sin audio si el navegador restringe el contexto
    }
  }
}

export const sounds = new SoundEngine();
