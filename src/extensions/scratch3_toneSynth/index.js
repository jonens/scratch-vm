const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const TargetType = require('../../extension-support/target-type');
const Cast = require('../../util/cast');
const Clone = require('../../util/clone');
const MathUtil = require('../../util/math-util');
//const Midi = require('../../../node_modules/jzz/javascript/JZZ.js');
const Tone = require('../../../node_modules/tone/build/esm/index.js');
//const WebMidi = require('../../../node_modules/webmidi/dist/esm/webmidi.esm.js');
//const WebMidi = "../../../node_modules/webmidi/dist/esm/webmidi.esm.min.js";

const SYNTH_TYPE_SYNTH = 'Synth';
const SYNTH_TYPE_AM = 'AMSynth';
const SYNTH_TYPE_DUO = 'DuoSynth';
const SYNTH_TYPE_FM = 'FMSynth';
const SYNTH_TYPE_MEMBRANE = 'MembraneSynth';
const SYNTH_TYPE_METAL = 'MetalSynth';
const SYNTH_TYPE_NOISE = 'NoiseSynth';
const SYNTH_TYPE_PLUCK = 'PluckSynth';
const SYNTH_TYPE_POLY = 'PolySynth';
const NOISE_TYPE_PINK = 'pink';
const NOISE_TYPE_WHITE = 'white';
const NOISE_TYPE_BROWN = 'brown';
const OSCILLATOR_TYPE_AM = 'am';
const OSCILLATOR_TYPE_FAT = 'fat';
const OSCILLATOR_TYPE_FM = 'fm';
const OSCILLATOR_TYPE_OSC = 'osc';
const OSCILLATOR_TYPE_PWM = 'pwm';
const OSCILLATOR_TYPE_PULSE = 'pulse';
const EFFECT_TYPE_AUTOFILTER = 'autoFilter';
const EFFECT_TYPE_AUTOWAH = 'autoWah';
const EFFECT_TYPE_BITCRUSHER = 'bitCrusher';
const EFFECT_TYPE_CHORUS = 'chorus';
const EFFECT_TYPE_DISTORTION = 'autoFilter';
const EFFECT_TYPE_FEEDBACKDELAY = 'feedbackDelay';
const EFFECT_TYPE_PHASER = 'phaser';
const EFFECT_TYPE_REVERB = 'reverb';
const EFFECT_TYPE_TREMOLO = 'tremolo';
const EFFECT_TYPE_VIBRATO = 'vibrato';
const FILTER_TYPE_LOW_PASS = "lowpass";
const FILTER_TYPE_HIGH_PASS = "highpass";
const FILTER_TYPE_BAND_PASS =	"bandpass";
const FILTER_TYPE_NOTCH =	"notch";
const COMPONENT_TYPE_AAMPLITUDEENVELOPE = 'amplitudeEnvelope';
const COMPONENT_TYPE_COMPRESSOR = 'compressor';
const COMPONENT_TYPE_FEEDBACKCOMBFILTER = 'feedbackCombFilter';
const COMPONENT_TYPE_FILTER = 'filter';
const COMPONENT_TYPE_FREQUENCYENVELOPE = 'frequencyEnvelope';
const COMPONENT_TYPE_LOWPASSCOMBFILTER = 'lowPassCombFilter';
const COMPONENT_TYPE_ONEPOLEFILTER = 'onePoleFilter';
const COMPONENT_TYPE_PHASER = 'phaser';
const COMPONENT_TYPE_REVERB = 'reverb';
const COMPONENT_TYPE_TREMOLO = 'tremolo';
const COMPONENT_TYPE_VIBRATO = 'vibrato';
const MIN_VOLUME = 0;
const MAX_VOLUME = 150;

class Scratch3ToneSynth {
  constructor (runtime) {
    this.runtime = runtime;
    this._onTargetCreated = this._onTargetCreated.bind(this);
    this.runtime.on('targetWasCreated', this._onTargetCreated);
    //this.synth = new Tone.PolySynth();
    this.audioNodeMap = new Map();
    this.webMidi = null;
    this.midiInputs = ["Select MIDI Input"];
    this.midiInput = null;
    this.midiNoteOn = "";
    this.midiNoteOff = "";
    import('webmidi').then((webMidiModule) => {
      this.webMidi = webMidiModule.WebMidi;
      this.webMidi.enable().then(this._onMidiEnabled());

    })
  }

