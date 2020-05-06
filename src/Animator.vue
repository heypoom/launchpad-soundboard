<template lang="pug">
  div.backdrop
    div.container
      h1.heading
        div Frame {{frameID + 1}} | Frames: {{frames.length}}
      .board-wrapper
        .toolbar
          button(@click="prevFrame") ⏪
          button.play(@click="play") ⏯
          button(@click="nextFrame") ⏩
        .pads-container
          .pad(v-for="i in 64", :style="{background: colors[i]}", @click="tap(i)") {{i}}
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

import {LaunchPadX, RGB} from './LaunchPad'

const R = [3, 127, 0, 0]
const W = [3, 127, 127, 127]
const B = [3, 0, 0, 127]

const pixelOff = note => [0, Number(note), 0]

const flag = [
  [R, R, R, R, R, R, R, R],
  [W, W, W, W, W, W, W, W],
  [B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B],
  [B, B, B, B, B, B, B, B],
  [W, W, W, W, W, W, W, W],
  [R, R, R, R, R, R, R, R],
]

const rotate = (list, n) => list.slice(n, list.length).concat(list.slice(0, n))

function posOf(n: number) {
  let x = (n % 8) - 1
  if (x === -1) x = 7

  let y = Math.max(Math.ceil(n / 8) - 1, 0)

  return [x, y]
}

