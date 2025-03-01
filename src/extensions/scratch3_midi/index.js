const BlockType = require('../../extension-support/block-type');
const ArgumentType = require('../../extension-support/argument-type');
const TargetType = require('../../extension-support/target-type');
const Midi = require('../../../node_modules/webmidi/dist/esm/webmidi.esm.min.js');
const Clock = require('../../io/clock');
const Cast = require('../../util/cast');

class Scratch3Midi {

    constructor (runtime) {
      this.runtime = runtime;
      this._onTargetCreated = this._onTargetCreated.bind(this);
      this.runtime.on('targetWasCreated', this._onTargetCreated);
      this.clock = new Clock(runtime);
      this.webMidi = null;
      this.midiMessage = null;
      this.webMidiUtilities = null;
      this.midiInputs = ["Select MIDI Input"];
      this.midiInput = null;
      this.midiNoteOn = 0;
      this.midiNoteOff = true;
      this.midiNoteOffValue = 0;
      this.midiCCEvent = false;
      this.midiControlChange = {number: 0, data: 0, name: ''};
      //this.midiControlChangeName = '';
      this.midiCCEvent = false;
      import('webmidi').then((webMidiModule) => {
        this.webMidi = webMidiModule.WebMidi;
        this.midiMessage = webMidiModule.Message;
        this.webMidi.enable().then(this._onMidiEnabled());
        this.webMidiUtilities = webMidiModule.Utilities;
      })
    }

