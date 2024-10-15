const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const TargetType = require('../../extension-support/target-type');
const Cast = require('../../util/cast');
const Midi = require('../../../node_modules/jzz/javascript/JZZ.js');
const Tone = require('../../../node_modules/tone/build/esm/index.js');

class Scratch3toneSynth {
  constructor (runtime) {
    this.runtime = runtime;
    let AudioContext = window.AudioContext || window.webkitAudioContext;
    let context = new AudioContext();
    this.synth = new Tone.Synth().toDestination();
    //this.polySynth = new Tone.PolySynth(this.synth);
  }

  getInfo () {
    return {
      id: 'toneSynth',
      name: 'Tone Synth',
      blocks: [
        {
          opcode: 'playNote',
          blockType: BlockType.COMMAND,
          text: 'Play Note: [NOTE] type: [NOTE_TYPE]',
          arguments: {
            NOTE: {
              type: ArgumentType.STRING,
              defaultValue: "C4"
            },
            DURATION: {
              type: ArgumentType.NUMBER,
              defaultValue: 1.0
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
              defaultValue: 0.05
            }
          }
        },
        {
          opcode: 'glide',
          blockType: BlockType.COMMAND,
          text: 'Glide from: [START_NOTE] to: [END_NOTE] for: [SECONDS] seconds',
          arguments: {
            START_NOTE: {
              type: ArgumentType.STRING,
              defaultValue: "C2"
            },
            END_NOTE: {
              type: ArgumentType.STRING,
              defaultValue: "C3"
            },
            SECONDS: {
              type: ArgumentType.NUMBER,
              defaultValue: 2
            }
          }
        },

      ],
      menus: {
        noiseMenu: {
          items: [
            {
              value: 'pink',
              text: 'pink'
            },
            {
              value: 'white',
              text: 'white'
            },
            {
              value: 'brown',
              text: 'brown'
            }
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
        }
      }
    };
  }

  playNote (args) {
    const note = args.NOTE;
    const duration = args.DURATION;
    //const synth = new Tone.Synth().toDestination();
    this.synth.triggerAttackRelease(note, duration);
  }
  changeWaveForm (args) {
    const wave = args.WAVE;
    this.synth.oscillator.type = wave;
  }
  playNoise (args) {
    // initialize the noise and start

    const duration = "+"+args.DURATION+"";
    const noise = new Tone.Noise(args.NOISE_TYPE);
    const filter = new Tone.Filter(1500,"highpass").toDestination();
    filter.frequency.rampTo(20000, args.DURATION);
    noise.connect(filter).start().stop(duration);


  }
  glide (args) {
    const start_note = args.START_NOTE;
    const end_note = args.END_NOTE;
    const seconds = args.SECONDS;
    //const osc = new Tone.Oscillator().toDestination();
    const osc = this.synth.oscillator.toDestination();
    osc.frequency.value = start_note;
    // ramp to "C2" over 2 seconds
    osc.frequency.rampTo(end_note, seconds);
    const total_time = "+"+args.SECONDS+"";
    // start the oscillator for 2 seconds
    //this.synth.oscillator.start().stop(total_time);
    osc.start().stop(total_time);
  }
}
/*
(function() {
    var extensionInstance = new Scratch3toneSynth(window.vm.extensionManager.runtime)
    var serviceName = window.vm.extensionManager._registerInternalExtension(extensionInstance)
    window.vm.extensionManager._loadedExtensions.set(extensionInstance.getInfo().id, serviceName)
})()
*/

module.exports = Scratch3toneSynth;