function animateSlideUp(frame) {
  const frames = []

  for (let i = 0; i < frame.length; i++) {
    frames.push(rotate(frame, i))
  }

  return frames
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// let specs = []
// for (let i = 11; i <= 98; i++) specs.push(RGB(i, 127, i, i + 3))
// this.pad.bulk(specs)

// animate(0)

const frameAnimator = Vue.extend({
  data: () => ({
    frameID: 0,
    state: {},
    colors: {},
    frames: [],
    isPlaying: false,

    palette: [
      [0, 0, 0],
      [255, 0, 157],
      [0, 255, 247],
    ],

    webPalette: ['#ffffff', '#ff7ef8', '#01dcfc'],
  }),

  mounted() {
    this.pad = new LaunchPadX()

    this.pad.on('ready', () => {
      this.clear()

      this.pad.on('padTouch', (n, v) => this.updateBlock(n, v))

      this.setupButtons()
    })
  },

  watch: {
    frames(frames, oldFrames) {
      if (this.frames.length < 2) this.pad.light(this.PLAY_BTN, 0)
      else this.pad.rgb(this.PLAY_BTN, 0, 60, 60)

      if (this.frames.length === 0) this.pad.light(this.DELETE_FRAME_BTN, 0)
      else this.pad.rgb(this.DELETE_FRAME_BTN, 255, 0, 0)
    },
  },

  methods: {
    save() {
      return JSON.stringify({
        frames: this.frames,
        palette: this.palette,
        webPalette: this.webPalette,
      })
    },

    load(str: string) {
      const {frames, palette, webPalette} = JSON.parse(str)

      if (frames) {
        this.frames = frames
        this.frameID = frames.length - 1
      }

      if (palette) this.palette = palette
      if (webPalette) this.webPalette = webPalette

      this.rerender()
    },

    updateDisplay: function(note: number, color: number) {
      const pos = this.pad.midiToGridMap[note]
      if (typeof pos !== 'number') return

      Vue.set(this.colors, pos, this.webPalette[color] || 'white')
    },

    prevFrame() {
      if (this.frameID === 0) return
      this.frameID--

      this.rerender()
    },

    deleteFrame() {
      this.frames = this.frames.slice(0, this.frames.length - 1)
      this.frameID = this.frames.length

      this.rerender()
    },

    reset() {
      this.frames = []
      this.frameID = 0

      this.clear()
      this.rerender()
    },

    createFrame() {
      this.frames = [...this.frames, {...this.state}]
      this.frameID = this.frames.length - 1
    },

    nextFrame() {
      this.frameID++

      if (!this.frames[this.frameID]) {
        this.createFrame()
        return
      }

      this.rerender()
    },

    clearScreen() {
      for (let row of this.pad.midiGrid) {
        for (let note of row) this.updateDisplay(note, 0)
      }
    },

    renderOnScreen(frame: number[]) {
      for (let note in frame) {
        let color = this.state[note]

        this.updateDisplay(Number(note), color)
      }
    },

    renderOnDevice(frame: number[]) {
      const specs = []

      for (let note in frame) {
        const cid = frame[note]
        if (typeof cid !== 'number') continue

        const [r, g, b] = this.palette[cid]

        if (r === 0 && g === 0 && b === 0) {
          specs.push(pixelOff(note))
          continue
        }

        specs.push(RGB(Number(note), r, g, b))
      }

      this.pad.bulk(specs)
    },

    rerender() {
      console.log(`Rendering Frame> ${this.frameID}`)

      let frame = this.frames[this.frameID]
      if (!frame) return

      this.state = frame

      this.clearScreen()
      this.renderOnScreen(frame)
      this.renderOnDevice(frame)
    },

    tap(i) {
      const [x, y] = posOf(i)
      const note = this.pad.midiGrid[y][x]

      this.updateBlock(note, 0)
    },

    clear() {
      this.pad.clear()

      this.state = {}
      this.colors = {}

      this.fill()
    },

    fill(color: number = 0, replace = false) {
      for (let row of this.pad.midiGrid) {
        for (let note of row) {
          if (replace && this.state[note]) return

          this.state[note] = color
          this.updateDisplay(note, color)
        }
      }
    },

    play(frame: number) {
      if (this.isPlaying) {
        this.isPlaying = false
        return
      }

      this.isPlaying = true

      if (this.frames.length < 2) return

      let startAt = this.frameID

      const animate = async () => {
        for (let frameID = startAt; frameID < this.frames.length; frameID++) {
          if (!this.isPlaying) return

          this.frameID = frameID
          this.rerender()

          await delay(100)
        }

        startAt = 0
        requestAnimationFrame(animate)
      }

      animate()
    },

    updateBlock(note: number, velocity: number) {
      const state = this.state

      const color = ((state[note] || 0) + 1) % this.palette.length
      state[note] = color

      const [r, g, b] = this.palette[color]
      this.pad.rgb(note, r, g, b)

      this.state = state
      this.updateDisplay(note, color)
    },

    setupButtons() {
      this.PREV_FRAME_BTN = 93
      this.NEXT_FRAME_BTN = 94
      this.PLAY_BTN = 98
      this.RESET_BTN = 39
      this.CLEAR_BTN = 49
      this.DELETE_FRAME_BTN = 59

      this.pad.rgb(this.PREV_FRAME_BTN, 0, 255, 247)
      this.pad.rgb(this.NEXT_FRAME_BTN, 0, 255, 247)
      this.pad.light(this.PLAY_BTN, 0)
      this.pad.rgb(this.RESET_BTN, 255, 0, 0)
      this.pad.rgb(this.CLEAR_BTN, 235, 47, 6)
      this.pad.light(this.DELETE_FRAME_BTN, 0)

      this.pad.on('controlChange', (id, v) => {
        if (id === this.RESET_BTN) {
          if (v === 0) return this.pad.rgb(id, 235, 47, 6)
          console.log('control> Reset Board')

          this.pad.rgb(id, 120, 224, 143)
          this.reset()
        }

        if (id === this.CLEAR_BTN) {
          if (v === 0) return this.pad.rgb(id, 235, 47, 6)
          console.log('control> Clear Frame')

          this.pad.rgb(id, 255, 0, 157)
          this.clear()
        }

        if (id === this.PREV_FRAME_BTN) {
          if (v === 0) return this.pad.rgb(id, 0, 255, 247)
          this.pad.rgb(id, 255, 0, 157)
          this.prevFrame()
        }

        if (id === this.NEXT_FRAME_BTN) {
          if (v === 0) return this.pad.rgb(id, 0, 255, 247)
          this.pad.rgb(id, 255, 0, 157)
          this.nextFrame()
        }

        if (id === this.DELETE_FRAME_BTN) {
          if (v === 0) return this.pad.rgb(id, 255, 0, 0)
          console.log('control> Delete Frame')

          this.pad.rgb(id, 255, 0, 157)
          this.deleteFrame()
        }

        if (id === this.PLAY_BTN) {
          if (v === 0) return
          if (this.frames.length < 2) return

          if (this.isPlaying) this.pad.rgb(id, 127, 0, 0)
          else this.pad.rgb(id, 0, 127, 0)

          this.play()
        }
      })
    },
  },
})

export default frameAnimator
</script>