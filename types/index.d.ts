export type Mark = { id: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    trail: { marks: Mark[]; active: string | null; hovered: string | null }
  }
}
