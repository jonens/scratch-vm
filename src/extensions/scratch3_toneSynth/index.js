const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const TargetType = require('../../extension-support/target-type');
const Cast = require('../../util/cast');
const Clone = require('../../util/clone');
const Color = require('../../util/color');
const log = require('../../util/log');
const formatMessage = require('format-message');
const color = require('../../util/color');
const Tone = require('./Tone.js');

class Scratch3toneSynth {
  constructor (runtime) {
    this.runtime = runtime;
  }

  getInfo () {
    return {
      id: 'toneSynth',
      name: 'Tone Synth',
      blocks: [
        {
          opcode: 'writeText',
          blockType: BlockType.COMMAND,
          text: 'myText [TEXT]',
          arguments: {
            TEXT: {
              type: ArgumentType.STRING,
              defaultValue: "hello"
            }
          }
        }
      ],
      menus: {

      }
    };
  }

  writeText (args) {
    const text = Cast.toString(args.TEXT);
    log.myText(text);
  }
}
(function() {
    var extensionInstance = new Scratch3toneSynth(window.vm.extensionManager.runtime)
    var serviceName = window.vm.extensionManager._registerInternalExtension(extensionInstance)
    window.vm.extensionManager._loadedExtensions.set(extensionInstance.getInfo().id, serviceName)
})()

module.exports = Scratch3toneSynth;
