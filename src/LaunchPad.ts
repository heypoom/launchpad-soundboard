import WebMidi, {Input, Output, INoteParam} from 'webmidi'

export const enableMidiWithSysEx = () =>
  new Promise((resolve, reject) => {
    WebMidi.enable(err => {
      if (err) return reject(err)
      resolve()
    }, true)
  })

type KeyHandler = (note: number, velocity: number) => void

type KeyEvents =
  | 'controlChange'
  | 'padTouch'
  | 'padRelease'
  | 'noteActive'
  | 'noteRelease'
  | 'update'
  | 'clear'
  | 'ready'

type KeyListeners = Record<KeyEvents, KeyHandler[]>

function inputOf(name) {
  const inPort = WebMidi.getInputByName(name)
  if (inPort) return inPort
}

function outputOf(name) {
  const outPort = WebMidi.getOutputByName(name)
  if (outPort) return outPort
}

export const range = (start, end) =>
  Array(end - start + 1)
    .fill(0)
    .map((_, i) => i + start)

function buildMidiGrid() {
  let midiGrid = []

  for (let i = 8; i >= 1; i--) {
    const b = i * 10
    midiGrid.push(range(b + 1, b + 8))
  }

  return midiGrid
}

// prettier-ignore
export const ColorSpec = (note: number, color: number) =>
  [0, note % 99, color % 128]

// prettier-ignore
export const FlashSpec = (note: number, A: number, B: number) =>
  [1, note % 99, A % 128, B % 128]

// prettier-ignore
export const PulseSpec = (note: number, color: number) => 
  [2, note % 99, color % 128]

// prettier-ignore
export const RGBSpec = (note: number, r: number, g: number, b: number) =>
  [3, note % 99, r % 128, g % 128, b % 128]

function buildMapper() {
  // prettier-ignore
  const genRanges = [
    [81, -80],
    [71, -62],
    [61, -44],
    [51, -26],
    [41, -8],
    [31, +10],
    [21, +28],
    [11, +46]
  ]

  const midiToGrid = {}
  const gridToMidi = {}

  for (let [startAt, offset] of genRanges) {
    for (let i = 0; i < 8; i++) {
      midiToGrid[startAt + i] = startAt + i + offset
      gridToMidi[startAt + i + offset] = startAt + i
    }
  }

  return [midiToGrid, gridToMidi]
}

export const midiGrid = buildMidiGrid()
export const [midiToGridMap, gridToMidiMap] = buildMapper()

export function posOf(n: number) {
  let x = (n % 8) - 1
  if (x === -1) x = 7

  let y = Math.max(Math.ceil(n / 8) - 1, 0)

  return [x, y]
}

export const toID = (note: number) => midiToGridMap[note]
export const toNote = (id: number) => gridToMidiMap[id]

export const ControlButtons = {
  UP: 91,
  DOWN: 92,
  LEFT: 93,
  RIGHT: 94,
  SESSION: 95,
  NOTE: 96,
  CUSTOM: 97,
  CAPTURE_MIDI: 98,
  VOLUME: 89,
  PAN: 79,
  SEND_A: 69,
  SEND_B: 59,
  STOP_CLIP: 49,
  MUTE: 39,
  SOLO: 29,
  RECORD_ARM: 19,
}

export class LaunchPadX {
  midiIn: Input
  midiOut: Output
  dawIn: Input
  dawOut: Output

  midiInName = 'Launchpad X LPX MIDI Out'
  midiOutName = 'Launchpad X LPX MIDI In'

  dawInName = 'Launchpad X LPX DAW Out'
  dawOutName = 'Launchpad X LPX DAW In'

  initialized = false

  midiGrid = midiGrid
  toID = toID
  toNote = toNote

  listeners: KeyListeners = {
    controlChange: [],
    padTouch: [],
    padRelease: [],
    noteActive: [],
    noteRelease: [],
    update: [],
    clear: [],
    ready: [],
  }

  constructor() {
    this.setup()
  }

  on(event: keyof KeyListeners, handler: KeyHandler) {
    if (!this.listeners[event]) return

    this.listeners[event].push(handler)
  }

  dispatch(event: keyof KeyListeners, note: number = 0, velocity: number = 0) {
    if (!this.listeners[event]) return

    console.debug(`${event}>`, note, velocity)

    for (let listener of this.listeners[event]) {
      listener(note, velocity)
    }
  }

  async setup() {
    if (this.initialized) return

    await enableMidiWithSysEx()
    this.initPorts()
    this.setupListeners()
    this.useProgrammerLayout()
    this.dispatch('ready')

    this.initialized = true
  }

  setupListeners() {
    this.midiIn.addListener('noteon', 'all', event => {
      this.dispatch('padTouch', event.note.number, event.rawVelocity)
    })

    this.midiIn.addListener('noteoff', 'all', event => {
      this.dispatch('padRelease', event.note.number, event.rawVelocity)
    })

    this.dawIn.addListener('noteon', 'all', event => {
      let note = event.note.number
      this.dispatch('noteActive', note, event.rawVelocity)
    })

    this.dawIn.addListener('noteoff', 'all', event => {
      let note = event.note.number
      this.dispatch('noteRelease', note, event.rawVelocity)
    })

    this.midiIn.addListener('controlchange', 'all', event => {
      const {value, controller} = event
      const id = controller.number

      let type: KeyEvents = 'controlChange'
      // if (value === 127) type = 'padTouch'
      // else if (value === 0) type = 'padRelease'

      this.dispatch(type, id, value)
    })
  }

  initPorts() {
    this.midiIn = inputOf(this.midiInName)
    this.midiOut = outputOf(this.midiOutName)
    this.dawIn = inputOf(this.dawInName)
    this.dawOut = outputOf(this.dawOutName)
  }

  useProgrammerLayout() {
    this.cmd(0, 127)
    this.cmd(14, 1)
  }

  cmd(...data: number[]) {
    this.dawOut.send(240, [0, 32, 41, 2, 12, ...data, 247])
  }

  flash(n: number, a: number, b: number) {
    this.bulk([FlashSpec(n, a, b)])
  }

  rgb(n: number, r: number, g: number, b: number) {
    this.bulk([RGBSpec(n, r, g, b)])
  }

  pulse(n: number, color: number) {
    this.bulk([PulseSpec(n, color)])
  }

  bulk(specs: number[][]) {
    let payload = []
    specs.forEach(spec => (payload = [...payload, ...spec]))

    this.cmd(3, ...payload)
  }

  light(note: number, velocity: number) {
    this.dispatch('update', note, velocity)

    this.midiOut.playNote(note, 1, {
      velocity,
      rawVelocity: true,
    })
  }

  grid(grid: (number | number[])[][]) {
    const specs = []

    for (let y in grid) {
      for (let x in grid[y]) {
        const note = this.midiGrid[y][x]
        let item = grid[y][x]

        if (typeof item === 'number') {
          specs.push(ColorSpec(note, item))
        } else if (Array.isArray(item)) {
          specs.push([...item.slice(0, 1), note, ...item.slice(1)])
        }
      }
    }

    this.bulk(specs)
  }

  clear(C = 0) {
    const grid = [
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
      [C, C, C, C, C, C, C, C],
    ]

    console.log('> Clear OK')

    this.grid(grid)
  }
}