  _onMidiEnabled() {
    console.log("midi enabled");
    this.midiInputs = [];
    this.webMidi.inputs.forEach(input => {
      input.addListener("noteon", e => {
        console.log(e.note.identifier);
      });
      this.midiInputs.push(input);
    })
  }

  _getNote(note) {
    //let note = args.NOTE;
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
    //noteName = noteName + "$octave";
    console.log(noteName);
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
          currentWaveForm: "sine",
          currentVolume: 75,
          currentSynthType: SYNTH_TYPE_SYNTH,
          currentNoiseType: NOISE_TYPE_PINK,
          currentOscillatorType: OSCILLATOR_TYPE_OSC
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
      blocks: [
        {
          opcode: 'playNote',
          blockType: BlockType.COMMAND,
          text: 'Play Note: [NOTE] for: [DURATION] seconds',
          arguments: {
            NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 60
            },
            DURATION: {
              type: ArgumentType.NUMBER,
              defaultValue: 1.0
            },
          }
        },
        {
          opcode: 'startNote',
          blockType: BlockType.COMMAND,
          text: 'Start Note: [NOTE]',
          arguments: {
            NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 60
            },
          }
        },
        {
          opcode: 'stopNote',
          blockType: BlockType.COMMAND,
          text: 'Stop Note: [NOTE]',
          arguments: {
            NOTE: {
              type: ArgumentType.NOTE,
              defaultValue: 60
            },
          }
        },
        {
          opcode: 'stopAllSounds',
          blockType: BlockType.COMMAND,
          text: 'Stop all sounds',
        },
        {
          opcode: 'createSynthType',
          blockType: BlockType.COMMAND,
          text: 'Create Synth of type: [SYNTH_TYPE]',
          arguments: {
            SYNTH_TYPE: {
              type: ArgumentType.STRING,
              menu: 'synthTypeMenu'
            },
          }
        },
        {
          opcode: 'getSynthType',
          blockType: BlockType.REPORTER,
          text: 'Synth: [SYNTH_TYPE]',
          arguments: {
            SYNTH_TYPE: {
              type: ArgumentType.STRING,
              menu: 'synthTypeMenu'
            },
          }
        },
        {
          opcode: 'changeOscillatorType',
          blockType: BlockType.COMMAND,
          text: 'Change Oscillator to: [OSCILLATOR_TYPE]',
          arguments: {
            OSCILLATOR_TYPE: {
              type: ArgumentType.STRING,
              menu: 'oscillatorTypeMenu'
            },
          }
        },
        {
          opcode: 'changeWaveForm',
          blockType: BlockType.COMMAND,
          text: 'Change waveform to: [WAVE]',
          arguments: {
            WAVE: {
              type: ArgumentType.STRING,
              menu: 'waveMenu'
            },
          }
        },
        {
          opcode: 'changeNoiseType',
          blockType: BlockType.COMMAND,
          text: 'Change noise to: [NOISE_TYPE]',
          arguments: {
            NOISE_TYPE: {
              type: ArgumentType.STRING,
              menu: 'noiseMenu'
            },
          }
        },
        {
          opcode: 'playNoise',
          blockType: BlockType.COMMAND,
          text: 'Play Noise: [NOISE_TYPE] for: [DURATION] seconds',
          arguments: {
            NOISE_TYPE: {
              type: ArgumentType.STRING,
              menu: 'noiseMenu'
            },
            DURATION: {
              type: ArgumentType.NUMBER,
              defaultValue: 0.5
            }
          }
        },
        {
          opcode: 'startNoise',
          blockType: BlockType.COMMAND,
          text: 'Start Noise type: [NOISE_TYPE] id:[NOISE_ID]',
          arguments: {
            NOISE_TYPE: {
              type: ArgumentType.NOISE_TYPE,
              menu: 'noiseMenu'
            },
            NOISE_ID: {
              type: ArgumentType.NUMBER,
              defaultValue: 0
            },
          }
        },
        {
          opcode: 'stopNoise',
          blockType: BlockType.COMMAND,
          text: 'Stop Noise type:[NOISE_TYPE] id:[NOISE_ID]',
          arguments: {
            NOISE_TYPE: {
              type: ArgumentType.NOISE_TYPE,
              menu: 'noiseMenu'
            },
            NOISE_ID: {
              type: ArgumentType.NUMBER,
              defaultValue: 0
            },
          },
        },
        {
          opcode: 'glide',
          blockType: BlockType.COMMAND,
          text: 'Glide from: [START_NOTE] to: [END_NOTE] for: [SECONDS] seconds',
          arguments: {
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
          }
        },
        {
          opcode: 'changeVolume',
          blockType: BlockType.COMMAND,
          text: 'Set volume to: [VOLUME] %',
          arguments: {
            VOLUME: {
              type: ArgumentType.NUMBER,
              defaultValue: 75
            }
          }
        },
        {
          opcode: 'createAutoFilter',
          blockType: BlockType.REPORTER,
          text: 'AutoFilter frequency: [FREQUENCY] base frequency: [BASE_FREQUENCY]',
          arguments: {
            FREQUENCY: {
              type: ArgumentType.noteNumber,
              defaultValue: 200
            },
            BASE_FREQUENCY:{
              type: ArgumentType.NUMBER,
              defaultValue: 50
            }
          }
        },
        {
          opcode: 'createFilter',
          blockType: BlockType.REPORTER,
          text: 'Filter with cutoff: [FILTER_FREQ] type: [FILTER_TYPE]',
          arguments: {
            FILTER_FREQ: {
              type: ArgumentType.NUMBER,
              defaultValue: 1500
            },
            FILTER_TYPE:{
              type: ArgumentType.STRING,
              menu: 'filterTypeMenu'
            }
          }
        },
        {
          opcode: 'connectNodes',
          blockType: BlockType.COMMAND,
          text: 'Connect [NODE_ONE_KEY] to [NODE_TWO_KEY]',
          arguments: {
            NODE_ONE_KEY: {
              type: ArgumentType.STRING,
            },
            NODE_TWO_KEY:{
              type: ArgumentType.STRING,
            }
          }
        },
        {
          opcode: 'clearEffects',
          blockType: BlockType.COMMAND,
          text: 'Clear effects'
        },
        {
          opcode: '_setMidiInput',
          blockType: BlockType.COMMAND,
          text: 'Set MIDI Input: [INPUT]',
          arguments: {
            INPUT: {
              type: ArgumentType.STRING,
              menu: 'getMidiInputsMenu'
            }
          }
        },
        {
          opcode: '_getMidiNoteOn',
          blockType: BlockType.REPORTER,
          text: 'MIDI Note On',
        },
        {
          opcode: '_getMidiNoteOff',
          blockType: BlockType.REPORTER,
          text: 'MIDI Note Off',
        },

      ],
      menus: {
        noiseMenu: {
          items: [
            {
              value: NOISE_TYPE_PINK,
              text: 'pink'
            },
            {
              value: NOISE_TYPE_WHITE,
              text: 'white'
            },
            {
              value: NOISE_TYPE_BROWN,
              text: 'brown'
            }
          ]
        },
        synthTypeMenu: {
          items: [
            {
              value: SYNTH_TYPE_SYNTH,
              text: 'Synth'
            },
            {
              value: SYNTH_TYPE_AM,
              text: 'AM Synth'
            },
            {
              value: SYNTH_TYPE_FM,
              text: 'FM Synth'
            },
            {
              value: SYNTH_TYPE_DUO,
              text: 'Duo Synth'
            },
            {
              value: SYNTH_TYPE_MEMBRANE,
              text: 'Membrane Synth'
            },
            {
              value: SYNTH_TYPE_METAL,
              text: 'Metal Synth'
            },
            {
              value: SYNTH_TYPE_NOISE,
              text: 'Noise Synth'
            },
          ]
        },
        oscillatorTypeMenu: {
          items: [
            {
              value: OSCILLATOR_TYPE_AM,
              text: 'AMOscillator'
            },
            {
              value: OSCILLATOR_TYPE_FAT,
              text: 'FatOscillator'
            },
            {
              value: OSCILLATOR_TYPE_FM,
              text: 'FMOscillator'
            },
            {
              value: OSCILLATOR_TYPE_OSC,
              text: 'Oscillator'
            },
            {
              value: OSCILLATOR_TYPE_PWM,
              text: 'PWMOscillator'
            },
            {
              value: OSCILLATOR_TYPE_PULSE,
              text: 'PulseOscillator'
            },
          ]
        },
        filterTypeMenu: {
          items: [
            {
              value: FILTER_TYPE_LOW_PASS,
              text: 'Low Pass'
            },
            {
              value: FILTER_TYPE_HIGH_PASS,
              text: 'High Pass'
            },
            {
              value: FILTER_TYPE_BAND_PASS,
              text: 'Band Pass'
            },
            {
              value: FILTER_TYPE_NOTCH,
              text: 'Notch'
            },
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
        effectMenu: {
          items: [
            {
              value: 'autoFilter',
              text: 'AutoFilter'
            },
            {
              value: 'bitCrusher',
              text: 'BitCrusher'
            },
            {
              value: 'chorus',
              text: 'Chorus'
            },
            {
              value: 'reverb',
              text: 'Reverb'
            },
          ]
        },
        getMidiInputsMenu: {
          items: '_getMidiInputs'
        }
      }
    };
  }

  playNote (args) {
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const note = this._getNote(args.NOTE);
    const duration = args.DURATION;
    const synthType = synthState.currentSynthType;
    if (!this.audioNodeMap.has(synthType)) {
      console.log('map.has synth? '+ this.audioNodeMap.has(synthState.currentSynthType+''));
      console.log('No synth of '+synthState.currentSynthType+' type.');
      this._setSynthType(synthType, util);
      console.log('returned from _setSynthType.');
    }
    if (this.audioNodeMap.has(synthType)) {

      const synth = this.audioNodeMap.get(synthType);
      if (synthType != SYNTH_TYPE_DUO) {
        synth.set({oscillator:{type:synthState.currentWaveForm}});
      }
      else {
        synth.set({voice0:{oscillator:{type:synthState.currentWaveForm}},
                        voice1:{oscillator:{type:synthState.currentWaveForm}}});
      }
      synth.volume.value = synthState.currentVolume * 0.56 - 50;
      if (synthType != SYNTH_TYPE_NOISE) {
        synth.triggerAttackRelease(note, duration).toDestination();
      }
      else {
        synth.triggerAttackRelease(duration).toDestination();
      }
    }
  }

  startNote (args) {
    /*
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    */
    const note = this._getNote(args.NOTE);
    this._startSound(note);
    //const duration = args.DURATION;
    /*
    const synthType = synthState.currentSynthType;
    if (!this.audioNodeMap.has(synthType)) {
      //console.log('map.has synth? '+ this.audioNodeMap.has(synthState.currentSynthType+''));
      //console.log('No synth of '+synthState.currentSynthType+' type.');
      this._setSynthType(synthType, util);
      //console.log('returned from _setSynthType.');
    }
    if (this.audioNodeMap.has(synthType)) {
      const synth = this.audioNodeMap.get(synthType);
      if (synthType != SYNTH_TYPE_DUO) {
        synth.set({oscillator:{type:synthState.currentWaveForm}});
      }
      else {
        synth.set({voice0:{oscillator:{type:synthState.currentWaveForm}},
                        voice1:{oscillator:{type:synthState.currentWaveForm}}});
      }
      synth.volume.value = synthState.currentVolume * 0.56 - 50;
      if (synthType != SYNTH_TYPE_NOISE) {
        synth.triggerAttack(note).toDestination();
      }
      else {
        synth.noise.set({type:synthState.currentNoiseType});
        synth.noise.start().toDestination();
      }
    }
    */
  }

  stopNote (args) {
    /*
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    */
    const note = this._getNote(args.NOTE);
    this._stopSound(note);
    /*
    const synthType = synthState.currentSynthType;
    if (!this.audioNodeMap.has(synthType)) {
      //console.log('map.has synth? '+ this.audioNodeMap.has(synthState.currentSynthType+''));
      //console.log('No synth of '+synthState.currentSynthType+' type.');
      this._setSynthType(synthType, util);
      //console.log('returned from _setSynthType.');
    }
    if (this.audioNodeMap.has(synthType)) {
      const synth = this.audioNodeMap.get(synthType);
      if (synthType != SYNTH_TYPE_DUO) {
        synth.set({oscillator:{type:synthState.currentWaveForm}});
      }
      else {
        synth.set({voice0:{oscillator:{type:synthState.currentWaveForm}},
                        voice1:{oscillator:{type:synthState.currentWaveForm}}});
      }
      synth.volume.value = synthState.currentVolume * 0.56 - 50;
      if (synthType != SYNTH_TYPE_NOISE) {
        synth.triggerRelease(note).toDestination();
      }
      else {
        synth.noise.stop().toDestination();
      }
    }
    */
  }

  _startSound(note) {
    console.log("note: " + note);
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const synthType = synthState.currentSynthType;
    if (!this.audioNodeMap.has(synthType)) {
      //console.log('map.has synth? '+ this.audioNodeMap.has(synthState.currentSynthType+''));
      //console.log('No synth of '+synthState.currentSynthType+' type.');
      this._setSynthType(synthType, util);
      //console.log('returned from _setSynthType.');
    }
    if (this.audioNodeMap.has(synthType)) {
      const synth = this.audioNodeMap.get(synthType);
      if (synthType != SYNTH_TYPE_DUO) {
        synth.set({oscillator:{type:synthState.currentWaveForm}});
      }
      else {
        synth.set({voice0:{oscillator:{type:synthState.currentWaveForm}},
                        voice1:{oscillator:{type:synthState.currentWaveForm}}});
      }
      synth.volume.value = synthState.currentVolume * 0.56 - 50;
      if (synthType != SYNTH_TYPE_NOISE) {
        synth.triggerAttack(note).toDestination();
      }
      else {
        synth.noise.set({type:synthState.currentNoiseType});
        synth.noise.start().toDestination();
      }
    }
  }

  _stopSound(note) {
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const synthType = synthState.currentSynthType;
    if (!this.audioNodeMap.has(synthType)) {
      //console.log('map.has synth? '+ this.audioNodeMap.has(synthState.currentSynthType+''));
      //console.log('No synth of '+synthState.currentSynthType+' type.');
      this._setSynthType(synthType, util);
      //console.log('returned from _setSynthType.');
    }
    if (this.audioNodeMap.has(synthType)) {
      const synth = this.audioNodeMap.get(synthType);
      if (synthType != SYNTH_TYPE_DUO) {
        synth.set({oscillator:{type:synthState.currentWaveForm}});
      }
      else {
        synth.set({voice0:{oscillator:{type:synthState.currentWaveForm}},
                        voice1:{oscillator:{type:synthState.currentWaveForm}}});
      }
      synth.volume.value = synthState.currentVolume * 0.56 - 50;
      if (synthType != SYNTH_TYPE_NOISE) {
        synth.triggerRelease(note).toDestination();
      }
      else {
        synth.noise.stop().toDestination();
      }
    }
  }

  stopAllSounds () {
    this.audioNodeMap.forEach((node, key) => {
      console.log('node: ', node + ', key: ', key);
      if (node.name == "PolySynth") {
        node.releaseAll();
      }
      else if (node.name == "NoiseSynth") {
        node.noise.stop();
      }
      else if (node.name == "Noise"){
        node.stop();
      }
    });
  }

  startNoise (args) {
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const volume = synthState.currentVolume * 0.56 - 50;
    const noise = new Tone.Noise({type:args.NOISE_TYPE, volume:volume});
    const noiseKey = 'noise'+args.NOISE_TYPE+''+args.NOISE_ID;
    console.log('start: ' + noiseKey);
    if (!this.audioNodeMap.has(noiseKey)) {
      this.audioNodeMap.set(noiseKey, noise);
      noise.start().toDestination();
    }
  }

  stopNoise (args) {
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const noiseKey = 'noise'+args.NOISE_TYPE+''+args.NOISE_ID;
    console.log('stop: ' + noiseKey);
    if (this.audioNodeMap.has(noiseKey)) {
      const noise = this.audioNodeMap.get(noiseKey);
      noise.stop();
      this.audioNodeMap.delete(noiseKey);
    }
  }

  createSynthType (args) {
    console.log('createSynthType: '+args.SYNTH_TYPE);
    const synthType = args.SYNTH_TYPE;
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    this._setSynthType(synthType, util);
    //return args.SYNTH_TYPE;
  }

  getSynthType (args) {
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    if (!this.audioNodeMap.has(args.SYNTH_TYPE)) {
      const synth = this._getSynth(args.SYNTH_TYPE, util);
      this.audioNodeMap.set(args.SYNTH_TYPE, synth);
    }
    return args.SYNTH_TYPE;
  }

  changeOscillatorType (args) {
    const oscillatorType = args.OSCILLATOR_TYPE;
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    this._setOscillatorType(oscillatorType, util);
  }

  changeWaveForm (args) {
    const wave = args.WAVE;
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    this._setWaveForm(wave, util);
  }

  changeNoiseType (args) {
    const type = args.NOISE_TYPE;
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    this._setNoiseType(type, util);
  }

  changeVolume (args) {
    var volume = args.VOLUME;
    volume = MathUtil.clamp(volume, MIN_VOLUME, MAX_VOLUME);
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    this._setVolume(volume, util);
    //const synth = new Tone.Synth();
    //synth.oscillator.type = wave;
  }
  playNoise (args) {
    // initialize the noise and start
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const duration = "+"+args.DURATION+"";
    const volume = synthState.currentVolume * 0.56 - 50;
    const noise = new Tone.Noise({type:args.NOISE_TYPE, volume:volume}).toDestination();
    const noiseKey = 'noise'+args.NOISE_TYPE+''+duration+''+volume+'';
    this.audioNodeMap.set(noiseKey, noise);
    noise.start().stop(duration);
    //return noiseKey;
  }

  glide (args) {
    const start_note = this._getNote(args.START_NOTE);
    const end_note = this._getNote(args.END_NOTE);
    const seconds = args.SECONDS;
    const duration = "+"+seconds+"";
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    //const synth = new Tone.Synth().toDestination();
    const synthState = this._getSynthState(util.target);
    /*
    if (synthState.synthType != SYNTH_TYPE_NOISE &&
        synthState.synthType != SYNTH_TYPE_METAL &&
        synthState.synthType != SYNTH_TYPE_PLUCK &&
        synthState.synthType != SYNTH_TYPE_DUO) {
        */
    const osc = this._getOscillator(
      start_note,
      synthState.currentVolume,
      util).toDestination().start().stop(duration);

    /*
      if (synthState.synthType == SYNTH_TYPE_AM ||
          synthState.synthType == SYNTH_TYPE_FM) {
            osc = synth.oscillator._oscillator.toDestination().start().stop(duration);
          }
          */
      //osc.frequency.value = start_note;
    //osc.type = synthState.currentWaveForm;
    //synth.oscillator.volume.value = synthState.currentVolume;
      //osc.frequency.rampTo(end_note, seconds);
    const total_time = "+"+args.SECONDS+"";
    const signal = new Tone.Signal({
        value: start_note,
        units: "frequency"
      }).connect(osc.frequency);
        // the scheduled ramp controls the connected signal
    signal.rampTo(end_note, seconds);
        //osc.start().stop(total_time);
  }

  createFilter (args) {
    //return new Tone.Filter(args.FILTER_FREQ, args.FILTER_TYPE);
    const filter = new Tone.Filter(args.FILTER_FREQ, args.FILTER_TYPE);
    const key = ''+args.FILTER_FREQ+''+args.FILTER_TYPE+''+this.audioNodeMap.size+'';
    this.audioNodeMap.set(key,filter);
    return key;
  }

  connectNodes (args) {
    const node1Key = args.NODE_ONE_KEY;
    const node2Key = args.NODE_TWO_KEY;
    const audioNode1 = this.audioNodeMap.get(node1Key);
    const audioNode2 = this.audioNodeMap.get(node2Key);
    audioNode1.connect(audioNode2);
  }

  createAutoFilter (args) {
    const afKey = 'autofilter'+args.FREQUENCY+''+args.BASE_FREQUENCY;
    const util = {
        runtime: this.runtime,
        target: this.runtime.getEditingTarget()
    };
    const synthState = this._getSynthState(util.target);
    const autoFilter = new Tone.AutoFilter(args.FREQUENCY, args.baseFREQUENCY);
    if (!this.audioNodeMap.has(afKey)) {
      this.audioNodeMap.set(afKey, autoFilter);
    }
    return afKey;
  }

  clearEffects() {
    this.audioNodeMap.clear();
  }

  _setSynthType (synthType, util) {
    console.log('_setSynthType '+synthType);
    const synthState = this._getSynthState(util.target);
    synthState.currentSynthType = synthType;
    var synth = new Tone.PolySynth(Tone.Synth);
    const synthKey = synthType;
    console.log('synthKey: '+synthKey);
    console.log('audioNodeMap.has '+synthKey+': '+this.audioNodeMap.has(synthKey));
    if (!this.audioNodeMap.has(synthKey)) {
      switch(synthType) {
        case SYNTH_TYPE_AM:
          synth = new Tone.PolySynth(Tone.AMSynth);
          break;
        case SYNTH_TYPE_DUO:
          synth = new Tone.PolySynth(Tone.DuoSynth);
          break;
        case SYNTH_TYPE_FM:
          synth = new Tone.PolySynth(Tone.FMSynth);
          break;
        case SYNTH_TYPE_MEMBRANE:
          synth = new Tone.PolySynth(Tone.MembraneSynth);
          break;
        case SYNTH_TYPE_METAL:
          synth = new Tone.PolySynth(Tone.MetalSynth);
          break;
        case SYNTH_TYPE_NOISE:
          //const noiseSynth = new Tone.NoiseSynth();
          synth = new Tone.NoiseSynth({noise:{type:synthState.currentNoiseType}});
          break;
        case SYNTH_TYPE_SYNTH:
          synth = new Tone.PolySynth(Tone.Synth);
          break;
        default:
          this.synth = new Tone.PolySynth(Tone.Synth);
          break;
      }
      synth.set({maxPolyphony: 30});
      this.audioNodeMap.set(synthKey,synth);
    }
  }

  _setOscillatorType(oscillatorType, util) {
    const synthState = this._getSynthState(util.target);
    synthState.currentOscillatorType = oscillatorType;
  }
  /**
   * Internal code to select a synth waveform.
   * @param {string} waveForm - the synth waveform type.
   * @param {object} util - utility object provided by the runtime.
   */
  _setWaveForm (waveForm, util) {
    const synthState = this._getSynthState(util.target);
    synthState.currentWaveForm = waveForm;
  }

  _setNoiseType (noiseType, util) {
    const synthState = this._getSynthState(util.target);
    synthState.currentNoiseType = noiseType;
  }

  _setVolume (volume, util) {
    //const compressedVolume = (volume * 0.56) - 50;
    //onst compressedVolume = (volume * 0.6)  - 50;
    const synthState = this._getSynthState(util.target);
    synthState.currentVolume = volume;
  }
  _getSynth (type, util) {
    const synthState = this._getSynthState(util.target);
    var synth = new Tone.Synth();
    switch (synthState.currentSynthType) {
      case SYNTH_TYPE_AM:
        synth = new Tone.AMSynth();
        synth.oscillator.type = synthState.currentWaveForm;
        break;
      case SYNTH_TYPE_DUO:
        synth = new Tone.DuoSynth();
        synth.voice0.oscillator.type = synthState.currentWaveForm;
        synth.voice1.oscillator.type = synthState.currentWaveForm;
        break;
      case SYNTH_TYPE_FM:
        synth = new Tone.FMSynth();
        synth.oscillator.type = synthState.currentWaveForm;
        break;
      case SYNTH_TYPE_MEMBRANE:
        synth = new Tone.MembraneSynth();
        synth.oscillator.type = synthState.currentWaveForm;
        break;
      case SYNTH_TYPE_METAL:
        synth = new Tone.MetalSynth();
        break;
      case SYNTH_TYPE_NOISE:
        synth = new Tone.NoiseSynth({noise:{type:synthState.currentNoiseType}});
        break;
      case SYNTH_TYPE_PLUCK:
        synth = new Tone.PluckSynth();
        break;
        /*
      case SYNTH_TYPE_POLY:
          synth = new Tone.PolySynth();
          synth.set({oscillator:{type:synthState.currentWaveForm}});
          break;
          */
      case SYNTH_TYPE_SYNTH:
        synth = new Tone.Synth();
        synth.oscillator.type = synthState.currentWaveForm;
        break;
      default:
        synth = new Tone.Synth();
        synth.oscillator.type = synthState.currentWaveForm;
        break;
    }
    return synth;
  }

  _getOscillator (pitch,volume,util) {
    const synthState = this._getSynthState(util.target);
    switch (synthState.currentOscillatorType) {
      case OSCILLATOR_TYPE_AM:
        return new Tone.AMOscillator(pitch, synthState.currentWaveform,"square").set({volume:volume});
      case OSCILLATOR_TYPE_FAT:
        return new Tone.FatOscillator(pitch, synthState.currentWaveform).set({volume:volume});
      case OSCILLATOR_TYPE_FM:
        return new Tone.FMOscillator(pitch, synthState.currentWaveform).set({volume:volume});
      case OSCILLATOR_TYPE_OSC:
        return new Tone.Oscillator(pitch, synthState.currentWaveform).set({volume:volume});
      case OSCILLATOR_TYPE_PWM:
        return new Tone.PWMOscillator(pitch).set({volume:volume});
      case OSCILLATOR_TYPE_PULSE:
        return new Tone.PulseOscillator(pitch).set({volume:volume});
      default:
        return new Tone.Oscillator(pitch, synthState.currentWaveform).set({volume:volume});
    }
  }

  _setMidiInput ( args ) {
    if (this.webMidi && this.webMidi.inputs.length > 0) {
      this.midiInput = this.webMidi.getInputByName(args.INPUT);
      if (this.midiInput) {
        this.midiInput.addListener("noteon", e => {
            console.log(e.note.number);
            this._setMidiNoteOn(e.note.identifier);
            this._startSound(this.midiNoteOn);
          });
        this.midiInput.addListener("noteoff", e => {
            console.log(e.note.number);
            this._setMidiNoteOff(e.note.identifier);
            this._stopSound(this.midiNoteOff);
          });
      }
    }
  }

  _getMidiInputs () {
    if (this.webMidi && this.webMidi.enabled) {
      this.midiInputs = [];
      this.webMidi.inputs.forEach((input) => {
        this.midiInputs.push(input.name);
      });
      if (this.midiInputs.length == 0) {
        this.midiInputs = ["No MIDI input detected"];
      }
    }
    else {
      this.midiInputs = ["Select MIDI input"];
    }
    return this.midiInputs;
  }

  _getMidiNoteOn () {
    return this.midiNoteOn;
  }

  _setMidiNoteOn (note) {
    this.midiNoteOn = note;
  }

  _getMidiNoteOff () {
    return this.midiNoteOff;
  }

  _setMidiNoteOff (note) {
    this.midiNoteOff = note;
  }
/*
  _midiInputs () {
    return this.midiInputs;
  }
*/
  connectToOutput (args) {
    const key = args.NODE;
    const audioNode = this.audioNodeMap.get(key);
    audioNode.toDestination();
  }
}

module.exports = Scratch3ToneSynth;
