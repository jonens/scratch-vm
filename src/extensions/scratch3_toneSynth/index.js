const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const TargetType = require('../../extension-support/target-type');
const Cast = require('../../util/cast');
const Clone = require('../../util/clone');
const MathUtil = require('../../util/math-util');
const Tone = require('../../../node_modules/tone/build/esm/index.js');
const Clock = require('../../io/clock');
const SOURCE_TYPE_SYNTH = 'SynthSource';
const SOURCE_TYPE_OSCILLATOR = 'OscillatorSource';
const SOURCE_TYPE_NOISE = 'NoiseSource';
const SOURCE_TYPE_DUO_SYNTH = 'DuoSynthSource';
const SOURCE_TYPE_METAL_SYNTH = 'MetalSynthSource';
const SYNTH_TYPE_SYNTH = 'Synth';
const SYNTH_TYPE_AM = 'AM Synth';
const SYNTH_TYPE_DUO = 'Duo Synth';
const SYNTH_TYPE_FM = 'FM Synth';
const SYNTH_TYPE_MEMBRANE = 'Membrane Synth';
const SYNTH_TYPE_METAL = 'Metal Synth';
const SYNTH_TYPE_NOISE = 'Noise Synth';
const SYNTH_TYPE_POLY = 'Poly Synth';
const NOISE_TYPE_PINK = 'pink';
const NOISE_TYPE_WHITE = 'white';
const NOISE_TYPE_BROWN = 'brown';
const OSCILLATOR_TYPE_AM = 'AM Oscillator';
const OSCILLATOR_TYPE_FAT = 'Fat Oscillator';
const OSCILLATOR_TYPE_FM = 'FM Oscillator';
const OSCILLATOR_TYPE_OSC = 'Oscillator';
const OSCILLATOR_TYPE_PWM = 'PWM Oscillator';
const OSCILLATOR_TYPE_PULSE = 'Pulse Oscillator';
const OSCILLATOR_TYPE_LFO = 'LFO';
const EFFECT_TYPE_AUTOFILTER = 'autoFilter';
const EFFECT_TYPE_AUTOWAH = 'autoWah';
const EFFECT_TYPE_BITCRUSHER = 'bitCrusher';
const EFFECT_TYPE_CHEBYSHEV = 'chebyshev';
const EFFECT_TYPE_CHORUS = 'chorus';
const EFFECT_TYPE_DISTORTION = 'distortion';
const EFFECT_TYPE_FEEDBACKDELAY = 'feedbackDelay';
const EFFECT_TYPE_PINGPONGDELAY = 'pingpongDelay';
const EFFECT_TYPE_PHASER = 'phaser';
const EFFECT_TYPE_PITCHSHIFT = 'pitchShift';
const EFFECT_TYPE_REVERB = 'reverb';
const EFFECT_TYPE_TREMOLO = 'tremolo';
const EFFECT_TYPE_VIBRATO = 'vibrato';
const FILTER_TYPE_LOW_PASS = "lowpass";
const FILTER_TYPE_HIGH_PASS = "highpass";
const FILTER_TYPE_BAND_PASS =	"bandpass";
const FILTER_TYPE_NOTCH =	"notch";
const NORMAL_EFFECT_WET = 'wet';
const NORMAL_EFFECT_DEPTH = 'depth';
const NORMAL_EFFECT_DISTORTION = 'distortion';
const NORMAL_EFFECT_FEEDBACK = 'feedback';
const LFO_EFFECT_FREQ = 'lfoFrequency';
const LFO_EFFECT_Q = 'lfoQ';
const COMPONENT_TYPE_AMPLITUDE_ENVELOPE = 'amplitudeEnvelope';
const COMPONENT_TYPE_FILTER = 'filter';
const MIN_VOLUME = 0;
const MAX_VOLUME = 150;
const MAX_POLYPHONY = 30;
const PLAYBACK_STATE_STARTED = "started";
const PLAYBACK_STATE_STOPPED = "stopped";

