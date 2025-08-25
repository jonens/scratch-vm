
const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const TargetType = require('../../extension-support/target-type');
const Cast = require('../../util/cast');
const Clone = require('../../util/clone');
const MathUtil = require('../../util/math-util');
const Tone = require('../../../node_modules/tone/build/esm/index.js');
//const Tone = require('../../../node_modules/tone/build/Tone.js');
//const Clock = require('../../io/clock');
const NOISE_TYPE_PINK = 'pink';
const NOISE_TYPE_WHITE = 'white';
const NOISE_TYPE_BROWN = 'brown';
const OSCILLATOR_TYPE_AM = 'AM OSC';
const OSCILLATOR_TYPE_FAT = 'Fat OSC';
const OSCILLATOR_TYPE_FM = 'FM OSC';
const OSCILLATOR_TYPE_OSC = 'OSC';
const OSCILLATOR_TYPE_PWM = 'PWM OSC';
const OSCILLATOR_TYPE_PULSE = 'Pulse OSC';
const OSCILLATOR_TYPE_LFO = 'LFO';
const OSCILLATOR_TYPE_AM_BASE = 'AM OSC Base';
const OSCILLATOR_TYPE_AM_MOD = 'AM OSC Mod';
const OSCILLATOR_TYPE_FM_BASE = 'FM OSC Base';
const OSCILLATOR_TYPE_FM_MOD = 'FM OSC Mod';
const SOURCE_TYPE_ALL = 'All Sounds';
const EFFECT_TYPE_AUTOFILTER = 'autoFilter';
const EFFECT_TYPE_CHORUS = 'chorus';
const EFFECT_TYPE_DISTORTION = 'distortion';
const EFFECT_TYPE_FEEDBACKDELAY = 'feedbackDelay';
const EFFECT_TYPE_PINGPONGDELAY = 'pingpongDelay';
const EFFECT_TYPE_PHASER = 'phaser';
const EFFECT_TYPE_PITCHSHIFT = 'pitchShift';
const EFFECT_TYPE_REVERB = 'reverb';
const EFFECT_TYPE_ALL = 'allEffects';
const EFFECT_TYPE_VIBRATO = 'vibrato';
const FILTER_TYPE_LOW_PASS = "lowpass";
const FILTER_TYPE_HIGH_PASS = "highpass";
const FILTER_TYPE_BAND_PASS =	"bandpass";
const FILTER_TYPE_NOTCH =	"notch";
const LFO_SIGNAL_TYPE_FILTER_Q = "filter Q";
const LFO_SIGNAL_TYPE_FILTER_FREQ = "filter freq";
const LFO_SIGNAL_TYPE_PWM_MOD_FREQ = "pwm mod freq";
const NORMAL_EFFECT_WET = 'wet';
const NORMAL_EFFECT_DEPTH = 'depth';
const NORMAL_EFFECT_DISTORTION = 'distortion';
const NORMAL_EFFECT_FEEDBACK = 'feedback';
const NORMAL_EFFECT_DELAY_TIME = 'delay time';
const NORMAL_EFFECT_MOD_FREQUENCY = 'modFrequency';
const SOUND_EFFECT_REVERSE = 'reverse';
const SOUND_EFFECT_LOOP = 'loop';
const SOUND_EFFECT_MUTE = 'mute';
const LFO_EFFECT_FREQ = 'lfoFrequency';
const LFO_EFFECT_Q = 'lfoQ';
const COMPONENT_TYPE_AMPLITUDE_ENVELOPE = 'ADSR Envelope';
const COMPONENT_TYPE_FILTER = 'filter';
const COMPONENT_TYPE_FFT = 'fft';
const COMPONENT_TYPE_WAVEFORM = 'waveform';
const COMPONENT_TYPE_GAIN = 'gain';
const COMPONENT_BIN_SIZE = 512;
const MIN_VOLUME = 0.0;
const MAX_VOLUME = 100.0;
const MAX_POLYPHONY = 30;
const PLAYBACK_STATE_STARTED = "started";
const PLAYBACK_STATE_STOPPED = "stopped";

class Scratch3ToneSynth {
  constructor (runtime) {
    this.runtime = runtime;
    this._onTargetCreated = this._onTargetCreated.bind(this);
    this.runtime.on('targetWasCreated', this._onTargetCreated);
    //this.clock = new Clock(runtime);
    this.fmModType = 'sine';
    this.amModType = 'sine';
    this.pwmModFreq = 0.5;
    this.pulseWidth = 0.5;
  }

  _getNote(note) {
    let noteNumber = Cast.toNumber(note);
    let basicNote = noteNumber % 12;
    let octave = Math.floor(noteNumber/12) - 1;
    var noteName = "";
    switch (basicNote) {
      case 0:
      noteName = "C"+octave+"";
      break;
      case 1:
      noteName = "C#"+octave+"";
      break;
      case 2:
      noteName = "D"+octave+"";
      break;
      case 3:
      noteName = "D#"+octave+"";
      break;
      case 4:
      noteName = "E"+octave+"";
      break;
      case 5:
      noteName = "F"+octave+"";
      break;
      case 6:
      noteName = "F#"+octave+"";
      break;
      case 7:
      noteName = "G"+octave+"";
      break;
      case 8:
      noteName = "G#"+octave+"";
      break;
      case 9:
      noteName = "A"+octave+"";
      break;
      case 10:
      noteName = "A#"+octave+"";
      break;
      case 11:
      noteName = "B"+octave+"";
      break;
    }
    return noteName;
  }

  /**
   * The key to load & store a target's synth-related state.
   * @type {string}
   */
  static get STATE_KEY () {
      return 'Scratch.toneSynth';
  }

  /**
   * The default music-related state, to be used when a target has no existing music state.
   * @type {SynthState}
   */
  static get DEFAULT_SYNTH_STATE () {
      return {
          currentVolume: 100.0,
          effectMap: null,
          sourceMap: null,
          channelMap: null,
          adsrMap:null,
          lfo: null,
          gain: null,
          binSize: 512
      };
  }

  /**
   * @param {Target} target - collect music state for this target.
   * @returns {SynthState} the mutable synth state associated with that target. This will be created if necessary.
   * @private
   */
  _getSynthState (target) {
      let synthState = target.getCustomState(Scratch3ToneSynth.STATE_KEY);
      if (!synthState) {
          synthState = Clone.simple(Scratch3ToneSynth.DEFAULT_SYNTH_STATE);
          target.setCustomState(Scratch3ToneSynth.STATE_KEY, synthState);
      }
      return synthState;
  }
  /**
   * When a synth Target is cloned, clone the music state.
   * @param {Target} newTarget - the newly created target.
   * @param {Target} [sourceTarget] - the target used as a source for the new clone, if any.
   * @listens Runtime#event:targetWasCreated
   * @private
   */
  _onTargetCreated (newTarget, sourceTarget) {
      if (sourceTarget) {
          const synthState = sourceTarget.getCustomState(Scratch3ToneSynth.STATE_KEY);
          if (synthState) {
              newTarget.setCustomState(Scratch3ToneSynth.STATE_KEY, Clone.simple(synthState));
          }
      }
  }

