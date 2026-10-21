import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Mark } from '../types'
import type { MapProps } from './map'

const PANE = 'trail'
const WIDTH = 32
const DASH = '─'
// The map is as wide as its longest swell (5 cells, plus 1.5 active, plus 5 under the pointer).
const MAP_CELLS = 13
const JUMP = ' ↵ '

const marks = atom({ plugin: 'trail', key: 'marks' } as const, [] as Mark[])
const active = atom({ plugin: 'trail', key: 'active' } as const, null as string | null)
const hovered = atom({ plugin: 'trail', key: 'hovered' } as const, null as string | null)

// Rhythm like a document minimap: longer prompts get a slightly longer dash.
const baseLength = (text: string) => 2 + Math.min(3, Math.floor(Math.log2(text.length / 24 + 1)))

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

// Cells a character takes in the terminal: CJK and fullwidth forms take two.
const cells = (char: string) => (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(char) ? 2 : 1)

// Cut to what `lines` rows of `width` cells hold, wrapping as the terminal will.
const fit = (text: string, width: number, lines: number) => {
  let row = 1
  let used = 0
  let out = ''
  for (const char of text) {
    const w = cells(char)
    if (used + w > width) {
      row += 1
      used = 0
    }
    if (row > lines || (row === lines && used + w > width - 1 && out.length < text.length - 1)) return `${out}…`
    out += char
    used += w
  }
  return out
}

async function jump($: EngineInterface, id: string) {
  const moved = await $.ui
    .scroll({ to: { requestId: id }, block: 'start' })
    .catch((error: unknown) => ({ deny: String(error) }))
  if (moved.deny !== undefined) $.ui.toast(`Trail: ${moved.deny}`)
  else await update($, active, () => id)
}

export const register: Register = on => {
  // Prompts in the order the transcript drew them, and which are on screen now. Rebuilt as rows redraw.
  const order: string[] = []
  const onScreen = new Set<string>()
  const pending: Mark[] = []
  let shownTop: string | null = null
  let isFlushing = false
  const topOnScreen = () => order.find(one => onScreen.has(one)) ?? null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'trail',
      description: 'Show the prompt minimap beside the transcript',
    })
    void $.ui.open({ id: PANE, title: 'Trail', columns: WIDTH })

    return next(e)
  })

  on('command.run', { command: 'trail' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Trail', columns: WIDTH })

    return { text: 'Trail opened.' }
  })

  // Watch the person's own prompts as the transcript draws them; the row itself is left as the engine draws it.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.component !== 'UserMessage' || e.props.origin.kind !== 'composer') return next(e)

    const id = e.requestId
    const text = oneLine(e.props.text)
    if (text === '') return next(e)

    if (!order.includes(id)) {
      order.push(id)
      pending.push({ id, text })
    }
    const seen = e.props.onScreen
    if (seen === null) onScreen.delete(id)
    else if (seen !== undefined) onScreen.add(id)

    // Drawing is pure, so the writes wait for a timer just after it.
    if (!isFlushing && (pending.length > 0 || topOnScreen() !== shownTop)) {
      isFlushing = true
      $.clock.after(0, () => {
        isFlushing = false
        const added = pending.splice(0)
        const top = topOnScreen()
        shownTop = top
        if (added.length > 0) {
          void update($, marks, list => {
            const fresh = added.filter(one => !list.some(mark => mark.id === one.id))
            return fresh.length === 0 ? list : [...list, ...fresh].slice(-500)
          })
        }
        void update($, active, was => (was === top ? was : top))
      })
    }

    return next(e)
  })

  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== 'map') return next(e)
    // The preview stays on the last dash pointed at, so the pointer can travel down to its jump button.
    // A click relayed from the map is not the person's own press, so the engine would refuse a scroll from here.
    const data = e.data as { hover?: string | null; jump?: string }
    const id = data.jump ?? data.hover
    if (typeof id === 'string') await update($, hovered, was => (was === id ? was : id))

    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.component !== 'Pane') throw new Error('unreachable')
    if (e.surface !== 'terminal') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Trail draws in the terminal.</Text>
    }
    const { Box, Text, Button, Client } = $.ui.resolve(e)
    const list = await read($, marks)
    const current = await read($, active)
    const pointed = await read($, hovered)

    const width = Math.max(8, e.props.bodyColumns - 3)
    const height = Math.max(8, e.props.scroll.bodyRows - 1)
    const previewRows = Math.min(12, Math.max(4, Math.floor(height * 0.4)))
    const room = Math.max(3, height - previewRows - 4)

    if (list.length === 0) {
      return (
        <Box paddingLeft={2} paddingTop={1}>
          <Text dimColor>{DASH.repeat(3)}</Text>
        </Box>
      )
    }

    // Show what fits; once there are more prompts than rows, keep the active one in view.
    const at = list.findIndex(mark => mark.id === current)
    const end =
      list.length <= room
        ? list.length
        : Math.min(list.length, Math.max(room, (at < 0 ? list.length : at + 1) + Math.floor(room / 2)))
    const offset = Math.max(0, end - room)
    const shown = list.slice(offset, end)
    const map: MapProps = {
      rows: shown.map(mark => ({ id: mark.id, base: baseLength(mark.text), isActive: mark.id === current })),
    }

    const index = list.findIndex(mark => mark.id === pointed)
    const preview = index < 0 ? undefined : list[index]

    return (
      <Box flexDirection="column" paddingLeft={2} paddingRight={1} paddingTop={1} height={height}>
        <Box height={1} marginBottom={1}>
          <Text dimColor>{String(list.length).padStart(2, '0')}</Text>
        </Box>

        {/* The jump sits on the pointed dash's own row, so reaching it never crosses another dash. */}
        <Box flexDirection="row">
          <Client key="map" module="./map.tsx" props={map} width={MAP_CELLS} height={shown.length} />
          <Box flexDirection="column">
            {shown.map(mark =>
              mark.id === pointed ? (
                <Button key="jump" plain dimColor onPress={() => jump($, mark.id)}>
                  {JUMP}
                </Button>
              ) : (
                <Text> </Text>
              ),
            )}
          </Box>
        </Box>

        <Box flexGrow={1} />

        <Box flexDirection="column" height={previewRows}>
          {preview !== undefined && (
            <>
              <Text dimColor>{`${String(index + 1).padStart(2, '0')} ${DASH.repeat(Math.max(0, width - 3))}`}</Text>
              <Text wrap="wrap">{fit(preview.text, width, previewRows - 1)}</Text>
            </>
          )}
        </Box>
      </Box>
    )
  })
}
