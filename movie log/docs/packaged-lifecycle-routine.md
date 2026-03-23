# Packaged Lifecycle Routine

Use this routine when a packaged `Movie Log.app` lifecycle bug is suspected. Run it against the packaged app bundle in `release/mac`, not the dev server.

## Preconditions

1. Run `npm run package:mac`.
2. Quit every existing Movie Log process before starting the routine.
3. If `System Events` cannot read window counts, grant Accessibility access before continuing. Do not infer missing data.

## Capture Sheet

Record the same fields at each phase:

| Phase | Process tree | Window count | Tray state | Reopen behavior | Notes |
| --- | --- | --- | --- | --- | --- |
| Before `Cmd+W` |  |  |  |  |  |
| After `Cmd+W` |  |  |  |  |  |
| After tray reopen |  |  |  |  |  |

## Commands

Run these commands at every phase:

```sh
ps -axo pid,ppid,stat,etime,command | rg "Movie Log|Electron"
osascript -e 'tell application "System Events" to count windows of process "Movie Log"'
osascript -e 'tell application "System Events" to name of first application process whose frontmost is true'
```

## Routine

1. Launch the packaged app with `npm run open:mac`.
2. Wait until the main window is fully visible.
3. Capture the `Before Cmd+W` row.
   Record whether the menu bar item is visible and whether the app is frontmost.
4. Press `Cmd+W`.
5. Capture the `After Cmd+W` row.
   Record whether window count dropped to `0` and whether the menu bar item stayed visible.
6. Reopen the app from the menu bar item. Do not use Dock, Spotlight, or a direct process relaunch for this step.
7. Capture the `After tray reopen` row.
   Record whether one window returned, whether the app stayed on the active display and Space, and whether it stole focus.

## Expected Invariants

- The process tree must not grow into duplicate packaged instances during the routine.
- Window count should move `1 -> 0 -> 1`.
- The menu bar item should remain available after `Cmd+W`.
- Reopen should use the menu bar path and keep display and Space behavior explicit in the notes.

## Stop Conditions

- If the process tree or window count is ambiguous, restart from a clean slate.
- If the menu bar item cannot be observed directly, mark tray state as unknown and do not claim a lifecycle conclusion from that run.