  getInfo () {
    return {
      id: 'toneSynth',
      name: 'Tone Synth',

      // Core extensions only: override the default extension block colors.
      color1: '#00D6B8',
      color2: '#FF2FCE',

      blocks: [
        {
          opcode: 'changeWaveForm',
          blockType: BlockType.COMMAND,
          text: 'waveform [WAVE] : [SOURCE]',
          arguments: {
            WAVE: {
              type: ArgumentType.STRING,
              menu: 'waveMenu'
            },
            SOURCE: {
              type: ArgumentType.STRING,
              menu: 'waveFormSourceMenu'
            }
          },
        },

        {
          opcode: 'setDetune',
          blockType: BlockType.COMMAND,
          text: 'detune [OSC_TYPE]: [DETUNE]',
          arguments: {
            OSC_TYPE: {
              type: ArgumentType.STRING,
              menu: 'oscMenu',
            },
            DETUNE: {
              type: ArgumentType.NUMBER,
              defaultValue: 0,
            },
          },
        },
        {
          opcode: 'setHarmonicity',
          blockType: BlockType.COMMAND,
          text: '[OSC_TYPE] harmonicity: [HARMONICITY]',
          arguments: {
            OSC_TYPE: {
              type: ArgumentType.STRING,
              menu: 'harmonicityOscMenu',
            },
            HARMONICITY: {
              type: ArgumentType.NUMBER,
              menu: 'harmonicityMenu',
            },
          },
        },
        {
          opcode: 'setPulseWidth',
          blockType: BlockType.COMMAND,
          text: 'pulse width: [WIDTH]',
          arguments: {
            WIDTH: {
              type: ArgumentType.NUMBER,
              menu: 'pulseWidthMenu',
            },
          },
        },
        {
          opcode: 'setPWMModFrequency',
          blockType: BlockType.COMMAND,
          text: 'pwm mod freq: [FREQUENCY]',
          arguments: {
            FREQUENCY: {
              type: ArgumentType.NUMBER,
              menu: 'lfoFreqMenu',
            },
          },
        },

        '---',

        {
          opcode: 'setAttackRelease',
          blockType: BlockType.COMMAND,
          text: 'attack: [ATTACK] release: [RELEASE]',
          arguments: {
            ATTACK: {
              type: ArgumentType.NUMBER,
              defaultValue: 0.1,
            },
            RELEASE: {
              type: ArgumentType.NUMBER,
              defaultValue: 0.8,
            }
          },
        },
        {
          opcode: 'playNote',
          blockType: BlockType.COMMAND,
          text: 'play [SOURCE] note: [NOTE] for: [DURATION] seconds',
          arguments: {
            SOURCE: {
              type: ArgumentType.STRING,
              menu: 'noteSourceTypeMenu'
            },
            NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 60
            },
            DURATION: {
              type: ArgumentType.NUMBER,
              defaultValue: 1.0
            },
          },
        },
        {
          opcode: 'startSourceNote',
          blockType: BlockType.COMMAND,
          text: 'start [SOURCE] note: [NOTE]',
          arguments: {
            SOURCE: {
              type: ArgumentType.STRING,
              menu: 'noteSourceTypeMenu'
            },
            NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 60
            },
          },
        },
        {
          opcode: 'startSourceSound',
          blockType: BlockType.COMMAND,
          text: 'start [SOURCE]',
          arguments: {
            SOURCE: {
              type: ArgumentType.STRING,
              menu: 'sourceTypeMenu'
            },
          },
        },
        {
          opcode: 'getSoundLength',
          blockType: BlockType.REPORTER,
          text: '[SOUND_SOURCE] length (sec)',
          arguments: {
            SOUND_SOURCE: {
              type: ArgumentType.STRING,
              menu: 'soundMenu',
            },
          },
        },
        {
          opcode: 'glide',
          blockType: BlockType.COMMAND,
          text: 'Glide [OSC_TYPE] from [START_NOTE] to [END_NOTE] for [SECONDS] seconds',
          arguments: {
            OSC_TYPE: {
              type: ArgumentType.STRING,
              menu: 'oscillatorTypeMenu'
            },
            START_NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 48
            },
            END_NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 60
            },
            SECONDS: {
              type: ArgumentType.NUMBER,
              defaultValue: 2
            }
          },
        },
        {
          opcode: 'stopSourceSound',
          blockType: BlockType.COMMAND,
          text: 'stop [SOURCE_TYPE]',
          arguments: {
            SOURCE_TYPE: {
              type: ArgumentType.STRING,
              menu: 'stopSourceTypeMenu'
            },
          },
        },

        '---',

        {
          opcode: 'connectLfoToSignal',
          blockType: BlockType.COMMAND,
          text: 'LFO to [SIGNAL]',
          arguments: {
            SIGNAL: {
              type: ArgumentType.STRING,
              menu: 'lfoToSignalMenu'
            },
          },
        },
        {
          opcode: 'setLfoFrequency',
          blockType: BlockType.COMMAND,
          text: '[EFFECT_TYPE] frequency : [VALUE] (1-15)',
          arguments: {
            EFFECT_TYPE: {
              type: ArgumentType.STRING,
              menu: 'lfoFreqSourceMenu',
            },
            VALUE: {
              type: ArgumentType.STRING,
              menu: 'lfoFreqMenu',
            }
          },
        },
        {
          opcode: 'setLfoMinMax',
          blockType: BlockType.COMMAND,
          text: 'LFO min: [MIN] max: [MAX] (0-4000)',
          arguments: {
            MIN: {
              type: ArgumentType.NUMBER,
              defaultValue: 50
            },
            MAX: {
              type: ArgumentType.NUMBER,
              defaultValue: 700
            },
          },
        },
        {
          opcode: 'disconnectLFO',
          blockType: BlockType.COMMAND,
          text: 'remove LFO',
        },

        '---',

        {
          opcode: 'addEffect',
          blockType: BlockType.COMMAND,
          text: 'add [EFFECT]',
          arguments: {
            EFFECT: {
              type: ArgumentType.STRING,
              menu: 'effectMenu'
            },
          },
        },
        {
          opcode: 'removeEffect',
          blockType: BlockType.COMMAND,
          text: 'remove [EFFECT]',
          arguments: {
            EFFECT: {
              type: ArgumentType.STRING,
              menu: 'removeEffectMenu'
            },
          },
        },
        {
          opcode: 'setNormalRangeEffect',
          blockType: BlockType.COMMAND,
          text: '[EFFECT_TYPE] [EFFECT_PARAM] : [VALUE] (0-1)',
          arguments: {
            EFFECT_TYPE: {
              type: ArgumentType.STRING,
              menu: 'effectMenu',
            },
            EFFECT_PARAM: {
              type: ArgumentType.STRING,
              menu: 'normalEffectParamMenu'
            },
            VALUE: {
              type: ArgumentType.NUMBER,
              menu: 'normalEffectValueMenu',
            }
          },
        },
        {
          opcode: 'setSoundEffect',
          blockType: BlockType.COMMAND,
          text: '[SOUND_SOURCE] [EFFECT] [ON]',
          arguments: {
            SOUND_SOURCE: {
              type: ArgumentType.STRING,
              menu: 'soundMenu',
            },
            EFFECT: {
              type: ArgumentType.STRING,
              menu: 'soundEffectMenu'
            },
            ON: {
              type: ArgumentType.STRING,
              menu: 'soundEffectOnMenu',
            }
          },
        },

        {
          opcode: 'setFeedbackDelay',
          blockType: BlockType.COMMAND,
          text: '[SOURCE] feedback:[FEEDBACK] delay : [DELAY_TIME]',
          arguments: {
            SOURCE: {
              type: ArgumentType.STRING,
              menu: 'feedbackDelaySourceMenu',
            },
            FEEDBACK: {
              type: ArgumentType.NUMBER,
              menu: 'normalEffectValueMenu',
            },
            DELAY_TIME: {
              type: ArgumentType.NUMBER,
              menu: 'normalEffectValueMenu',
            },
          },
        },
        {
          opcode: 'setReverbDecay',
          blockType: BlockType.COMMAND,
          text: 'reverb decay:[DECAY_TIME]',
          arguments: {
            DECAY_TIME: {
              type: ArgumentType.NUMBER,
              defaultValue: 0.5,
            },
          },
        },
        {
          opcode: 'setPitchShiftInterval',
          blockType: BlockType.COMMAND,
          text: 'pitch shift: [PITCH_SHIFT]',
          arguments: {
            PITCH_SHIFT: {
              type: ArgumentType.NUMBER,
              defaultValue: 0,
            },
          },
        },
        {
          opcode: 'setFilter',
          blockType: BlockType.COMMAND,
          text: 'Filter [TYPE] freq: [FREQ] Q: [FILTER_Q]',
          arguments: {
            TYPE: {
              type: ArgumentType.STRING,
              menu: 'filterTypeMenu',
            },
            FREQ: {
              type: ArgumentType.NUMBER,
              defaultValue: 1500,
            },
            FILTER_Q: {
              type: ArgumentType.STRING,
              menu: 'qValuesMenu',
            },
          },
        },

        '---',

        {
          opcode: 'setVolume',
          blockType: BlockType.COMMAND,
          text: 'set volume to: [VOLUME] %',
          arguments: {
            VOLUME: {
              type: ArgumentType.NUMBER,
              defaultValue: 100,
            }
          },
        },
        {
          opcode: 'changeVolume',
          blockType: BlockType.COMMAND,
          text: 'change volume by: [VOLUME_CHANGE]',
          arguments: {
            VOLUME_CHANGE: {
              type: ArgumentType.NUMBER,
              defaultValue: 10,
            }
          },
        },
        {
          opcode: 'getVolume',
          blockType: BlockType.REPORTER,
          text: 'volume',
        },

        '---',

        {
          opcode: 'setBinSize',
          blockType: BlockType.COMMAND,
          text: 'FFT/Wave size: [BIN_SIZE]',
          arguments: {
            BIN_SIZE: {
              type: ArgumentType.NUMBER,
              menu: 'binSizeMenu',
            },
          },
        },
        {
          opcode: 'connectFFT',
          blockType: BlockType.COMMAND,
          text: 'Connect [SOURCE_TYPE] to FFT',
          arguments: {
            SOURCE_TYPE: {
              type: ArgumentType.STRING,
              menu: 'sourceTypeMenu',
            },
          },
        },
        {
          opcode: 'getFFT',
          blockType: BlockType.REPORTER,
          text: 'FFT',
          disableMonitor: true,
        },
        {
          opcode: 'getFFTValueAtIndex',
          blockType: BlockType.REPORTER,
          text: 'FFT value at: [INDEX]',
          arguments: {
            INDEX: {
              type: ArgumentType.NUMBER,
              defaultValue: 0,
            },
          },
        },
        {
          opcode: 'getFftSize',
          blockType: BlockType.REPORTER,
          text: 'FFT size',
        },
        {
          opcode: 'connectWaveform',
          blockType: BlockType.COMMAND,
          text: 'Connect [SOURCE_TYPE] to waveform',
          arguments: {
            SOURCE_TYPE: {
              type: ArgumentType.STRING,
              menu: 'sourceTypeMenu',
            },
          },
        },
        {
          opcode: 'getWaveform',
          blockType: BlockType.REPORTER,
          text: 'Waveform',
          disableMonitor: true,
        },
        {
          opcode: 'getWaveformValueAtIndex',
          blockType: BlockType.REPORTER,
          text: 'Waveform value at: [INDEX]',
          arguments: {
            INDEX: {
              type: ArgumentType.NUMBER,
              defaultValue: 0,
            },
          },
        },
        {
          opcode: 'getWaveformSize',
          blockType: BlockType.REPORTER,
          text: 'Waveform size',
        },
      ],
      menus: {
        disconnectNodeMenu:  'getDisconnectNodeMenuItems',
        nodeToEffectMenu: 'getNodeToEffectMenuItems',
        nodeToADSRMenu: 'getNodeToADSRMenuItems',
        lfoToSignalMenu: 'getLFOSignalMenuItems',
        soundMenu: 'getScratchSoundMenuItems',
        noteSourceTypeMenu: 'getNoteSourceMenuItems',
        binSizeMenu: 'getBinSizeMenuItems',
        sourceTypeMenu: 'getSourceMenuItems',
        pulseWidthMenu: {
          acceptReporters: true,
          items: 'getPulseWidthMenuItems',
        },
        stopSourceTypeMenu: 'getStopSourceMenuItems',
        volumeMenu: {
          acceptReporters: true,
          items: 'getVolumeMenuItems',
        },
        oscillatorTypeMenu: 'getOscillatorMenuItems',
        noiseTypeMenu: {
          items: [
            {
              value: NOISE_TYPE_PINK,
              text: 'Pink Noise'
            },
            {
              value: NOISE_TYPE_WHITE,
              text: 'White Noise'
            },
            {
              value: NOISE_TYPE_BROWN,
              text: 'Brown Noise'
            },
          ]
        },
        waveFormSourceMenu: {
          items: [
            OSCILLATOR_TYPE_AM_BASE,
            OSCILLATOR_TYPE_AM_MOD,
            OSCILLATOR_TYPE_FAT,
            OSCILLATOR_TYPE_FM_BASE,
            OSCILLATOR_TYPE_FM_MOD,
            OSCILLATOR_TYPE_OSC,
            OSCILLATOR_TYPE_LFO,
          ]
        },
        oscMenu: {
          items: [
            OSCILLATOR_TYPE_AM,
            OSCILLATOR_TYPE_FAT,
            OSCILLATOR_TYPE_FM,
            OSCILLATOR_TYPE_OSC,
            OSCILLATOR_TYPE_PULSE,
            OSCILLATOR_TYPE_PWM,
          ]
        },
        freqMenu: {
          items: [
            OSCILLATOR_TYPE_AM,
            OSCILLATOR_TYPE_FAT,
            OSCILLATOR_TYPE_FM,
            OSCILLATOR_TYPE_OSC,
            OSCILLATOR_TYPE_PWM,
            OSCILLATOR_TYPE_PULSE,
            OSCILLATOR_TYPE_LFO,
          ]
        },
        normalEffectParamMenu: {
          items: [
             NORMAL_EFFECT_WET,
             NORMAL_EFFECT_DEPTH,
             NORMAL_EFFECT_DISTORTION,
          ]
        },
        normalEffectValueMenu: {
          acceptReporters: true,
          items: 'getNormalRangeMenuValues',
        },
        soundEffectMenu: {
          items: [
            SOUND_EFFECT_REVERSE,
            SOUND_EFFECT_MUTE,
          ]
        },
        soundEffectOnMenu: {
          items: [
            'on',
            'off',
          ]
        },
        feedbackDelaySourceMenu: {
          items: [
            {
              value: EFFECT_TYPE_FEEDBACKDELAY,
              text: 'Feedback Delay',
            },
            {
              value: EFFECT_TYPE_PINGPONGDELAY,
              text: 'PingPong Delay',
            },
          ]
        },
        filterTypeMenu: {
          items: [
            FILTER_TYPE_HIGH_PASS,
            FILTER_TYPE_LOW_PASS,
            FILTER_TYPE_BAND_PASS,
            FILTER_TYPE_NOTCH,
          ]
        },
        qValuesMenu: {
          acceptReporters: true,
          items: 'getQValues',
        },
        lfoFreqSourceMenu: {
          items: [
            OSCILLATOR_TYPE_LFO,
            EFFECT_TYPE_AUTOFILTER,
            EFFECT_TYPE_CHORUS,
            EFFECT_TYPE_PHASER,
            EFFECT_TYPE_VIBRATO
          ],
        },
        lfoEffectParamMenu: {
          items: [
            {
              value:  LFO_EFFECT_FREQ,
              text: 'LFO Frequency'
            },
            {
              value:  LFO_EFFECT_Q,
              text: 'Q'
            },
          ]
        },
        lfoFreqMenu: {
          acceptReporters: true,
          items: 'getLfoFreqAmount',
        },
        harmonicityOscMenu: {
          items: [
            OSCILLATOR_TYPE_AM,
            OSCILLATOR_TYPE_FM
          ],
        },
        harmonicityMenu: {
          acceptReporters: true,
          items: 'getHarmonicityValues',
        },
        delaySourceMenu: {
          items: [
            EFFECT_TYPE_CHORUS,
            EFFECT_TYPE_FEEDBACKDELAY,
            EFFECT_TYPE_PINGPONGDELAY,
            EFFECT_TYPE_PITCHSHIFT,
            EFFECT_TYPE_REVERB
          ],
        },
        delayTimeMenu: {
          acceptReporters: true,
          items: 'getDelayTimeAmount',
        },
        effectMenu: {
          items: 'getEffectMenuItems',
        },
        removeEffectMenu: {
          items: 'getRemoveEffectMenuItems',
        },
        wetEffectParameterMenu: {
          items: [
            EFFECT_TYPE_AUTOFILTER,
            EFFECT_TYPE_CHORUS,
            EFFECT_TYPE_DISTORTION,
            EFFECT_TYPE_FEEDBACKDELAY,
            EFFECT_TYPE_PINGPONGDELAY,
            EFFECT_TYPE_REVERB,
            EFFECT_TYPE_VIBRATO
          ]
        },
        waveMenu: {
          items: [
            {
              value: 'sine',
              text: 'sine'
            },
            {
              value: 'triangle',
              text: 'triangle'
            },
            {
              value: 'square',
              text: 'square'
            },
            {
              value: 'sawtooth',
              text: 'sawtooth'
            },
          ]
        },
      }
    };
  }

  getNodeToEffectMenuItems () {
    let nodes = [];
    let sources = this.getSourceMenuItems();
    for (let i = 0; i < sources.length; i++) {
      let source = sources[i];
      nodes.push(source);
    }
    return nodes;
  }

  getNodeToADSRMenuItems () {
    let nodes = [];
    let sources = this.getSourceMenuItems();
    for (let i = 0; i < sources.length; i++) {
      let source = sources[i];
      nodes.push(source);
    }
    let effects = this.getEffectMenuItems();
    for (let i = 0; i < effects.length; i++) {
      let effect = effects[i];
      nodes.push(effect);
    }
    return nodes;
  }

  getSourceMenuItems () {
    const sources = [
      OSCILLATOR_TYPE_AM,
      OSCILLATOR_TYPE_FAT,
      OSCILLATOR_TYPE_FM,
      OSCILLATOR_TYPE_OSC,
      OSCILLATOR_TYPE_PULSE,
      OSCILLATOR_TYPE_PWM,
      {
        value: NOISE_TYPE_PINK,
        text: 'Pink Noise'
      },
      {
        value: NOISE_TYPE_WHITE,
        text: 'White Noise'
      },
      {
        value: NOISE_TYPE_BROWN,
        text: 'Brown Noise'
      },
    ];
    let scratchSounds = this.getScratchSoundMenuItems();
    for (let i = 0; i < scratchSounds.length; i++) {
      const sound = scratchSounds[i];
      sources.push(sound);
    }
    return sources;
  }

  getPulseWidthMenuItems () {
    let values = [];
    for (let i = -9; i < 10; i++) {
      const value = (i * 0.1).toFixed(1);
      values.push(value);
    }
    return values;
  }

  getStopSourceMenuItems () {
    var items = this.getSourceMenuItems();
    if (items) {
      items.splice(0, 0, {
        value: SOURCE_TYPE_ALL,
        text: 'All Sounds',
      });
    }
    return items;
  }

  getVolumeMenuItems () {
    let values = [];
    for (let i = 0; i < 101; i++) {
      const value = (i * 0.5 - 25.0).toFixed(1);
      values.push(value);
    }
    return values;
  }

  getNoteSourceMenuItems () {
    return [
      OSCILLATOR_TYPE_AM,
      OSCILLATOR_TYPE_FAT,
      OSCILLATOR_TYPE_FM,
      OSCILLATOR_TYPE_OSC,
      OSCILLATOR_TYPE_PULSE,
      OSCILLATOR_TYPE_PWM,
    ];
  }

  getBinSizeMenuItems () {
    return [
      '16',
      '32',
      '64',
      '128',
      '256',
      '512',
      '1024'
    ];
  }

  getOscillatorMenuItems () {
    return [
      OSCILLATOR_TYPE_AM,
      OSCILLATOR_TYPE_FAT,
      OSCILLATOR_TYPE_FM,
      OSCILLATOR_TYPE_OSC,
      OSCILLATOR_TYPE_PULSE,
      OSCILLATOR_TYPE_PWM,
    ];
  }

  getLFOSignalMenuItems () {
    return [
      OSCILLATOR_TYPE_AM,
      OSCILLATOR_TYPE_FAT,
      OSCILLATOR_TYPE_FM,
      OSCILLATOR_TYPE_OSC,
      OSCILLATOR_TYPE_PULSE,
      OSCILLATOR_TYPE_PWM,
      LFO_SIGNAL_TYPE_PWM_MOD_FREQ,
      LFO_SIGNAL_TYPE_FILTER_Q,
      LFO_SIGNAL_TYPE_FILTER_FREQ,
    ];
  }

  getEffectMenuItems () {
    const effects = [
      {
        value: EFFECT_TYPE_AUTOFILTER,
        text: 'Auto Filter'
      },
      {
        value: EFFECT_TYPE_CHORUS,
        text: 'Chorus'
      },
      {
        value: EFFECT_TYPE_DISTORTION,
        text: 'Distortion'
      },
      {
        value: EFFECT_TYPE_FEEDBACKDELAY,
        text: 'Feedback Delay'
      },
      {
        value: EFFECT_TYPE_PINGPONGDELAY,
        text: 'PingPong Delay'
      },
      {
        value: EFFECT_TYPE_PHASER,
        text: 'Phaser'
      },
      {
        value: EFFECT_TYPE_PITCHSHIFT,
        text: 'Pitch Shift'
      },
      {
        value: EFFECT_TYPE_REVERB,
        text: 'Reverb'
      },
      {
        value: EFFECT_TYPE_VIBRATO,
        text: 'Vibrato'
      },
      {
        value: COMPONENT_TYPE_FILTER,
        text: 'Filter'
      },
      {
        value: COMPONENT_TYPE_AMPLITUDE_ENVELOPE,
        text: 'ADSR Envelope'
      },
    ];
    return effects;
  }

  getRemoveEffectMenuItems () {
    var effectItems = this.getEffectMenuItems();
    if (effectItems) {
      effectItems.push({
        value: EFFECT_TYPE_ALL,
        text: 'All Effects',
      });
    }
    return effectItems;
  }

  getScratchSoundMenuItems () {
    let sounds = [];
    const target = this.runtime.getEditingTarget();
    const sprite = target.sprite;
    if (sprite) {
      for (let i = 0; i < sprite.sounds.length; i++) {
        const sound = sprite.sounds[i];
        sounds.push('SOUND_' + sound.name);
      }
    }
    return sounds;
  }

  getNormalRangeMenuValues () {
    let vals = [];
    for (let i = 0; i < 21; i++) {
      const value = (i * 0.05).toFixed(2);
      vals.push(''+value);
    }
    return vals;
  }

  getQValues () {
    let vals = [];
    for (let i = 0; i < 201; i++) {
      const value = (i * 0.1).toFixed(1);
      vals.push(''+value);
    }
    return vals;
  }

  getLfoFreqAmount () {
    let freqs = [];
    for (let i = 0; i < 16; i++) {
      freqs.push(''+i);
    }
    return freqs;
  }

  getHarmonicityValues () {
    let values = [];
    for (let i = 0; i < 31; i++) {
      const value = (i * 0.1).toFixed(1);
      values.push(''+value);
    }
    return values;
  }

  getDelayTimeAmount () {
    let delayTimes = [];
    for (let i = 0; i < 41; i++) {
      delayTimes.push('' + i*0.05).toFixed(2);
    }
    return delayTimes;
  }

  addEffect (args, util) {
    console.log("add EFFECT: " + args.EFFECT);
    const synthState = this._getSynthState(util.target);
    const effectId = args.EFFECT + util.target.sprite.name;
    if (!synthState.effectMap || !synthState.effectMap.has(effectId)) {
      this._createEffect(args.EFFECT, util);
    }
  }

  removeEffect (args, util) {
    console.log("remove EFFECT: " + args.EFFECT);
    const synthState = this._getSynthState(util.target);
    const effectId = args.EFFECT + util.target.sprite.name;
    if (args.EFFECT === EFFECT_TYPE_ALL) {
      console.log("remove all effects");
      if (synthState.effectMap) {
        synthState.effectMap.forEach(this._removeEffectItem);
      }
    }
    if (synthState.effectMap && synthState.effectMap.has(effectId)) {
      const effect = synthState.effectMap.get(effectId);
      effect.disconnect();
      synthState.effectMap.delete(effectId);
      effect.dispose();
    }
  }

  _removeEffectItem(value, key, map) {
    console.log("removing " + key);
    const effect = value;
    effect.disconnect();
    map.delete(key);
    effect.dispose();
    console.log("effect map size: " + map.size);
  }

  disconnectLFO (args, util) {
    const synthState = this._getSynthState(util.target);
    if (synthState.lfo && synthState.sourceMap) {
      var sources = synthState.sourceMap.values().toArray();
      sources.forEach ((source) => {
        synthState.lfo.disconnect(source);
        source.dispose();
      });
      synthState.sourceMap.clear();
    }
  }

  _connectToOutput (sourceNode, util) {
    console.log("connectToOutput util.target.sprite.name: " + util.target.sprite.name);
    const synthState = this._getSynthState(util.target);
    var channel = null;
    var adsr = null;
    let channelId = util.target.sprite.name + '_channel';
    let adsrId = util.target.sprite.name + '_adsr';
    if (synthState.channelMap && synthState.channelMap.has(channelId)) {
      channel = synthState.channelMap.get(channelId);
    }
    else {
      channel = this._createChannel(util);
    }
    if (synthState.adsrMap && synthState.adsrMap.has(adsrId)) {
      adsr = synthState.adsrMap.get(adsrId);
    }
    else {
      adsr = this._createADSR(util);
    }
    if (synthState.effectMap && synthState.effectMap.size > 0 && channel && adsr) {
      sourceNode.disconnect();
      for (const effect of synthState.effectMap.values()) {
        sourceNode.connect(effect);
        effect.connect(adsr);
        adsr.connect(channel);
        channel.toDestination();
      }
    }
    else if (sourceNode && channel && adsr) {
      console.log('channel volume: ' + channel.volume.value);
      sourceNode.connect(adsr).start();
      adsr.connect(channel);
      channel.toDestination();
    }
  }

  connectLfoToSignal (args, util) {
    const synthState = this._getSynthState(util.target);
    const lfo = this._getLFO(util);
    var signalSource;
    var osc = null;
    var filter = null;
    switch (args.SIGNAL) {
      case LFO_SIGNAL_TYPE_FILTER_Q:
      case LFO_SIGNAL_TYPE_FILTER_FREQ:
        signalSource = COMPONENT_TYPE_FILTER;
        break;
      case LFO_SIGNAL_TYPE_PWM_MOD_FREQ:
        signalSource = OSCILLATOR_TYPE_PWM;
        break;
      default:
        signalSource = args.SIGNAL;
        break;
    }
    const signalId = signalSource + util.target.sprite.name;
    if (!synthState.sourceMap || !synthState.sourceMap.has(signalId)) {
      if (signalSource != COMPONENT_TYPE_FILTER) {
        this._createOscillator(signalSource, util);
        osc = this._getOscillator(signalSource, util);
      }
      else {
        this._createEffect(signalSource, util);
        filter = this._getEffect(signalSource, util);
      }
    }
    else if (synthState.sourceMap && synthState.sourceMap.has(signalId)) {
      if (signalSource != COMPONENT_TYPE_FILTER) {
        osc = this._getOscillator(signalSource, util);
      }
      else {
        filter = this._getEffect(signalSource, util);
      }
    }
    if (osc && lfo) {
      if (args.SIGNAL != LFO_SIGNAL_TYPE_PWM_MOD_FREQ) {
        lfo.connect(osc.frequency).start();
      }
      else if (args.SIGNAL === LFO_SIGNAL_TYPE_PWM_MOD_FREQ) {
        lfo.connect(osc.modulationFrequency).start();
      }
    }
    if (filter && lfo) {
      if (args.SIGNAL != LFO_SIGNAL_TYPE_FILTER_Q) {
        lfo.connect(filter.frequency).start();
      }
      else {
        lfo.connect(filter.Q).start();
      }
    }
  }

  setLfoMinMax (args, util) {
    const min = Cast.toNumber(args.MIN);
    const max = Cast.toNumber(args.MAX);
    const synthState = this._getSynthState(util.target);
    if (!synthState.lfo) {
      this._createOscillator(OSCILLATOR_TYPE_LFO, util);
    }
    const lfo = this._getLFO(util);
    if (lfo) {
      lfo.min = min;
      lfo.max = max;
    }
  }

  setDetune (args, util) {
    const detune = Cast.toNumber(args.DETUNE);
    const synthState = this._getSynthState(util.target);
    const oscId = args.OSC_TYPE + util.target.sprite.name;
    const osc = this._getOscillator(args.OSC_TYPE, util);
    if (osc) {
      osc.detune.value = detune;
    }
  }

  _nodeStartsStops(nodeName) {
    var startStops = false;
    if (nodeName.includes('Oscillator') || (nodeName.includes('OSC')) || (nodeName.includes('Osc'))) {
      startStops = true;
    }
    else if (nodeName.includes('pink') || nodeName.includes('white') || nodeName.includes('brown')) {
      startStops = true;
    }
    else if (nodeName.includes('SOUND')) {
      startStops = true;
    }
    else if (nodeName.includes('autoFilter') || nodeName.includes('chorus')) {
      startStops = true;
    }
    return startStops;
  }

  changeWaveForm (args, util) {
    const wave = args.WAVE;
    const source = args.SOURCE;
    this._setWaveForm(wave, source, util);
  }

  setHarmonicity (args, util) {
    const harmonicity = Cast.toNumber(args.HARMONICITY);
    const synthState = this._getSynthState(util.target);
    const osc = this._getOscillator(args.OSC_TYPE, util);
    if (osc) {
      osc.harmonicity.value = harmonicity;
    }
  }


  /* Arguments:
    EFFECT_PARAM: the parameter to set
    VALUE: the normal-range value
  */
  setNormalRangeEffect (args, util) {
    console.log("normal range effect: " + args.EFFECT_PARAM);
    console.log('normal range value: ' + args.VALUE)
    const value = Cast.toNumber(args.VALUE);
    const synthState = this._getSynthState(util.target);
    const effectType = args.EFFECT_TYPE;
    const parameter = args.EFFECT_PARAM;
    const effectId = effectType + util.target.sprite.name;
    if (synthState.effectMap && synthState.effectMap.has(effectId)) {
      const effect = synthState.effectMap.get(effectId);
      switch (parameter) {
        case NORMAL_EFFECT_WET:
          if (effect.wet) {
            effect.wet.value = value;
          }
          break;
        case NORMAL_EFFECT_DEPTH:
          if (effect.depth) {
            switch(effectType) {
              case EFFECT_TYPE_AUTOFILTER:
              case EFFECT_TYPE_VIBRATO:
                effect.depth.value = value;
                break;
              case EFFECT_TYPE_CHORUS:
                effect.depth = value;
                break;
              default:
                break;
            }
          }
          break;
        case 'distortion':
          if (effect.distortion) {
            effect.distortion = value;
          }
          break;
        default:
          break;
      }
    }
  }

  setSoundEffect (args, util) {
    const soundPlayer = this._getSoundPlayer(args.SOUND_SOURCE, util);
    const onOffState = (args.ON === 'on') ? true : false;
    if (soundPlayer) {
      switch (args.EFFECT) {
        case SOUND_EFFECT_REVERSE:
          soundPlayer.reverse = onOffState;
          break;
        case SOUND_EFFECT_MUTE:
          soundPlayer.mute = onOffState;
          break;
        default:
          break;
      }

    }
  }

  setFeedbackDelay (args, util) {
    const source = this._getEffect(args.SOURCE, util);
    const delayTime = Cast.toNumber(args.DELAY_TIME);
    const feedback = Cast.toNumber(args.FEEDBACK);
    if (source && source.delayTime) {
      source.delayTime.value = delayTime;
    }
    if (source && source.feedback) {
      source.feedback.value = feedback;
    }
  }

  setReverbDecay (args, util) {
    const reverb = this._getEffect(EFFECT_TYPE_REVERB, util);
    const decayTime = Cast.toNumber(args.DECAY_TIME);
    if (reverb && reverb.decay) {
      reverb.decay = decayTime;
    }
  }

