<template lang="pug">
  div.backdrop
    div.container
      .board-wrapper
        .toolbar
        .pads-container
          .pad(v-for="i in 64", :style="{background: colors[i] || 'white'}", @click="click(i)") {{i}}
</template>
<style lang="scss" scoped>
$button-size: 80px;
$gap-size: 20px;
$grid-size: 8;
$font-size: 1.8em;

.backdrop {
  color: white;
}

.heading {
  margin-bottom: 1.5em;
}

.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: #2d2d30;
  padding: 100px 0;
}

.board-wrapper,
.toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.toolbar {
  flex-direction: column;
  margin-right: 1.8em;
}

.toolbar button {
  cursor: pointer;
  font-size: 2.5em;
  background: transparent;
  color: #01dcfc;
  font-weight: 600;
  border: none;

  margin-bottom: 1.5em;
}

.pads-container {
  display: grid;
  grid-template-rows: repeat($grid-size, $button-size);
  grid-template-columns: repeat($grid-size, $button-size);
  grid-gap: $gap-size $gap-size;
}

.pad {
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: #2d2d30;
  font-weight: 600;
  font-size: $font-size;
  cursor: pointer;

  box-shadow: 4px 4px 4px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}
</style>
<script lang="ts">
import Vue from 'vue'
import Color from 'color'
import {Howl} from 'howler'

import {LaunchPadX, ControlButtons, toID, toNote} from './LaunchPad'

const pixelOff = note => [0, Number(note), 0]

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const Keymap = {
  RESET: ControlButtons.RECORD_ARM,
}

interface SoundMapping {
  color: string,
  sound: string
  loop?: boolean
  solo?: boolean
  parallel?: boolean
}

const soundboardUI = Vue.extend({
  data: () => ({
    currentColor: 'orange',
    colors: [],
    sounds: {},
    mappings: {},
    playingState: {},
  }),

  mounted() {
    window.sb = this

    this.pad = new LaunchPadX()

    this.pad.on('ready', () => {
      this.pad.clear()
      this.pad.on('padTouch', (n, v) => this.tap(n, v))

      this.load()
    })
  },

  methods: {
    save() {
      const config = JSON.stringify(this.mappings)
      localStorage.setItem('soundboard.config', config)

      return config
    },

    load(configString: string) {
      if (!configString) {
        configString = localStorage.getItem('soundboard.config')
      }

      if (!configString) return

      let config = JSON.parse(configString)

      this.mappings = config

      // Apply soundboard mapping configuration.
      Object.entries(this.mappings).forEach(([note, mapping]) => {
        this.setMapping(note, mapping)
      })
    },

    setColor(note: number, color: string) {
      let c = Color(color)

      console.debug(`Setting color to rgb(${c.color.join(',')}) on device.`)

      // Set the launchpad's device color
      this.pad.rgb(note, ...c.color)

      // Set the webapp display's device color
      Vue.set(this.colors, toID(note), color)
    },

    setColorByID(id: number, color: string) {
      this.setColor(toNote(id), color)
    },

    click(note: number) {
      this.execute(note)
    },

    tap(note: number, velocity: number) {
      this.execute(note)
    },

    execute(note: number) {
      let mapping: SoundMapping = this.mappings[note]
      if (!mapping) return

      if (!mapping.parallel && this.playingState[note]) {
        this.sounds[mapping.sound].stop()
      }

      this.setPlaying(note, true)

      this.setColor(note, 'red')
      this.playSound(mapping.sound)
    },

    setPlaying(note: number, isPlaying: boolean) {
      Vue.set(this.playingState, note, isPlaying)
    },

    onEnd(note: number) {
      let mapping: SoundMapping = this.mappings[note]
      if (!mapping) return

      this.setColor(note, mapping.color)
      this.setPlaying(note, false)
    },

    setMapping(note: number, mapping: SoundMapping) {
      let {color, sound} = mapping

      Vue.set(this.mappings, note, mapping)

      this.loadSound(sound, {
        onend: () => this.onEnd(note)
      })

      this.setColor(note, color)
    },

    add(
      id: number,
      sound: string = 'ahh.wav',
      color = 'lime',
      config: Partial<SoundMapping> = {}
    ) {
      this.setMapping(toNote(id), {sound, color, ...config})
    },

    loadSound(path: string, config) {
      let sound = new Howl({src: '/sounds/' + path, ...config})
      Vue.set(this.sounds, path, sound)

      return sound
    },

    playSound(id: string) {
      let sound = this.sounds[id]
      if (sound) return sound.play()

      this.loadSound(id).play()
    }
  },
})

export default soundboardUI
</script>