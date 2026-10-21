import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'trail',
  component: 'Pane',
  requestId: 'trail',
  props: {
    title: 'Trail',
    isFocused: false,
    bodyColumns: 22,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const prompt = (requestId: string, text: string) =>
  ({
    plugin: 'trail',
    component: 'UserMessage',
    requestId,
    props: { text, origin: { kind: 'composer' }, isExpanded: false, onScreen: null },
  }) as const

const LONG = '我们能不能给Claude code 写一个mod，让他支持我们右侧有个边栏之类的，就是能看到我们发送过多少次消息'

test('pointing at a dash previews its prompt in full', async ($, on) => {
  const clock = mock.clock(on)
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('ui.toast', () => ({ value: undefined }))

  const first = await $.ui.mount({ ...prompt('m1', 'Fix Table 3 overflow'), surface: 'terminal' })
  const second = await $.ui.mount({ ...prompt('m2', LONG), surface: 'terminal' })
  await clock.advance(1)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^02$/ }))?.text).toBe('02')
  expect(await ui.find({ type: 'Text', text: /边栏/ })).toBeUndefined()

  await ui.pointer({ type: 'move', x: 1, y: 1 })
  await clock.advance(100)
  expect((await ui.find({ type: 'Text', text: /边栏/ }))?.text).toBe(LONG)

  // The dash under the pointer eases out past its resting length.
  await ui.advance(400)
  expect(JSON.stringify(await ui.drawn({ in: 'map' }))).toMatch(/─{6,}/)

  // Leaving the map keeps the preview, so its jump button can be reached and pressed.
  await ui.pointer({ type: 'leave', x: 1, y: 1 })
  await clock.advance(100)
  expect((await ui.find({ type: 'Text', text: /边栏/ }))?.text).toBe(LONG)
  expect((await ui.press({ key: 'jump' }))?.element).toBe('jump')

  await ui.unmount()
  await first.unmount()
  await second.unmount()
})