setLfoFrequency (args, util) {
  var freq = Cast.toNumber(args.VALUE);
  freq = MathUtil.clamp(freq, 0, 100);
  const synthState = this._getSynthState(util.target);
  const effectId = args.EFFECT_TYPE + util.target.sprite.name;
  if (args.EFFECT_TYPE != OSCILLATOR_TYPE_LFO) {
    if (!synthState.effectMap) {
      synthState.effectMap = new Map();
    }
    if (!synthState.effectMap.has(effectId)) {
      this._createEffect(args.EFFECT_TYPE, util);
    }
    if (synthState.effectMap.has(effectId)) {
      const effect = synthState.effectMap.get(effectId);
      effect.frequency.value = freq;
    }
  }
  else {
    if (args.EFFECT_TYPE === OSCILLATOR_TYPE_LFO) {
      if (!synthState.lfo) {
        synthState.lfo = new Tone.LFO(freq);
      }
      else {
        synthState.lfo.frequency.value = freq;
      }
    }
  }
}

setDelayTime (args, util) {
  console.log("set delaytime for: " + args.EFFECT_TYPE);
  console.log('delay time: ' + args.DELAY_TIME);
  var delayTime = Cast.toNumber(args.DELAY_TIME);

  const synthState = this._getSynthState(util.target);
  const effectType = args.EFFECT_TYPE;
  const effectId = effectType + util.target.sprite.name;
  if (synthState.effectMap && synthState.effectMap.has(effectId)) {
    const effect = synthState.effectMap.get(effectId);
    if (effect && effect.delayTime) {
      effect.delayTime.value = delayTime;
    }
    else if (effect && effect.decay) {
      effect.decay = delayTime;
    }
  }
}