class Scratch3ToneSynth {
  constructor (runtime) {
    this.runtime = runtime;
    this._onTargetCreated = this._onTargetCreated.bind(this);
    this.runtime.on('targetWasCreated', this._onTargetCreated);
    this.clock = new Clock(runtime);
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
          currentVolume: 75,
          playerMap: null,
          effectNodeMap: null,
          nodeMap: null,
          lfo: null,
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
          opcode: 'connectNodeToEffect',
          blockType: BlockType.COMMAND,
          text: '[SOURCE_NODE] to [EFFECT]',
          arguments: {
            SOURCE_NODE: {
              type: ArgumentType.STRING,
              menu: 'nodeToEffectMenu'
            },
            EFFECT: {
              type: ArgumentType.STRING,
              menu: 'effectMenu'
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'connectToOutput',
          blockType: BlockType.COMMAND,
          text: '[SOURCE_NODE] to output',
          arguments: {
            SOURCE_NODE: {
              type: ArgumentType.STRING,
              menu: 'outputNodeMenu'
            },
          },
          filter: [TargetType.SPRITE]
        },
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
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'setLfoMin',
          blockType: BlockType.COMMAND,
          text: 'LFO min: [MIN] (0-4000)',
          arguments: {
            MIN: {
              type: ArgumentType.NUMBER,
              defaultValue: 50
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'setLfoMax',
          blockType: BlockType.COMMAND,
          text: 'LFO max: [MAX] (0-4000)',
          arguments: {
            MAX: {
              type: ArgumentType.NUMBER,
              defaultValue: 700
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'disconnectNode',
          blockType: BlockType.COMMAND,
          text: 'Disconnect [NODE]',
          arguments: {
            NODE: {
              type: ArgumentType.STRING,
              menu: 'disconnectNodeMenu'
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'playNote',
          blockType: BlockType.COMMAND,
          text: 'Play [SOURCE] Note: [NOTE] for: [DURATION] seconds',
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
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'startSourceNote',
          blockType: BlockType.COMMAND,
          text: 'Start [SOURCE] Note: [NOTE]',
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
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'startSourceSound',
          blockType: BlockType.COMMAND,
          text: 'Start [SOURCE]',
          arguments: {
            SOURCE: {
              type: ArgumentType.STRING,
              menu: 'sourceTypeMenu'
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'stopSourceSound',
          blockType: BlockType.COMMAND,
          text: 'Stop [SOURCE_TYPE]',
          arguments: {
            SOURCE_TYPE: {
              type: ArgumentType.STRING,
              menu: 'sourceTypeMenu'
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'stopAllSounds',
          blockType: BlockType.COMMAND,
          text: 'Stop all sounds',
        },
        {
          opcode: 'changeVolume',
          blockType: BlockType.COMMAND,
          text: 'Volume: [VOLUME] %',
          arguments: {
            VOLUME: {
              type: ArgumentType.NUMBER,
              defaultValue: 75
            }
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'changeWaveForm',
          blockType: BlockType.COMMAND,
          text: 'Waveform [WAVE] : [SOURCE]',
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
          filter: [TargetType.SPRITE]
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
              type: ArgumentType.STRING,
              menu: 'normalEffectValueMenu',
            }
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'setLfoRangeEffect',
          blockType: BlockType.COMMAND,
          text: '[EFFECT_TYPE] [EFFECT_PARAM] : [VALUE] (1-15)',
          arguments: {
            EFFECT_TYPE: {
              type: ArgumentType.STRING,
              menu: 'lfoFreqSourceMenu',
            },
            EFFECT_PARAM: {
              type: ArgumentType.STRING,
              menu: 'lfoEffectParamMenu'
            },
            VALUE: {
              type: ArgumentType.STRING,
              menu: 'lfoFreqMenu',
            }
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'setDelayTime',
          blockType: BlockType.COMMAND,
          text: '[EFFECT_TYPE] Delay: [DELAY_TIME] (0-20)',
          arguments: {
            EFFECT_TYPE: {
              type: ArgumentType.STRING,
              menu: 'delaySourceMenu',
            },
            DELAY_TIME: {
              type: ArgumentType.STRING,
              menu: 'delayTimeMenu'
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'setChebyshevOrder',
          blockType: BlockType.COMMAND,
          text: 'Chebyshev Order: [ORDER] (1-100)',
          arguments: {
            ORDER: {
              type: ArgumentType.NUMBER,
              defaultValue: 1,
            },
          },
          filter: [TargetType.SPRITE]
        },
        {
          opcode: 'setPitchShiftInterval',
          blockType: BlockType.COMMAND,
          text: 'Pitch Shift: [PITCH_SHIFT]',
          arguments: {
            PITCH_SHIFT: {
              type: ArgumentType.NUMBER,
              defaultValue: 0,
            },
          },
          filter: [TargetType.SPRITE]
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
          filter: [TargetType.SPRITE]
        },
      ],
      menus: {
        outputNodeMenu:  'getOutputNodeMenuItems',
        disconnectNodeMenu:  'getDisconnectNodeMenuItems',
        nodeToEffectMenu: 'getNodeToEffectMenuItems',
        lfoToSignalMenu: 'getOscillatorMenuItems',
        soundMenu: 'getScratchSoundMenuItems',
        noteSourceTypeMenu: 'getNoteSourceMenuItems',
        sourceTypeMenu: 'getSourceMenuItems',
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
            SYNTH_TYPE_AM,
            SYNTH_TYPE_DUO,
            SYNTH_TYPE_FM,
            SYNTH_TYPE_MEMBRANE,
            SYNTH_TYPE_SYNTH,
            OSCILLATOR_TYPE_AM,
            OSCILLATOR_TYPE_FAT,
            OSCILLATOR_TYPE_FM,
            OSCILLATOR_TYPE_OSC,
          ]
        },
        normalEffectParamMenu: {
          items: [
             NORMAL_EFFECT_WET,
             NORMAL_EFFECT_DEPTH,
             NORMAL_EFFECT_DISTORTION,
             NORMAL_EFFECT_FEEDBACK,
          ]
        },
        normalEffectValueMenu: {
          acceptReporters: true,
          items: 'getNormalRangeMenuValues',
        },
        lfoFreqSourceMenu: {
          items: [
            OSCILLATOR_TYPE_LFO,
            EFFECT_TYPE_AUTOFILTER,
            EFFECT_TYPE_AUTOWAH,
            EFFECT_TYPE_CHORUS,
            EFFECT_TYPE_PHASER,
            EFFECT_TYPE_TREMOLO,
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
        wetEffectParameterMenu: {
          items: [
            EFFECT_TYPE_AUTOFILTER,
            EFFECT_TYPE_BITCRUSHER,
            EFFECT_TYPE_CHEBYSHEV,
            EFFECT_TYPE_CHORUS,
            EFFECT_TYPE_DISTORTION,
            EFFECT_TYPE_FEEDBACKDELAY,
            EFFECT_TYPE_PINGPONGDELAY,
            EFFECT_TYPE_REVERB,
            EFFECT_TYPE_TREMOLO,
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

  getOutputNodeMenuItems () {
    let outputs = [];
    let sources = this.getSourceMenuItems();
    let effects = this.getEffectMenuItems();
    for (let i = 0; i < sources.length; i++) {
      let source = sources[i];
      outputs.push(source);
    }
    for (let i=0; i < effects.length; i++) {
      let effect = effects[i];
      outputs.push(effect);
    }
    return outputs;
  }

  getDisconnectNodeMenuItems () {
    let nodes = this.getOutputNodeMenuItems();
    nodes.push(OSCILLATOR_TYPE_LFO);
    return nodes;
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

  getSourceMenuItems () {
    const sources = [
      SYNTH_TYPE_AM,
      SYNTH_TYPE_DUO,
      SYNTH_TYPE_FM,
      SYNTH_TYPE_MEMBRANE,
      SYNTH_TYPE_METAL,
      SYNTH_TYPE_SYNTH,
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

  getNoteSourceMenuItems () {
    return [
      SYNTH_TYPE_AM,
      SYNTH_TYPE_DUO,
      SYNTH_TYPE_FM,
      SYNTH_TYPE_MEMBRANE,
      SYNTH_TYPE_METAL,
      SYNTH_TYPE_SYNTH,
      OSCILLATOR_TYPE_AM,
      OSCILLATOR_TYPE_FAT,
      OSCILLATOR_TYPE_FM,
      OSCILLATOR_TYPE_OSC,
      OSCILLATOR_TYPE_PULSE,
      OSCILLATOR_TYPE_PWM,
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

  getEffectMenuItems () {
    const effects = [
      {
        value: EFFECT_TYPE_AUTOFILTER,
        text: 'Auto Filter'
      },
      {
        value: EFFECT_TYPE_AUTOWAH,
        text: 'Auto Wah'
      },
      {
        value: EFFECT_TYPE_BITCRUSHER,
        text: 'BitCrusher'
      },
      {
        value: EFFECT_TYPE_CHEBYSHEV,
        text: 'Chebychev'
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
        value: EFFECT_TYPE_TREMOLO,
        text: 'Tremolo'
      },
      {
        value: EFFECT_TYPE_VIBRATO,
        text: 'Vibrato'
      },
    ];
    return effects;
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

  getLfoFreqAmount () {
    let freqs = [];
    for (let i = 0; i < 15; i++) {
      freqs.push(''+i);
    }
    return freqs;
  }

  getDelayTimeAmount () {
    let delayTimes = [];
    for (let i = 0; i < 20; i++) {
      delayTimes.push(''+i);
    }
    return delayTimes;
  }

  connectNodeToEffect (args, util) {
    console.log("EFFECT: " + args.EFFECT);
    console.log("SOURCE: " + args.SOURCE_NODE);
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    const sourceId = args.SOURCE_NODE + util.target.sprite.name;
    const effectId = args.EFFECT + util.target.sprite.name;
    if (!synthState.nodeMap || !synthState.nodeMap.has(effectId)) {
      this._createEffect(args.EFFECT, util);
    }
    const source = this._getSource(args.SOURCE_NODE, util);
    const effect = this._getEffect(args.EFFECT, util);
    if (source && effect) {
      source.connect(effect);
    }
  }

  connectToOutput (args, util) {
    console.log("connectToOutput util.target.sprite.name: " + util.target.sprite.name);
    var node = null;
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    let nodeId = args.SOURCE_NODE + util.target.sprite.name;
    if (synthState.nodeMap && synthState.nodeMap.has(nodeId)) {
      node = synthState.nodeMap.get(nodeId);
      node.toDestination();
    }
    else {
      node = this._createOutputNode(args.SOURCE_NODE, util);
      if (node) {
        node.toDestination();
      }
    }
  }

  connectLfoToSignal (args, util) {
    const synthState = this._getSynthState(util.target);
    const lfoId = OSCILLATOR_TYPE_LFO + util.target.sprite.name;
    const signalId = args.SIGNAL + util.target.sprite.name;
    if (!synthState.nodeMap || !synthState.nodeMap.has(signalId)) {
      this._createOscillator(args.SIGNAL, util);
    }
    if (!synthState.nodeMap.has(lfoId)) {
      this._createOscillator(OSCILLATOR_TYPE_LFO, util);
    }
    const osc = this._getOscillator(args.SIGNAL, util);
    const lfo = this._getOscillator(OSCILLATOR_TYPE_LFO, util);
    if (osc && lfo) {
      lfo.connect(osc.frequency).start();
    }
  }

  setLfoMin (args, util) {
    const min = Cast.toNumber(args.MIN);
    //if (!Number.isNaN(min) && !isNaN(min)) {
    //  const util = {
    //      runtime: this.runtime,
    //      target: this.runtime.getEditingTarget()
    //  };
    const synthState = this._getSynthState(util.target);
    const lfoId = OSCILLATOR_TYPE_LFO + util.target.sprite.name;
    if (!synthState.nodeMap || !synthState.nodeMap.has(lfoId)) {
      this._createOscillator(OSCILLATOR_TYPE_LFO, util);
    }
    const lfo = this._getOscillator(OSCILLATOR_TYPE_LFO, util);
    if (lfo) {
      lfo.min = min;
    }
    //}
  }

  setLfoMax (args, util) {
    const max = Cast.toNumber(args.MAX);
    //if (!Number.isNaN(max) && !isNaN(max)) {
    //  const util = {
    //      runtime: this.runtime,
    //      target: this.runtime.getEditingTarget()
    //  };
    const synthState = this._getSynthState(util.target);
    const lfoId = OSCILLATOR_TYPE_LFO + util.target.sprite.name;
    if (!synthState.nodeMap || !synthState.nodeMap.has(lfoId)) {
      this._createOscillator(OSCILLATOR_TYPE_LFO, util);
    }
    const lfo = this._getOscillator(OSCILLATOR_TYPE_LFO, util);
    if (lfo) {
      lfo.max = max;
    }
    //}
  }

  disconnectNode (args, util) {
    console.log("Disconnect NODE: " + args.NODE);
    this.stopAllSounds();
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    let nodeId = args.NODE + util.target.sprite.name;
    if (synthState.nodeMap && synthState.nodeMap.has(nodeId)) {
      const node = synthState.nodeMap.get(nodeId);
      console.log("NODE: " + args.NODE);
      if (this._nodeStartsStops(args.NODE)) {
        node.stop();
      }
      node.disconnect();
    }
  }

  _nodeStartsStops(nodeName) {
    var startStops = false;
    if (nodeName.includes('Oscillator')) {
      startStops = true;
    }
    else if (nodeName.includes('pink') || nodeName.includes('white') || nodeName.includes('brown')) {
      startStops = true;
    }
    else if (nodeName.includes('autoFilter') || nodeName.includes('chorus') || nodeName.includes('tremolo')) {
      startStops = true;
    }
    return startStops;
  }

  changeWaveForm (args, util) {
    const wave = args.WAVE;
    const source = args.SOURCE;
    this._setWaveForm(wave, source, util);
  }

  /* Arguments:
    EFFECT_PARAM: the parameter to set
    VALUE: the normal-range value
  */
  setNormalRangeEffect (args, util) {
    console.log("normal range effect: " + args.EFFECT_PARAM);
    console.log('normal range value: ' + args.VALUE)
    const value = Cast.toNumber(args.VALUE);
    //if (!Number.isNaN(value) && !isNaN(value)) {
    //  const util = {
    //      runtime: this.runtime,
    //      target: this.runtime.getEditingTarget()
    //  };
    const synthState = this._getSynthState(util.target);
    const effectType = args.EFFECT_TYPE;
    const parameter = args.EFFECT_PARAM;
    const effectId = effectType + util.target.sprite.name;
    if (synthState.nodeMap && synthState.nodeMap.has(effectId)) {
      const effect = synthState.nodeMap.get(effectId);
      switch (parameter) {
        case 'wet':
          if (effect.wet) {
            effect.wet.value = value;
          }
          break;
        case 'depth':
          if (effect.depth) {
            effect.depth = value;
          }
          break;
        case 'distortion':
          if (effect.distortion) {
            effect.distortion = value;
          }
          break;
        case 'feedback':
          if (effect.feedback) {
            effect.feedback.value = value;
          }
          break;
        default:
          break;
      }
    }
    //}
  }

setLfoRangeEffect (args, util) {
  console.log("lfo range effect: " + args.EFFECT_PARAM);
  console.log('lfo range value: ' + args.VALUE)
  const value = Cast.toNumber(args.VALUE);
  //if (!Number.isNaN(value) && !isNaN(value)) {
  //const util = {
  //    runtime: this.runtime,
  //    target: this.runtime.getEditingTarget()
  //};
  const synthState = this._getSynthState(util.target);
  const effectType = args.EFFECT_TYPE;
  const parameter = args.EFFECT_PARAM;
  const effectId = effectType + util.target.sprite.name;
  if (synthState.nodeMap && synthState.nodeMap.has(effectId)) {
    const effect = synthState.nodeMap.get(effectId);
    switch (parameter) {
      case LFO_EFFECT_FREQ:
        if (effect.frequency) {
          effect.frequency.value = value;
        }
        break;
      case LFO_EFFECT_Q:
        if (effect.depth) {
          effect.q.value = value;
        }
        break;
      default:
        break;
    }
  }
  //}
}

setDelayTime (args, util) {
  console.log("set delaytime for: " + args.EFFECT_TYPE);
  console.log('delay time: ' + args.DELAY_TIME);
  const delayTime = Cast.toNumber(args.DELAY_TIME);
  //if (!Number.isNaN(delayTime) && !isNaN(delayTime)) {
  //const util = {
  //    runtime: this.runtime,
  //    target: this.runtime.getEditingTarget()
  //};
  const synthState = this._getSynthState(util.target);
  const effectType = args.EFFECT_TYPE;
  const effectId = effectType + util.target.sprite.name;
  if (synthState.nodeMap && synthState.nodeMap.has(effectId)) {
    const effect = synthState.nodeMap.get(effectType);
    if (effect.delayTime) {
      effect.delayTime = Number(args.DELAY_TIME);
    }
    if (effect.decay) {
      effect.decay = Number(args.DELAY_TIME);
    }
  }
  //}
}

setChebyshevOrder (args, util) {
  var order = Math.round(Cast.toNumber(args.ORDER));
  //if (!Number.isNaN(order) && !isNaN(order)) {
  if (order < 1) order = 1;
  if (order > 100) order = 100;
  if (order > 0) {
  //  const util = {
  //      runtime: this.runtime,
  //      target: this.runtime.getEditingTarget()
  //  };
    const synthState = this._getSynthState(util.target);
    const chebyId = EFFECT_TYPE_CHEBYSHEV + util.target.sprite.name;
    if (synthState.nodeMap && synthState.nodeMap.has(chebyId)) {
      const chebyshev = synthState.nodeMap.get(chebyId);
      chebyshev.order = order;
    }
  }
  //}
}

setPitchShiftInterval (args, util) {
  const interval = Cast.toNumber(args.PITCH_SHIFT);//.toFixed(1);
  //if (!Number.isNaN(order) && !isNaN(order)) {
  //  const util = {
  //      runtime: this.runtime,
  //      target: this.runtime.getEditingTarget()
  //  };
  const synthState = this._getSynthState(util.target);
  const psId = EFFECT_TYPE_PITCHSHIFT + util.target.sprite.name;
  if (synthState.nodeMap && synthState.nodeMap.has(psId)) {
    const pitchShift = synthState.nodeMap.get(psId);
    pitchShift.pitch = interval;
  }
//  }
}

  changeVolume (args, util) {
    var volume = Cast.toNumber(args.VOLUME);
    //if (!Number.isNaN(volume) && !isNaN(volume)) {
    volume = MathUtil.clamp(volume, MIN_VOLUME, MAX_VOLUME);
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    this._setVolume(volume, util);
    //}
  }

  playNote (args, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    const note = this._getNote(args.NOTE);
    const duration = Cast.toNumber(args.DURATION);
    switch (args.SOURCE) {
      case SYNTH_TYPE_AM:
      case SYNTH_TYPE_FM:
      case SYNTH_TYPE_MEMBRANE:
      case SYNTH_TYPE_SYNTH:
        const synth = this._getSynth(args.SOURCE, util);
        console.log("playbackState for " + args.SOURCE + " oscillator: " + synth.oscillator.state);
        if (synth && synth.oscillator.state != PLAYBACK_STATE_STARTED) {
          synth.volume.value = synthState.currentVolume * 0.56 - 50;
          if (args.SOURCE === SYNTH_TYPE_MEMBRANE) {
            synth.octaves = 0.5;
          }
          synth.triggerAttackRelease(note, duration);
        }
        break;
      case SYNTH_TYPE_DUO:
        const duoSynth = this._getSynth(args.SOURCE, util);
        console.log("playbackState for " + args.SOURCE + " oscillator0: " + duoSynth.voice0.oscillator.state);
        console.log("playbackState for " + args.SOURCE + " oscillator1: " + duoSynth.voice1.oscillator.state);
        if (duoSynth &&
          duoSynth.voice0.oscillator.state != PLAYBACK_STATE_STARTED &&
          duoSynth.voice1.oscillator.state != PLAYBACK_STATE_STARTED) {
          duoSynth.voice0.volume.value = synthState.currentVolume * 0.56 - 55;
          duoSynth.voice1.volume.value = synthState.currentVolume * 0.56 - 50;
          console.log('duoSynth.detune: ' + duoSynth.harmonicity.value);
          duoSynth.triggerAttackRelease(note, duration);
        }
        break;
      case SYNTH_TYPE_METAL:
        const metalSynth = this._getSynth(args.SOURCE, util);
        metalSynth.volume.value = synthState.currentVolume * 0.56 - 50;
        console.log("metalSynth envelope value (1): " + metalSynth.envelope.value);
        if (metalSynth.envelope.value === 0) {
          metalSynth.triggerAttack(note);
          console.log("metalSynth envelope value (2): " + metalSynth.envelope.value);
        }
        break;
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE, util);
        console.log("playbackState for " + args.SOURCE + ": " + osc.state);
        if (osc && osc.state != PLAYBACK_STATE_STARTED) {
          osc.volume.value = synthState.currentVolume * 0.56 - 50;
          osc.set({frequency: note}).start().stop("+"+duration+"");
        }
        break;
      default:
        break;
    }
  }

  startSourceNote (args, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    const note = this._getNote(args.NOTE);
    const duration = Cast.toNumber(args.DURATION);
    switch (args.SOURCE) {
      case SYNTH_TYPE_AM:
      case SYNTH_TYPE_FM:
      case SYNTH_TYPE_MEMBRANE:
      case SYNTH_TYPE_SYNTH:
        const synth = this._getSynth(args.SOURCE, util);
        if (synth && synth.oscillator.state != PLAYBACK_STATE_STARTED) {
          synth.volume.value = synthState.currentVolume * 0.56 - 50;
          synth.triggerAttack(note);
        }
        break;
      case SYNTH_TYPE_DUO:
        const duoSynth = this._getSynth(args.SOURCE, util);
        if (duoSynth &&
          duoSynth.voice0.oscillator.state != PLAYBACK_STATE_STARTED &&
          duoSynth.voice1.oscillator.state != PLAYBACK_STATE_STARTED) {
          duoSynth.voice0.volume.value = synthState.currentVolume * 0.56 - 55;
          duoSynth.voice1.volume.value = synthState.currentVolume * 0.56 - 50;
          duoSynth.triggerAttack(note);
        }
        break;
      case SYNTH_TYPE_METAL:
        const metalSynth = this._getSynth(args.SOURCE, util);
        metalSynth.volume.value = synthState.currentVolume * 0.56 - 50;
        if (metalSynth.envelope.value === 0) {
          metalSynth.triggerAttack(note);
        }
        break;
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE, util);
        if (osc && osc.state != PLAYBACK_STATE_STARTED) {
          osc.volume.value = synthState.currentVolume * 0.56 - 50;
          osc.set({frequency: note}).start();
        }
        break;
      default:
        break;
    }
  }

  startSourceSound (args, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    switch (args.SOURCE) {
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE, util);
        if (osc && osc.state != PLAYBACK_STATE_STARTED) {
          osc.volume.value = synthState.currentVolume * 0.56 - 50;
          osc.start();
        }
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        const noise = this._getNoise(args.SOURCE, util);
        if (noise && noise.state != PLAYBACK_STATE_STARTED) {
          noise.volume.value = synthState.currentVolume * 0.56 - 50;
          noise.start();
        }
        break;
      case OSCILLATOR_TYPE_LFO:
        const lfo = this._getLFO(args.SOURCE, util);
        if (lfo && lfo.state != PLAYBACK_STATE_STARTED) {
          lfo.start();
        }
        break;
      default:
        if (args.SOURCE.includes('SOUND_')) {
          const soundPlayer = this._getSoundPlayer(args.SOURCE, util);
          soundPlayer.start();
        }
        break;
    }
  }

  stopSourceSound(args, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    switch (args.SOURCE_TYPE) {
      case SYNTH_TYPE_AM:
      case SYNTH_TYPE_DUO:
      case SYNTH_TYPE_FM:
      case SYNTH_TYPE_MEMBRANE:
      case SYNTH_TYPE_METAL:
      case SYNTH_TYPE_SYNTH:
        const synth = this._getSynth(args.SOURCE_TYPE, util);
        if (synth) {
          synth.triggerRelease();
          if (synth.oscillator) {
            synth.oscillator.stop();
          }
          if (synth.voice0 && synth.voice1) {
            synth.voice0.oscillator.stop();
            synth.voice1.oscillator.stop();
          }

        }
        break;
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        const osc = this._getOscillator(args.SOURCE_TYPE, util);
        if (osc) {
          osc.stop();
        }
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        const noise = this._getNoise(args.SOURCE_TYPE, util);
        if (noise) {
          noise.stop();
        }
        break;
      default:
        if (args.SOURCE_TYPE.includes('SOUND_')) {
          const soundPlayer = this._getSoundPlayer(args.SOURCE_TYPE, util);
          soundPlayer.stop();
        }
        break;
    }
  }

  stopAllSounds () {
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    if (synthState.nodeMap) {
      let sourceIterator = synthState.nodeMap.keys();
      for (let i = 0; i < synthState.nodeMap.size; i++) {
        var node = null;
        let sourceKey = sourceIterator.next();
        let sourceName = sourceKey.value;
        console.log("sourceName: " + sourceName);
        node = synthState.nodeMap.get(sourceKey.value);
        if (this._nodeStartsStops(sourceName)) {
          console.log("stopping " + sourceName);
          node.stop();
        }
        else if (sourceName.includes("Synth")) {
          console.log('stopping ' + sourceName);
          node.triggerRelease();
        }
      }
    }
  }

  _createSynth (synthType, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    var synth = null;
    let synthId = synthType + util.target.sprite.name;
    switch(synthType) {
      case SYNTH_TYPE_AM:
        synth = new Tone.AMSynth();
        break;
      case SYNTH_TYPE_DUO:
        synth = new Tone.DuoSynth();
        break;
      case SYNTH_TYPE_FM:
        synth = new Tone.FMSynth();
        break;
      case SYNTH_TYPE_MEMBRANE:
        synth = new Tone.MembraneSynth();
        break;
      case SYNTH_TYPE_METAL:
        synth = new Tone.MetalSynth();
        break;
      case SYNTH_TYPE_SYNTH:
        synth = new Tone.Synth();
        break;
      default:
        break;
    }
    if (synth) {
      synth.set({maxPolyphony: MAX_POLYPHONY});
      if (!synthState.nodeMap) {
        synthState.nodeMap = new Map();
      }
      synthState.nodeMap.set(synthId, synth);
      console.log('created ' + synthId);
      console.log('nodeMap.size: ' + synthState.nodeMap.size);
    }
    return synth;
  }

  _createOscillator (oscillatorType, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    var osc = null;
    let oscId = oscillatorType + util.target.sprite.name;
    switch (oscillatorType) {
      case OSCILLATOR_TYPE_AM:
        osc = new Tone.AMOscillator();
        break;
      case OSCILLATOR_TYPE_FAT:
        osc = new Tone.FatOscillator();
        break;
      case OSCILLATOR_TYPE_FM:
        osc = new Tone.FMOscillator();
        break;
      case OSCILLATOR_TYPE_OSC:
        osc = new Tone.Oscillator();
        break;
      case OSCILLATOR_TYPE_PULSE:
        osc = new Tone.PulseOscillator();
        break;
      case OSCILLATOR_TYPE_PWM:
        osc = new Tone.PWMOscillator();
        break;
      case OSCILLATOR_TYPE_LFO:
        osc = new Tone.LFO(500, 20, 4000);
        osc.amplitude.value = 1;
        break;
      default:
        break;
    }
    if (osc) {
      if (!synthState.nodeMap) {
        synthState.nodeMap = new Map();
      }
      synthState.nodeMap.set(oscId, osc);
    }
    return osc;
  }

  _createNoise (noiseType, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
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
      if (!synthState.nodeMap) {
        synthState.nodeMap = new Map();
      }
      synthState.nodeMap.set(noiseId, noise);
    }
    return noise;
  }

  _createEffect (effectType, util) {
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    let effectId = effectType + util.target.sprite.name;
    if (!synthState.nodeMap) {
      synthState.nodeMap = new Map();
    }
    switch (effectType) {
      case EFFECT_TYPE_AUTOFILTER:
        if (!synthState.nodeMap.has(effectId)) {
          const autoFilter = new Tone.AutoFilter(10, ).start();//.toDestination();
          synthState.nodeMap.set(effectId, autoFilter);
        }
        break;
      case EFFECT_TYPE_AUTOWAH:
        if (!synthState.nodeMap.has(effectId)) {
          const autoWah = new Tone.AutoWah(50, 6, -30);//.toDestination();
          synthState.nodeMap.set(effectId, autoWah);
        }
        break;
      case EFFECT_TYPE_BITCRUSHER:
        if (!synthState.nodeMap.has(effectId)) {
          const bitCrusher = new Tone.BitCrusher(8);//.toDestination();
          synthState.nodeMap.set(effectId, bitCrusher);
        }
        break;
      case EFFECT_TYPE_CHEBYSHEV:
        if (!synthState.nodeMap.has(effectId)) {
          const chebyshev = new Tone.Chebyshev(50);//.toDestination();
          synthState.nodeMap.set(effectId, chebyshev);
        }
        break;
      case EFFECT_TYPE_CHORUS:
        if (!synthState.nodeMap.has(effectId)) {
          const chorus = new Tone.Chorus().start();//.toDestination();
          synthState.nodeMap.set(effectId, chorus);
        }
        break;
      case EFFECT_TYPE_DISTORTION:
        if (!synthState.nodeMap.has(effectId)) {
          const distortion = new Tone.Distortion();//.toDestination();
          synthState.nodeMap.set(effectId, distortion);
        }
        break;
      case EFFECT_TYPE_FEEDBACKDELAY:
        if (!synthState.nodeMap.has(effectId)) {
          const feedbackDelay = new Tone.FeedbackDelay();//.toDestination();
          synthState.nodeMap.set(effectId, feedbackDelay);
        }
        break;
      case EFFECT_TYPE_PINGPONGDELAY:
        if (!synthState.nodeMap.has(effectId)) {
          const pingpongDelay = new Tone.PingPongDelay();//.toDestination();
          synthState.nodeMap.set(effectId, pingpongDelay);
        }
        break;
      case EFFECT_TYPE_PHASER:
        if (!synthState.nodeMap.has(effectId)) {
          const phaser = new Tone.Phaser();//.toDestination();
          synthState.nodeMap.set(effectId, phaser);
        }
        break;
      case EFFECT_TYPE_PITCHSHIFT:
        if (!synthState.nodeMap.has(effectId)) {
          const pitchShift = new Tone.PitchShift();//.toDestination();
          synthState.nodeMap.set(effectId, pitchShift);
        }
        break;
      case EFFECT_TYPE_REVERB:
        if (!synthState.nodeMap.has(effectId)) {
          const reverb = new Tone.Reverb();//.toDestination();
          synthState.nodeMap.set(effectId, reverb);
        }
        break;
      case EFFECT_TYPE_TREMOLO:
        if (!synthState.nodeMap.has(effectId)) {
          const tremolo = new Tone.Tremolo().start();//.toDestination();
          synthState.nodeMap.set(effectId, tremolo);
        }
        break;
      case EFFECT_TYPE_VIBRATO:
        if (!synthState.nodeMap.has(effectId)) {
          const vibrato = new Tone.Vibrato();//.toDestination();
          synthState.nodeMap.set(effectId, vibrato);
        }
        break;
      default:
        break;
    }
  }

  _getSoundPlayer (soundType, util) {
    var player = null;
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    var synthState = this._getSynthState(util.target);
    if (synthState && !synthState.nodeMap) {
      synthState.nodeMap = new Map();
    }
    if (synthState && synthState.nodeMap) {
      if (synthState.nodeMap.has(soundType)) {
        player = synthState.nodeMap.get(soundType);
      }
      else {
        const sprite = util.target.sprite;
        const soundName = soundType.slice(6); //start at index 6 : SOUND_
        const soundId = soundType+sprite.name;
        const sound = sprite.sounds.find((element) => element.name === soundName);
        const soundPlayer = sprite.soundBank.getSoundPlayer(sound.soundId);
        player = new Tone.Player(soundPlayer.buffer);
        synthState.nodeMap.set(soundId, player);
      }
    }
    return player;
  }

  _createOutputNode (nodeType, util) {
    switch (nodeType) {
      case SYNTH_TYPE_AM:
      case SYNTH_TYPE_DUO:
      case SYNTH_TYPE_FM:
      case SYNTH_TYPE_MEMBRANE:
      case SYNTH_TYPE_METAL:
      case SYNTH_TYPE_SYNTH:
        return this._createSynth(nodeType, util);
        break;
      case OSCILLATOR_TYPE_AM:
      case OSCILLATOR_TYPE_FAT:
      case OSCILLATOR_TYPE_FM:
      case OSCILLATOR_TYPE_OSC:
      case OSCILLATOR_TYPE_PULSE:
      case OSCILLATOR_TYPE_PWM:
        return this._createOscillator(nodeType, util);
        break;
      case NOISE_TYPE_PINK:
      case NOISE_TYPE_WHITE:
      case NOISE_TYPE_BROWN:
        return this._createNoise(nodeType, util);
        break;
      case EFFECT_TYPE_AUTOFILTER:
      case EFFECT_TYPE_AUTOWAH:
      case EFFECT_TYPE_BITCRUSHER:
      case EFFECT_TYPE_CHEBYSHEV:
      case EFFECT_TYPE_CHORUS:
      case EFFECT_TYPE_DISTORTION:
      case EFFECT_TYPE_FEEDBACKDELAY:
      case EFFECT_TYPE_PINGPONGDELAY:
      case EFFECT_TYPE_PHASER:
      case EFFECT_TYPE_PITCHSHIFT:
      case EFFECT_TYPE_REVERB:
      case EFFECT_TYPE_TREMOLO:
      case EFFECT_TYPE_VIBRATO:
      return this._createEffect(nodeType, util);
        break;
      default:
        return this._getSoundPlayer(nodeType, util);
        break;
    }
  }

  glide (args, util) {
    const start_note = this._getNote(args.START_NOTE);
    const end_note = this._getNote(args.END_NOTE);
    const seconds = Cast.toNumber(args.SECONDS);
    const duration = "+"+seconds+"";
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    var synthState = this._getSynthState(util.target);
    const osc = this._getOscillator(args.OSC_TYPE, util);
    if (osc && osc.state != PLAYBACK_STATE_STARTED) {
      osc.set({frequency:start_note, volume: synthState.currentVolume});
      osc.start().stop(duration);
      osc.frequency.exponentialRampTo(end_note, seconds);
    }
  }

  _getSource (sourceType, util) {
    var source = null;
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    switch (sourceType) {
      case SYNTH_TYPE_AM:
      case SYNTH_TYPE_DUO:
      case SYNTH_TYPE_FM:
      case SYNTH_TYPE_MEMBRANE:
      case SYNTH_TYPE_METAL:
      case SYNTH_TYPE_SYNTH:
        source = this._getSynth(sourceType, util);
        break;
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
    //const util = {
    //    runtime: this.runtime,
    //    target: this.runtime.getEditingTarget()
    //};
    let effectId = effectType + util.target.sprite.name;
    const synthState = this._getSynthState(util.target);
    if (synthState.nodeMap && synthState.nodeMap.has(effectId)) {
      console.log('nodeMap has ' + effectId);
      effect = synthState.nodeMap.get(effectId);
    }
    else {
      console.log('creating ' + effectId);
      synth = this._createEffect(effectType, util);
    }
    return effect;
  }

  _getSynth(synthType, util) {
    var synth = null;
    let synthState = this._getSynthState(util.target);
    let synthId = synthType + util.target.getName();
    console.log('getting ' + synthId);
    if (synthState.nodeMap && synthState.nodeMap.has(synthId)) {
      console.log('nodeMap has ' + synthId);
      synth = synthState.nodeMap.get(synthId);
    }
    else {
      console.log('creating ' + synthId);
      synth = this._createSynth(synthType, util);
    }
    return synth;
  }

  _getOscillator(oscType, util) {
    var osc = null;
    if (oscType.includes('Osc') || oscType === OSCILLATOR_TYPE_LFO) {
      const synthState = this._getSynthState(util.target);
      let oscId = oscType + util.target.sprite.name;
      if (synthState.nodeMap && synthState.nodeMap.has(oscId)) {
        osc = synthState.nodeMap.get(oscId);
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
    if (synthState.nodeMap && synthState.nodeMap.has(noiseId)) {
      noise = synthState.nodeMap.get(noiseId);
    }
    else {
      noise = this._createNoise(noiseType, util);
    }
    return noise;
  }

  _getLFO(sourceType, util) {
    var lfo = null;
    let lfoId = sourceType + util.target.sprite.name;
    if (synthState.nodeMap && synthState.nodeMap.has(lfoId)) {
      lfo = synthState.nodeMap.get(lfoId);
    }
    else {
      lfo = new Tone.LFO();
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
    //const util = {
    //  runtime: this.runtime,
    //  target: this.runtime.getEditingTarget()
    //};
    const synthState = this._getSynthState(util.target);
    const sourceId = source+util.target.sprite.name;
    if (synthState.nodeMap) {
      var synth = null;
      var duoSynth = null;
      var osc = null;
      switch (source) {
        case SYNTH_TYPE_AM:
        case SYNTH_TYPE_FM:
        case SYNTH_TYPE_MEMBRANE:
        case SYNTH_TYPE_SYNTH:
          if (synthState.nodeMap.has(sourceId) ) {
            synth = synthState.nodeMap.get(sourceId)
          }
          break;
        case SYNTH_TYPE_DUO:
          if (synthState.nodeMap.has(sourceId) ) {
            duoSynth = synthState.nodeMap.get(sourceId)
          }
          break;
        case OSCILLATOR_TYPE_AM:
        case OSCILLATOR_TYPE_FAT:
        case OSCILLATOR_TYPE_FM:
        case OSCILLATOR_TYPE_OSC:
          if (synthState.nodeMap.has(sourceId) ) {
            osc = synthState.nodeMap.get(sourceId)
          }
          break;
        default:
          break;
      }
    }
    if (synth) {
      synth.set({oscillator:{type:waveForm}});
    }
    if (duoSynth) {
      const synth0 = duoSynth.voice0;
      const synth1 = duoSynth.voice1;
      synth0.set({oscillator:{type:waveForm}});
      synth1.set({oscillator:{type:waveForm}});
    }
    if (osc) {
      osc.set({type:waveForm});
    }
  }

  _setVolume (volume, util) {
    //if (!Number.isNaN(volume) && !isNaN(volume)) {
      const synthState = this._getSynthState(util.target);
      synthState.currentVolume = volume;//  * 0.56 - 50;
    //}
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
