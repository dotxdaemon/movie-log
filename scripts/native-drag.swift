// ABOUTME: Performs a real macOS pointer drag between two screen coordinates for installed Finder-drop acceptance.
// ABOUTME: Uses CoreGraphics events so the renderer receives Finder-backed File objects instead of synthetic DOM files.
import CoreGraphics
import Foundation

guard CommandLine.arguments.count == 5,
      let startX = Double(CommandLine.arguments[1]),
      let startY = Double(CommandLine.arguments[2]),
      let endX = Double(CommandLine.arguments[3]),
      let endY = Double(CommandLine.arguments[4]) else {
  FileHandle.standardError.write(Data("usage: native-drag startX startY endX endY\n".utf8))
  exit(2)
}

guard let eventSource = CGEventSource(stateID: .hidSystemState) else {
  exit(1)
}
eventSource.localEventsSuppressionInterval = 0

func post(_ type: CGEventType, at point: CGPoint) {
  guard let event = CGEvent(mouseEventSource: eventSource, mouseType: type, mouseCursorPosition: point, mouseButton: .left) else {
    exit(1)
  }

  event.post(tap: .cghidEventTap)
}

let start = CGPoint(x: startX, y: startY)
let end = CGPoint(x: endX, y: endY)
post(.mouseMoved, at: start)
usleep(250_000)
post(.leftMouseDown, at: start)
usleep(300_000)

for step in 1...80 {
  let progress = Double(step) / 80.0
  let point = CGPoint(
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress
  )
  post(.leftMouseDragged, at: point)
  usleep(15_000)
}

usleep(250_000)
post(.leftMouseUp, at: end)
