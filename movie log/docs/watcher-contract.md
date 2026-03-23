# Watcher Contract

This contract defines the expected behavior of `electron/folder-monitor.ts` and `electron/watched-folder-sync.ts`.

## Arrival

- An arrival is a visible top-level media file or top-level media folder that appears after watching starts.
- Hidden files and non-media files do not count as arrivals.
- Multiple arrivals inside one settle window count as one folder update.
- Paths that already exist before watching starts are baseline state, not arrival history.

Current coverage:

- `tests/folder-monitor.test.ts`: `ignores hidden and non-media files and emits newly added top-level folders and media files`
- `tests/folder-monitor.test.ts`: `does not sync until an arrival happens after watching starts`
- `tests/folder-monitor.test.ts`: `coalesces multiple new top-level media files into one folder update`

## Must Never Rescan Without Cause

- Watching an existing folder attaches the watcher without inventing an arrival from unchanged contents.
- An idle watched folder with an unchanged top-level path set must not keep rescanning or rewriting known paths.
- Existing watched folders only refresh through the queued refresh path on explicit catch-up, manual scan, or a real filesystem change.

Current coverage:

- `tests/folder-monitor.test.ts`: `does not keep rescanning a watched folder while it is idle`
- `tests/watched-folder-sync.test.ts`: `catches up existing watched folders once when watching starts`
- `tests/watched-folder-sync.test.ts`: `catches up watched folders once after watching resumes`

## Folder Disappearance

- If a watched folder disappears, the stored top-level snapshot becomes empty.
- The direct watcher must detach from the missing folder and watch the nearest existing parent until the folder returns.
- When the folder returns, the watcher reattaches and later arrivals in that folder resume normal change reporting.

Current coverage:

- `tests/folder-monitor.test.ts`: `does not throw when a watched folder is missing`
- `tests/folder-monitor.test.ts`: `starts watching a missing folder when the folder appears later`
- `tests/folder-monitor.test.ts`: `clears the stored snapshot and reattaches after a watched folder disappears and returns`

## Add-Folder Setup

- The watcher attaches before the first refresh for a newly added folder.
- An arrival that lands during add-folder setup must be captured by the first refresh instead of getting lost between watch startup and scan.

Current coverage:

- `tests/watched-folder-sync.test.ts`: `captures an arrival that lands during add-folder setup`

## Overlapping Refreshes

- Refreshes serialize per folder.
- Removing a watched folder invalidates queued results for that folder.
- Unwatching one folder must not wait on another folder's in-flight sync.

Current coverage:

- `tests/watched-folder-sync.test.ts`: `serializes refreshes for the same watched folder`
- `tests/watched-folder-sync.test.ts`: `drops queued refresh results after a watched folder is removed`
- `tests/folder-monitor.test.ts`: `unwatches one folder without waiting for another folder sync to finish`
