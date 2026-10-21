import type { ClientModule, ClientSurface } from 'claude-code'

export type Row = { id: string; base: number; isActive: boolean }
export type MapProps = { rows: Row[] }
type MapState = { y: number | null; lens: number[] }

// How far, in half cells, the dash under the pointer grows, and how wide the swell is.
const SWELL = 10
const SPREAD = 1.6
const EASE = 0.35

let props: MapProps = { rows: [] }
let pointerY: number | null = null
let hovered: string | null = null

const targets = () =>
  props.rows.map((row, i) => {
    const near = pointerY === null ? 0 : SWELL * Math.exp(-((i + 0.5 - pointerY) ** 2) / (2 * SPREAD ** 2))
    return row.base * 2 + (row.isActive ? 3 : 0) + near
  })

const dash = (halves: number) => {
  const n = Math.max(2, Math.round(halves))
  return '─'.repeat(Math.floor(n / 2)) + (n % 2 === 1 ? '╴' : '')
}

const start = (surface: ClientSurface<MapState>) => {
  const say = (id: string | null) => {
    if (id === hovered) return
    hovered = id
    surface.post({ hover: id })
  }

  surface.onPointer(e => {
    if (e.type === 'leave') {
      pointerY = null
      say(null)
      return
    }
    pointerY = e.fine?.y ?? e.y + 0.5
    const row = props.rows[e.y]
    if (e.type === 'move' || e.type === 'enter') say(row?.id ?? null)
    if (e.type === 'up' && e.button === 'left' && row !== undefined) surface.post({ jump: row.id })
  })

  // Ease each dash toward its target; redraw only while something still moves.
  surface.every(33, () => {
    const was = surface.state?.lens ?? []
    const goal = targets()
    const lens = goal.map((to, i) => {
      const from = was[i] ?? to
      return Math.abs(to - from) < 0.05 ? to : from + (to - from) * EASE
    })
    const isMoving = lens.some((len, i) => len !== was[i]) || lens.length !== was.length
    if (isMoving || surface.state?.y !== pointerY) surface.setState({ y: pointerY, lens })
  })
}

const TrailMap: ClientModule<MapProps, MapState> = (next, surface) => {
  const { Box, Text } = surface.elements
  props = next
  if (surface.state === undefined) {
    start(surface)
    surface.setState({ y: null, lens: targets() })
  }

  const lens = surface.state?.lens ?? targets()
  const y = surface.state?.y ?? null

  return (
    <Box flexDirection="column">
      {props.rows.map((row, i) => {
        const distance = y === null ? Infinity : Math.abs(i + 0.5 - y)
        const isUnder = distance < 0.75
        return (
          <Box height={1}>
            <Text
              color={row.isActive ? 'claude' : isUnder ? 'text' : undefined}
              dimColor={!row.isActive && distance > 2.5}
              bold={isUnder}
            >
              {dash(lens[i] ?? row.base * 2)}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}

export default TrailMap