setPitchShiftInterval (args, util) {
  const interval = Cast.toNumber(args.PITCH_SHIFT);
  const synthState = this._getSynthState(util.target);
  const psId = EFFECT_TYPE_PITCHSHIFT + util.target.sprite.name;
  if (synthState.effectMap && synthState.effectMap.has(psId)) {
    const pitchShift = synthState.effectMap.get(psId);
    pitchShift.pitch = interval;
  }
}

setFilter (args, util) {
  const freq = Cast.toNumber(args.FREQ);
  const q = Cast.toNumber(args.FILTER_Q);
  const type = args.TYPE;
  const synthState = this._getSynthState(util.target);
  const filterId = COMPONENT_TYPE_FILTER + util.target.sprite.name;
  if (!synthState.effectMap || !synthState.effectMap.has(filterId)) {
    this._createEffect(COMPONENT_TYPE_FILTER, util);
  }
  if (synthState.effectMap && synthState.effectMap.has(filterId)) {
    const filter = synthState.effectMap.get(filterId);
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.value = freq;
  }
}

  setVolume (args, util) {
    var volume = Cast.toNumber(args.VOLUME);
    volume = MathUtil.clamp(volume, MIN_VOLUME, MAX_VOLUME);
    this._setVolume(volume, util);
  }

  changeVolume (args, util) {
    var volumeChange = Cast.toNumber(args.VOLUME_CHANGE);
    var volume = this.getVolume(args, util);
    volume = MathUtil.clamp(volume + volumeChange, MIN_VOLUME, MAX_VOLUME);
    this._setVolume(volume, util);
  }


  getVolume (args, util) {
    const synthState = this._getSynthState(util.target);
    return synthState.currentVolume;
  }

  setAttackRelease (args, util) {
    const synthState = this._getSynthState(util.target);
    const adsr = this._createADSR(util);
    var attack = Cast.toNumber(args.ATTACK);
    var release = Cast.toNumber(args.RELEASE);
    attack = MathUtil.clamp(attack, 0, 2);
    release = MathUtil.clamp(release, 0, 5);
    if (adsr) {
      adsr.attack = attack;
      adsr.release = release;
    }
  }

  playNote (args, util) {
    const synthState = this._getSynthState(util.target);
    const note = this._getNote(args.NOTE);
    const duration = Cast.toNumber(args.DURATION);
    switch (args.SOURCE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE, util);
        const adsr = this._createADSR(util);
        console.log("playbackState for " + args.SOURCE + ": " + osc.state);
        if (osc && osc.state != PLAYBACK_STATE_STARTED && adsr) {
          this._connectToOutput(osc, util);
          const stopTime = duration + 0.5;
          //osc.set({frequency: note}).start().stop("+"+stopTime+"");
          osc.set({frequency: note}).stop("+"+stopTime+"");//.disconnect();
          adsr.triggerAttackRelease(duration);
        }
        break;
      default:
        break;
    }
  }

  startSourceNote (args, util) {
    const synthState = this._getSynthState(util.target);
    const note = this._getNote(args.NOTE);
    const duration = Cast.toNumber(args.DURATION);
    switch (args.SOURCE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE, util);
        const adsr = this._createADSR(util);
        console.log("playbackState for " + args.SOURCE + ": " + osc.state);
        if (osc && osc.state === PLAYBACK_STATE_STARTED) {
          osc.stop();
        }
        if (osc && osc.state != PLAYBACK_STATE_STARTED && adsr) {
          this._connectToOutput(osc, util);
          osc.frequency.value =  note;
          console.log("note: " + note);
          console.log("osc.frequency: " + osc.frequency.value);
          console.log("osc.frequency.convert: " + osc.frequency.convert);
          //osc.start();
          adsr.triggerAttack();
        }
        break;
      default:
        break;
    }
  }

  startSourceSound (args, util) {
    const synthState = this._getSynthState(util.target);
    let node = null;
    const adsr = this._createADSR(util);
    switch (args.SOURCE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE, util);
        if (osc && osc.state === PLAYBACK_STATE_STARTED) {
          osc.stop();
        }
        if (osc && osc.state != PLAYBACK_STATE_STARTED) {
          node = osc;
        }
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        const noise = this._getNoise(args.SOURCE, util);
        if (noise && noise.state === PLAYBACK_STATE_STARTED) {
          noise.stop();
        }
        if (noise && noise.state != PLAYBACK_STATE_STARTED) {
          node = noise;
        }
        break;
      case OSCILLATOR_TYPE_LFO:
        const lfo = this._getLFO(util);
        if (lfo && lfo.state === PLAYBACK_STATE_STARTED) {
          lfo.stop();
        }
        if (lfo && lfo.state != PLAYBACK_STATE_STARTED) {
          node = lfo;
        }
        break;
      default:
        if (args.SOURCE.includes('SOUND_')) {
          const soundPlayer = this._getSoundPlayer(args.SOURCE, util);
          if (soundPlayer && soundPlayer.state === PLAYBACK_STATE_STARTED) {
            soundPlayer.stop();
          }
          if (adsr) {
            soundPlayer.fadeIn = adsr.attack;
          }
          node = soundPlayer;
          //node.start();
        }
        break;
    }
    if (node && node.state != PLAYBACK_STATE_STARTED && adsr) {
      this._connectToOutput(node, util);
      adsr.triggerAttack();
    }
  }

  getSoundLength (args, util) {
    const soundPlayer = this._getSoundPlayer(args.SOUND_SOURCE, util);
    if (soundPlayer) {
      return soundPlayer.buffer.duration;
    }
    return 0;
  }

  setPulseWidth (args, util) {
    const synthState = this._getSynthState(util.target);
    const osc = this._getOscillator(OSCILLATOR_TYPE_PULSE, util);
    const width = MathUtil.clamp(Cast.toNumber(args.WIDTH), -0.9, 0.9);
    osc.width.value = width;
  }

  setPWMModFrequency (args, util) {
    const freq = Cast.toNumber(args.FREQUENCY);
    const synthState = this._getSynthState(util.target);
    const osc = this._getOscillator(OSCILLATOR_TYPE_PWM, util);
    if (osc) {
      osc.modulationFrequency.value = freq;
    }
  }

  stopSourceSound(args, util) {
    const synthState = this._getSynthState(util.target);
    const adsr = this._createADSR(util);
    switch (args.SOURCE_TYPE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE_TYPE, util);
        if (osc && adsr) {
          adsr.triggerRelease();
          osc.stop("+"+adsr.release+"");//.disconnect();
        }
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        const noise = this._getNoise(args.SOURCE_TYPE, util);
        if (noise && adsr) {
          adsr.triggerRelease();
          noise.stop("+"+adsr.release+"");//.disconnect();
        }
        break;
      case SOURCE_TYPE_ALL:
        this._stopAllSounds(args, util);
        break;
      default:
        if (args.SOURCE_TYPE.includes('SOUND_')) {
          const soundPlayer = this._getSoundPlayer(args.SOURCE_TYPE, util);
          if (adsr) {
            soundPlayer.fadeOut = adsr.release;
            adsr.triggerRelease();
            soundPlayer.stop("+"+adsr.release+"");//.disconnect();
          }

        }
        break;
    }
  }

  _stopAllSounds (args, util) {
    const synthState = this._getSynthState(util.target);
    const adsr = this._createADSR(util);
    if (synthState.sourceMap) {
      let sourceIterator = synthState.sourceMap.keys();
      for (let i = 0; i < synthState.sourceMap.size; i++) {
        var node = null;
        let sourceKey = sourceIterator.next();
        let sourceName = sourceKey.value;
        console.log("sourceName: " + sourceName);
        node = synthState.sourceMap.get(sourceKey.value);
        if (node && this._nodeStartsStops(sourceName) && adsr) {
          const releaseTime = adsr.release;
          console.log("stopping " + sourceName);
          if (sourceName.includes("SOUND_")) {
             node.fadeOut = releaseTime;
          }
          adsr.triggerRelease();
          node.stop("+"+adsr.release+"");//.disconnect();
        }
        else if (node && sourceName.includes("Synth")) {
          console.log('stopping ' + sourceName);
          node.triggerRelease();
          node.stop("+"+adsr.release+"");//.disconnect();
        }
      }
    }
  }

  _createOscillator (oscillatorType, util) {
    const synthState = this._getSynthState(util.target);
    var osc = null;
    let oscId = oscillatorType + util.target.sprite.name;
    switch (oscillatorType) {
      case OSCILLATOR_TYPE_AM:
        osc = new Tone.AMOscillator({detune: 0});
        break;
      case OSCILLATOR_TYPE_FAT:
        osc = new Tone.FatOscillator({detune: 0});
        break;
      case OSCILLATOR_TYPE_FM:
        osc = new Tone.FMOscillator({detune: 0});
        break;
      case OSCILLATOR_TYPE_OSC:
        osc = new Tone.Oscillator({detune: 0});
        break;
      case OSCILLATOR_TYPE_PULSE:
        osc = new Tone.PulseOscillator({detune: 0});
        break;
      case OSCILLATOR_TYPE_PWM:
        osc = new Tone.PWMOscillator({detune: 0});
        break;
      case OSCILLATOR_TYPE_LFO:
        osc = new Tone.LFO(3, 50, 700);
        osc.amplitude.value = 1;
        synthState.lfo = osc;
        break;
      default:
        break;
    }
    if (osc && oscillatorType != OSCILLATOR_TYPE_LFO) {
      if (!synthState.sourceMap) {
        synthState.sourceMap = new Map();
      }
      synthState.sourceMap.set(oscId, osc);
    }
    return osc;
  }

  _createNoise (noiseType, util) {
    const synthState = this._getSynthState(util.target);
    var noise = null;
    let noiseId = noiseType + util.target.sprite.name;
    switch (noiseType) {
      case NOISE_TYPE_PINK:
        noise = new Tone.Noise({type: noiseType});
        break;
      case NOISE_TYPE_WHITE:
        noise = new Tone.Noise({type: noiseType});
        break;
      case NOISE_TYPE_BROWN:
        noise = new Tone.Noise({type: noiseType});
        break;
      default:
        break;
    }
    if (noise) {
      if (!synthState.sourcesMap) {
        synthState.sourceMap = new Map();
      }
      synthState.sourceMap.set(noiseId, noise);
    }
    return noise;
  }

  _createEffect (effectType, util) {
    const synthState = this._getSynthState(util.target);
    let effectId = effectType + util.target.sprite.name;
    if (!synthState.effectMap) {
      synthState.effectMap = new Map();
    }
    switch (effectType) {
      case EFFECT_TYPE_AUTOFILTER:
        if (!synthState.effectMap.has(effectId)) {
          const autoFilter = new Tone.AutoFilter(10, ).start();//.toDestination();
          synthState.effectMap.set(effectId, autoFilter);
        }
        break;
      case EFFECT_TYPE_CHORUS:
        if (!synthState.effectMap.has(effectId)) {
          const chorus = new Tone.Chorus().start();//.toDestination();
          synthState.effectMap.set(effectId, chorus);
        }
        break;
      case EFFECT_TYPE_DISTORTION:
        if (!synthState.effectMap.has(effectId)) {
          const distortion = new Tone.Distortion();//.toDestination();
          synthState.effectMap.set(effectId, distortion);
        }
        break;
      case EFFECT_TYPE_FEEDBACKDELAY:
        if (!synthState.effectMap.has(effectId)) {
          const feedbackDelay = new Tone.FeedbackDelay(0.5, 0.5);//.toDestination();
          synthState.effectMap.set(effectId, feedbackDelay);
        }
        break;
      case EFFECT_TYPE_PINGPONGDELAY:
        if (!synthState.effectMap.has(effectId)) {
          const pingpongDelay = new Tone.PingPongDelay(0.5, 0.5);//.toDestination();
          synthState.effectMap.set(effectId, pingpongDelay);
        }
        break;
      case EFFECT_TYPE_PHASER:
        if (!synthState.effectMap.has(effectId)) {
          const phaser = new Tone.Phaser();//.toDestination();
          synthState.effectMap.set(effectId, phaser);
        }
        break;
      case EFFECT_TYPE_PITCHSHIFT:
        if (!synthState.effectMap.has(effectId)) {
          const pitchShift = new Tone.PitchShift();//.toDestination();
          synthState.effectMap.set(effectId, pitchShift);
        }
        break;
      case EFFECT_TYPE_REVERB:
        if (!synthState.effectMap.has(effectId)) {
          const reverb = new Tone.Reverb(0.5);//.toDestination();
          synthState.effectMap.set(effectId, reverb);
        }
        break;
      case EFFECT_TYPE_VIBRATO:
        if (!synthState.effectMap.has(effectId)) {
          const vibrato = new Tone.Vibrato();//.toDestination();
          synthState.effectMap.set(effectId, vibrato);
        }
        break;
      case COMPONENT_TYPE_FILTER:
        if (!synthState.effectMap.has(effectId)) {
          const filter = new Tone.Filter(1500, "highpass");//.toDestination();
          synthState.effectMap.set(effectId, filter);
        }
        break;
      default:
        break;
    }
  }

  _createFFT (util) {
    const synthState = this._getSynthState(util.target);
    const fftId = COMPONENT_TYPE_FFT+util.target.sprite.name;
    if (!synthState.effectMap) {
      synthState.effectMap = new Map();
    }
    if (synthState.effectMap && synthState.effectMap.has(fftId)) {
      return synthState.effectMap.get(fftId);
    }
    else {
      //const fft = new Tone.FFT(COMPONENT_BIN_SIZE);
      const fft = new Tone.FFT(synthState.binSize);
      synthState.effectMap.set(fftId, fft);
      return fft;
    }
  }

  _createWaveform (util) {
    const synthState = this._getSynthState(util.target);
    const waveformId = COMPONENT_TYPE_WAVEFORM+util.target.sprite.name;
    if (!synthState.effectMap) {
      synthState.effectMap = new Map();
    }
    if (synthState.effectMap && synthState.effectMap.has(waveformId)) {
      return synthState.effectMap.get(waveformId);
    }
    else {
      //const waveform = new Tone.Waveform(COMPONENT_BIN_SIZE);
      const waveform = new Tone.Waveform(synthState.binSize);
      synthState.effectMap.set(waveformId, waveform);
      return waveform;
    }
  }

  _createADSR (util) {
    const synthState = this._getSynthState(util.target);
    const adsrId = COMPONENT_TYPE_AMPLITUDE_ENVELOPE+util.target.sprite.name;
    if (!synthState.adsrMap) {
      synthState.adsrMap = new Map();
    }
    if (synthState.adsrMap && synthState.adsrMap.has(adsrId)) {
      return synthState.adsrMap.get(adsrId);
    }
    else {
      const adsr = new Tone.AmplitudeEnvelope({
        attack: 0.01,
        decay: 0.2,
        sustain: 1.0,
        release: 0.9});
      synthState.adsrMap.set(adsrId, adsr).set("attack", 0.01).set("release",0.9);
      return adsr;
    }
  }

  _getSoundPlayer (soundType, util) {
    var player = null;
    var synthState = this._getSynthState(util.target);
    const soundId = soundType+util.target.sprite.name;
    if (synthState && !synthState.sourceMap) {
      synthState.sourceMap = new Map();
    }
    if (synthState && synthState.sourceMap) {
      if (synthState.sourceMap.has(soundId)) {
        player = synthState.sourceMap.get(soundId);
      }
      else {
        const sprite = util.target.sprite;
        const soundName = soundType.slice(6); //start at index 6 : SOUND_
        const sound = sprite.sounds.find((element) => element.name === soundName);
        const soundPlayer = sprite.soundBank.getSoundPlayer(sound.soundId);
        const effects = util.runtime.audioEngine.createEffectChain();
        player = new Tone.Player(soundPlayer.buffer);
        synthState.sourceMap.set(soundId, player);
      }
    }
    return player;
  }

  _getFFT(util) {
    let fft;
    var synthState = this._getSynthState(util.target);
    const fftId = COMPONENT_TYPE_FFT+util.target.sprite.name;
    if (synthState && synthState.effectMap && synthState.effectMap.has(fftId)) {
      fft = synthState.effectMap.get(fftId);
    }
    else {
      fft = this._createFFT(util);
    }
    return fft;
  }

  _getWaveform(util) {
    let waveform;
    var synthState = this._getSynthState(util.target);
    const waveformId = COMPONENT_TYPE_WAVEFORM+util.target.sprite.name;
    if (synthState && synthState.effectMap && synthState.effectMap.has(waveformId)) {
      waveform = synthState.effectMap.get(waveformId);
    }
    else {
      waveform = this._createWaveform(util);
    }
    return waveform;
  }

  _createChannel (util) {
    const synthState = this._getSynthState(util.target);
    const channelId = util.target.sprite.name + '_channel';
    var channel = null;
    if (!synthState.channelMap) {
      synthState.channelMap = new Map();
    }
    if (synthState.channelMap && !synthState.channelMap.has(channelId)) {
      channel = new Tone.Channel(0);
      synthState.channelMap.set(channelId, channel);
    }
    else if (synthState.channelMap && synthState.channelMap.has(channelId)) {
      channel = synthState.channelMap.get(channelId);
    }
    return channel;
  }

  setBinSize (args, util) {
    const size = Cast.toNumber(args.BIN_SIZE);
    const synthState = this._getSynthState(util.target);
    const waveForm = this._getWaveform(util);
    const fft = this._getFFT(util);
    synthState.binSize = size;
    if (waveForm) {
      waveForm.size = size;
    }
    if (fft) {
      fft.size = size;
    }
  }

  connectFFT (args, util) {
    let source;
    const fft = this._getFFT(util);
    switch (args.SOURCE_TYPE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        source = this._getOscillator(args.SOURCE_TYPE, util);
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        source = this._getNoise(args.SOURCE_TYPE, util);
        break;
      default:
        source = this._getSoundPlayer(args.SOURCE_TYPE, util);
        break;
    }
    if (source && fft) {
      source.connect(fft);
    }
  }

  getFFT (args, util) {
    const fft = this._getFFT(util);
    if (fft) {
      console.log("source fft value: " + fft.getValue());
      return fft.getValue();
    }
    else {
      return [];
    }
  }

  getFFTValueAtIndex (args, util) {
    const index = Cast.toNumber(args.INDEX);
    const fft = this._getFFT(util);
    if (fft && fft.getValue().length > index) {
      const values = fft.getValue();
      return values[index];
    }
    else {
      return 0;
    }
  }

  getFftSize (args, util) {
    const fft = this._getFFT(util);
    return fft.size;
  }

  connectWaveform (args, util) {
    let source;
    const waveform = this._getWaveform(util);
    switch (args.SOURCE_TYPE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        source = this._getOscillator(args.SOURCE_TYPE, util);
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        source = this._getNoise(args.SOURCE_TYPE, util);
        break;
      default:
        source = this._getSoundPlayer(args.SOURCE_TYPE, util);
        break;
    }
    if (source && waveform) {
      source.connect(waveform);
    }
  }

  getWaveform (args, util) {
    const waveform = this._getWaveform(util);
    if (waveform) {
      console.log("source waveform value: " + waveform.getValue());
      return waveform.getValue();
    }
    else {
      return [];
    }
  }

  getWaveformValueAtIndex (args, util) {
    const index = Cast.toNumber(args.INDEX);
    const waveform = this._getWaveform(util);
    if (waveform && waveform.getValue().length > index) {
      const values = waveform.getValue();
      return values[index];
    }
    else {
      return 0;
    }
  }

  getWaveformSize (args, util) {
    const waveform = this._getWaveform(util);
    return waveform.size;
  }

  glide (args, util) {
    const start_note = this._getNote(args.START_NOTE);
    const end_note = this._getNote(args.END_NOTE);
    const seconds = Cast.toNumber(args.SECONDS);
    const duration = "+"+seconds+"";
    const synthState = this._getSynthState(util.target);
    const osc = this._getOscillator(args.OSC_TYPE, util);
    if (osc) {
      this._connectToOutput(osc, util);
    }
    if (osc && osc.state != PLAYBACK_STATE_STARTED) {
      osc.set({frequency:start_note});
      osc.start().stop(duration);//.disconnect();
      osc.frequency.exponentialRampTo(end_note, seconds);
    }
  }

  getOscillatorSource (args, util) {
    return 'oscillator';
  }

  getModOscillatorSource (args, util) {
    return 'modOscillator';
  }

  getNoiseSource (args, util) {
    return args.NOISE_TYPE;
  }

  getSoundSource (args, util) {
    return 'sound';
  }

  getLFOSource (args, util) {
    return 'LFO';
  }

  getOutput (args, util) {
    let gain;
    const synthState = this._getSynthState(util.target);
    const gainId = COMPONENT_TYPE_GAIN + util.target.sprite.name;
    if (!synthState.sourceMap) {
      synthState.sourceMap = new Map();
    }
    if (synthState.sourceMap && synthState.sourceMap.has(gainId)) {
      gain = synthState.sourceMap.get(gainId);
    }
    else {
      gain = new Tone.Gain(0);
      synthState.sourceMap.set(gainId, gain);
    }
    return COMPONENT_TYPE_GAIN;
  }

  _getSource (sourceType, util) {
    var source = null;
    const synthState = this._getSynthState(util.target);
    switch (sourceType) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        source = this._getOscillator(sourceType, util);
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        source = this._getNoise(sourceType, util);
        break;
      default:
        if (sourceType.includes('SOUND_')) {
          source = this._getSoundPlayer(sourceType, util);
        }
        break;
    }
    return source;
  }

  _getDestination (destinationType, util) {
    var destination = null;
    const synthState = this._getSynthState(util.target);
    switch (destinationType) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        source = this._getOscillator(sourceType, util);
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        source = this._getNoise(sourceType, util);
        break;
      default:
        if (sourceType.includes('SOUND_')) {
          source = this._getSoundPlayer(sourceType, util);
        }
        break;
    }
    return source;
  }

  _getEffect (effectType, util) {
    var effect = null;
    let effectId = effectType + util.target.sprite.name;
    const synthState = this._getSynthState(util.target);
    if (synthState.effectMap && synthState.effectMap.has(effectId)) {
      console.log('effectMap has ' + effectId);
      effect = synthState.effectMap.get(effectId);
    }
    else {
      console.log('creating ' + effectId);
      effect = this._createEffect(effectType, util);
    }
    return effect;
  }

  _getOscillator(oscType, util) {
    var osc = null;
    if (oscType.includes('Osc') || oscType.includes('OSC') || oscType === OSCILLATOR_TYPE_LFO) {
      const synthState = this._getSynthState(util.target);
      let oscId = oscType + util.target.sprite.name;
      if (synthState.sourceMap && synthState.sourceMap.has(oscId)) {
        osc = synthState.sourceMap.get(oscId);
        osc.detune.value = 0;
      }
      else {
        osc = this._createOscillator(oscType, util);
      }
    }
    return osc;
  }

  _getNoise(noiseType, util) {
    var noise = null;
    let noiseId = noiseType + util.target.sprite.name;
    const synthState = this._getSynthState(util.target);
    if (synthState.sourceMap && synthState.sourceMap.has(noiseId)) {
      noise = synthState.sourceMap.get(noiseId);
    }
    else {
      noise = this._createNoise(noiseType, util);
    }
    return noise;
  }

  _getLFO(util) {
    var lfo = null;
    const synthState = this._getSynthState(util.target);
    if (synthState.lfo) {
      lfo = synthState.lfo;
    }
    else {
      lfo = this._createOscillator(OSCILLATOR_TYPE_LFO, util);//new Tone.LFO();
      synthState.lfo = lfo;
    }
    return lfo;
  }

  _setNoise(noiseType, util) {
    const synthState = this._getSynthState(util.target);
    switch (noiseType) {
      case NOISE_TYPE_PINK:
        if (!synthState.pinkNoise) {
          const noise = new Tone.Noise({type: noiseType});//.toDestination();
          synthState.pinkNoise = noise;
        }
        break;
      case NOISE_TYPE_WHITE:
        if (!synthState.whiteNoise) {
          const noise = new Tone.Noise({type: noiseType});//.toDestination();
          synthState.whiteNoise = noise;
        }
        break;
      case NOISE_TYPE_BROWN:
        if (!synthState.brownNoise) {
          const noise = new Tone.Noise({type: noiseType});//.toDestination();
          synthState.brownNoise = noise;
        }
        break;
      default:
        break;
    }
  }

  /**
   * Internal code to select a synth waveform.
   * @param {string} waveForm - the synth waveform type.
   * @param {object} util - utility object provided by the runtime.
   */
  _setWaveForm (waveForm, source, util) {
    const synthState = this._getSynthState(util.target);
    var sourceId;
    if (source.includes('AM')) {
      sourceId = OSCILLATOR_TYPE_AM+util.target.sprite.name;
    }
    else if (source.includes('FM')) {
      sourceId = OSCILLATOR_TYPE_FM+util.target.sprite.name;
    }
    else {
      sourceId = source+util.target.sprite.name;
    }
    if (synthState.sourceMap) {
      var osc = null;
      switch (source) {
        case OSCILLATOR_TYPE_FAT:
        case OSCILLATOR_TYPE_OSC:
        case OSCILLATOR_TYPE_LFO:
          if (synthState.sourceMap.has(sourceId) ) {
            osc = synthState.sourceMap.get(sourceId);
            osc.set({type:waveForm});
          }
          break;
        case OSCILLATOR_TYPE_AM_BASE:
        case OSCILLATOR_TYPE_FM_BASE:
          if (synthState.sourceMap.has(sourceId) ) {
            osc = synthState.sourceMap.get(sourceId)
            osc.set({baseType:waveForm});
          }
        case OSCILLATOR_TYPE_AM_MOD:
        case OSCILLATOR_TYPE_FM_MOD:
          if (synthState.sourceMap.has(sourceId) ) {
            osc = synthState.sourceMap.get(sourceId)
            osc.set({modulationType:waveForm});
          }
          break;
        default:
          break;
      }
    }
  }

  _setVolume (volume, util) {
    const synthState = this._getSynthState(util.target);
    const channelId = util.target.sprite.name + '_channel';
    const adjVolume = (volume * 0.2) - 14;
    console.log('channelId: ' + channelId);
    console.log('adjVolume: ' + adjVolume);
    if (!synthState.channelMap || !synthState.channelMap.has(channelId)) {
      synthState.channelMap = new Map();
      this._createChannel(util);
    }
    if (synthState.channelMap && synthState.channelMap.has(channelId)) {
      const channel = synthState.channelMap.get(channelId);
      channel.set({'volume':adjVolume});
      if (volume > 0) {
        channel.mute = false;
      }
      else {
        channel.mute = true;
      }
      synthState.currentVolume = volume;
      console.log('channel volume set: ' + channel.volume.value);
      console.log('channel mute: ' + channel.mute);
    }
  }

  _getPWMModFrequencies () {
    return ['0.5','1.0','1.5','2.0','2.5','3.0','3.5','4.0','4.5',
    '5.0','5.5','6.0','6.5','7.0','7.5','8.0','8.5','9.0','9.5','10.0'];
  }

  _findKeyByValue(map, value) {
    for (let [key, val] of map.entries()) {
      if (val === value) {
        return key;
      }
    }
    return null;
  }

}

module.exports = Scratch3ToneSynth;