    _onMidiEnabled() {
      console.log("midi enabled");
      this.midiInputs = [];
      this.webMidi.inputs.forEach(input => {
        this.midiInputs.push(input);
      })

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
     * The key to load & store a target's midi-related state.
     * @type {string}
     */
    static get STATE_KEY () {
        return 'Scratch.midi';
    }

    /**
     * The default music-related state, to be used when a target has no existing music state.
     * @type {MidiState}
     */
    static get DEFAULT_MIDI_STATE () {
        return {
          midiInputs: ["Select MIDI Input"],
          midiInput: null,
          midiNoteOn: 0,
          midiNoteOff: 0,
          midiNotesOn: null,
          midiNotesOff: null,
        };
    }


    /**
     * When a MIDI Target is cloned, clone the MIDI state.
     * @param {Target} newTarget - the newly created target.
     * @param {Target} [sourceTarget] - the target used as a source for the new clone, if any.
     * @listens Runtime#event:targetWasCreated
     * @private
     */
    _onTargetCreated (newTarget, sourceTarget) {
        if (sourceTarget) {
            const midiState = sourceTarget.getCustomState(Scratch3Midi.STATE_KEY);
            if (synthState) {
                newTarget.setCustomState(Scratch3Midi.STATE_KEY, Clone.simple(synthState));
            }
        }
    }

    /**
     * Returns the metadata about your extension.
     */
    getInfo () {
        return {
            // unique ID for your extension
            id: 'midi',

            // name that will be displayed in the Scratch UI
            name: 'Midi',

            // colours to use for your extension blocks
            color1: '#FFC93F',
            color2: '#0000FF',

            blocks: [
              {
                opcode: 'selectMidiInput',
                blockType: BlockType.COMMAND,
                text: 'MIDI Input: [INPUT]',
                arguments: {
                  INPUT: {
                    type: ArgumentType.STRING,
                    menu: 'getMidiInputsMenu'
                  }
                },
              },
              /*
              {
                opcode: 'addMidiListener',
                blockType: BlockType.COMMAND,
                text: 'Add MIDI listener'
              },
              */
              {
                opcode: 'isMidiCCEvent',
                blockType: BlockType.HAT,
                text: 'MIDI CC',
              },
              {
                opcode: 'isMidiNoteOn',
                blockType: BlockType.HAT,
                text: 'When MIDI Note On',
              },
              /*
              {
                opcode: 'isMidiNotesOn',
                blockType: BlockType.HAT,
                text: 'When MIDI Notes On',
              },
              */
              {
                opcode: 'isMidiNoteOff',
                blockType: BlockType.HAT,
                text: 'When Midi Note Off',
              },
              /*
              {
                opcode: 'isMidiNotesOff',
                blockType: BlockType.HAT,
                text: 'When Midi Notes Off',
              },
              {
                opcode: 'allMidiNotesOff',
                blockType: BlockType.HAT,
                text: 'All Midi Notes Off',
              },
              {
                opcode: 'getMidiNotesOn',
                blockType: BlockType.REPORTER,
                text: 'MIDI Notes On',
              },
              {
                opcode: 'getMidiNotesOnLength',
                blockType: BlockType.REPORTER,
                text: 'MIDI Notes On Length',
              },
              */
              {
                opcode: 'getMidiNoteOn',
                blockType: BlockType.REPORTER,
                text: 'MIDI Note On',
              },
              /*
              {
                opcode: 'getMidiNotesOff',
                blockType: BlockType.REPORTER,
                text: 'MIDI Notes Off',
              },
              {
                opcode: 'getMidiNotesOffLength',
                blockType: BlockType.REPORTER,
                text: 'MIDI Notes Off Length',
              },
              */
              {
                opcode: 'getMidiNoteOff',
                blockType: BlockType.REPORTER,
                text: 'MIDI Note Off',
              },
              /*
              {
                opcode: 'isMidiControlChange',
                blockType: BlockType.HAT,
                text: 'Midi CC',
              },
              */
              {
                opcode: 'getMidiControlChangeNumber',
                blockType: BlockType.REPORTER,
                text: 'MIDI CC Number',
              },
              {
                opcode: 'getMidiControlChangeData',
                blockType: BlockType.REPORTER,
                text: 'CC Data',
              },
              {
                opcode: 'getMidiControlChangeName',
                blockType: BlockType.REPORTER,
                text: 'CC Name',
              },
              {
                opcode: 'getMidiCCDataAsNormal',
                blockType: BlockType.REPORTER,
                text: 'CC Norm: (0-1)',
              },
              {
                opcode: 'getMidiCCDataAsLFO',
                blockType: BlockType.REPORTER,
                text: 'CC LFO: (0-15)',
              },
              {
                opcode: 'getMidiCCDataAsDelay',
                blockType: BlockType.REPORTER,
                text: 'CC Delay: (0-20)',
              },
              {
                opcode: 'getMidiCCDataAsChebyshev',
                blockType: BlockType.REPORTER,
                text: 'CC Cheb: (0-100)',
              },
              {
                opcode: 'getMidiCCDataAsNote',
                blockType: BlockType.REPORTER,
                text: 'CC Note: (0-127)',
              },
              {
                opcode: 'getMidiCCDataAsFrequency',
                blockType: BlockType.REPORTER,
                text: 'CC Freq: (0-4000)',
              },
              /*
              {
                opcode: 'clearMidiNotesOn',
                blockType: BlockType.COMMAND,
                text: 'Clear MIDI Notes On',
              },
              {
                opcode: 'clearMidiNotesOff',
                blockType: BlockType.COMMAND,
                text: 'Clear MIDI Notes Off',
              },
              */
            ],
            menus: {
              getMidiInputsMenu: {
                items: '_getMidiInputs'
              },
            }
        };
    }

    selectMidiInput ( args ) {
      if (this.webMidi && this.webMidi.inputs.length > 0) {
        this.midiInput = this.webMidi.getInputByName(args.INPUT);
        this.addMidiListener();
      }
    }

    addMidiListener () {
      if (this.midiInput) {
        if (this.midiInput && !this.midiInput.hasListener("noteon")) {
          this.midiInput.addListener("noteon", e => {
            this.midiCCEvent = true;
            this.midiNoteOn = e.note.number;
            this.midiNoteOff = false;
            this.midiNoteOffValue = 0;
            //this._setMidiNotesOn(e.note.number);
              console.log("note on: " + e.note.number + " time: " + this.clock.projectTimer());
            });
        }
        if (this.midiInput && !this.midiInput.hasListener("noteoff")) {
          this.midiInput.addListener("noteoff", e => {
            this.midiNoteOn = 0;
            this.midiNoteOff = true;
            this.midiNoteOffValue = e.note.number;
            this.midiCCEvent = false;
            console.log("note off: " + e.note.number + " time: " + this.clock.projectTimer());
            });
        }
        if (this.midiInput && !this.midiInput.hasListener("controlchange")) {
          this.midiInput.addListener("controlchange", cc => {

            console.log('controlchange ' + cc.data);
            console.log('MIDI Event ' + this.midiCCEvent);
            const message = new this.midiMessage(cc.data);
            console.log("message command: " + message.command);
            if (cc.data.length > 0) {
              this.midiCCEvent = true;
              this.midiControlChange.number = cc.data[1];
              this.midiControlChange.data = cc.data[2];
              this.midiControlChange.name = this.webMidiUtilities.getCcNameByNumber(this.midiControlChange.number);
              console.log('controlchange on: ' + this.midiControlChange);
            }
            else {
              this.midiCCEvent = false;
            }
            //else {
            //  this.midiControlChange = false;
            //  console.log('controlchange on: ' + this.midiControlChange);
            //}
            //this.midiCCEvent = false;
          });
        }
      }
      else {
        return false;
      }
    }

    isMidiCCEvent (args, util) {
      if (this.midiInput && !this.midiInput.hasListener("midimessage")) {
        this.midiInput.addListener("midimessage", mm => {
          if (mm.message.type === 'controlchange') {
            console.log("midimessage.type " + mm.message.type);
            return true;
          }
          else {
            return false;
          }
        });

      }
    }

    isMidiNoteOn () {
      return (this.midiNoteOn > 0);
    }
/*
    isMidiNotesOn () {
      let notesOn = (this.midiNotesOnMap.size >= 1) ? true : false;
      return notesOn;
    }
*/
    isMidiNoteOff () {
      return this.midiNoteOff;
    }
/*
    isMidiNotesOff () {
      return (this.midiNotesOffMap.size >= 1) ? true : false;
    }

    allMidiNotesOff () {
      let allNotesOff = (this.midiNotesOnMap.size === 0) ? true : false;
      if (this.midiNotesOnMap.size === 0 && this.midiNotesOffMap.size > 0) {
        this.midiNotesOffMap.clear();
      }
      return allNotesOff;
    }
*/
    getMidiNoteOff () {
      return this.midiNoteOffValue;
    }
/*
    getMidiNotesOn () {
      return this.midiNotesOnMap.values().toArray();
    }

    getMidiNotesOnLength () {
      return this.midiNotesOnMap.size;
    }
*/
    getMidiNoteOn () {
      return this.midiNoteOn;
    }
/*
    getMidiNotesOff () {
      return this.midiNotesOffMap.values().toArray();
    }

    getMidiNotesOffLength () {
      return this.midiNotesOffMap.size;
    }

    clearMidiNotesOn () {
      this.midiNotesOnMap.clear();
    }

    clearMidiNotesOff () {
      this.midiNotesOffMap.clear();
    }

    isMidiControlChange () {
      return this.midiControlChange;
    }
*/

    getMidiControlChangeNumber () {
      return this.midiControlChange.number;
    }

    /*
      CC raw data: 0 - 127
    */
    getMidiControlChangeData () {
      return this.midiControlChange.data;
    }

    getMidiControlChangeName () {
      return this.midiControlChange.name;
    }

    /*
      Convert CC raw data to normal range: 0 - 1
    */
    getMidiCCDataAsNormal () {
      return (this.midiControlChange.data / 127.0).toFixed(2);
    }

    /*
      Convert CC raw data to LFO range: 0 - 15
    */
    getMidiCCDataAsLFO () {
      return (this.midiControlChange.data / 8.5).toFixed(2);
    }

    /*
      Convert CC raw data to Delay range: 0 - 20
    */
    getMidiCCDataAsDelay () {
      return (this.midiControlChange.data / 6.45).toFixed(2);
    }

    /*
      Convert CC raw data to Chebyshev order range: 0 - 100
    */
    getMidiCCDataAsChebyshev () {
      return Math.round(this.midiControlChange.data / 1.275).toFixed(2);
    }

    /*
      Convert CC raw data to MIDI note string: C0 - G8
    */
    getMidiCCDataAsNote () {
      return this._getNote(this.midiControlChange.data);
    }

    getMidiCCDataAsFrequency () {
      return (this.midiControlChange.data * 31.25).toFixed(2);
    }

    _getMidiInputs () {
      if (this.webMidi && this.webMidi.enabled) {
        this.midiInputs = [];
        this.webMidi.inputs.forEach((input) => {
          this.midiInputs.push(input.name);
        });
        if (this.midiInputs.length === 0) {
          this.midiInputs = ["No MIDI input detected"];
        }
      }
      else {
        this.midiInputs = ["Select MIDI input"];
      }
      return this.midiInputs;
    }
/*
    _setMidiNotesOn (noteNumber) {
      const key = '' + noteNumber;
      console.log('noteOn key: ' + key);
      this.midiNotesOnMap.set(key, noteNumber);
    }

    _setMidiNotesOff (noteNumber) {
      const key = '' + noteNumber;
      this.midiNotesOffMap.set(key, noteNumber);
    }

    _removeMidiNote (noteNumber) {
      var keyToRemove = this._findKeyByValue(this.midiNotesOnMap, noteNumber);
      if (keyToRemove) {
        this.midiNotesOnMap.delete(keyToRemove);
      }
      keyToRemove = this._findKeyByValue(this.midiNotesOffMap, noteNumber);
      if (keyToRemove) {
        this.midiNotesOffMap.delete(keyToRemove);
      }
    }
*/
}

module.exports = Scratch3Midi;
