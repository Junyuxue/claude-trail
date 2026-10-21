# trail

A quiet minimap of your own prompts, docked beside the Claude Code transcript.

Each prompt you send becomes a thin dash in a side pane. Move the pointer over the dashes and they swell around it; the prompt under the pointer is previewed in full at the bottom of the pane. Click the `↵` that appears on the same row to scroll the transcript back to that prompt. The dash for the prompt currently on screen is drawn in the accent color, and the count of prompts sits at the top.

```
  12
  ──
  ────
  ──────────   ↵
  ───────
  ───
  ...
  06 ─────────────────
  Can we write a mod that shows a sidebar of
  the messages I've sent…
```

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install trail --marketplace Junyuxue/claude-trail
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install trail --marketplace Junyuxue/claude-trail
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Junyuxue/claude-trail`, then Add plugin.

## Use

- The pane opens by itself; `/trail` opens it again after you close it.
- Hover a dash to preview its prompt; the preview stays on the last dash you pointed at.
- Click `↵` on that dash's row to jump back to the prompt.

## Requirements

- Claude Code's **fullscreen** layout: the pane docks beside the transcript there, and only there can the transcript be scrolled to an older prompt.
- A terminal that reports mouse movement (most modern terminals do; tmux may need `set -g mouse on`).
- Prompts appear in the pane once the transcript has drawn them in this session.

## License

MIT
