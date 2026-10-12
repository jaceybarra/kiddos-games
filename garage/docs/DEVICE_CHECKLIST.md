# iPad checklist for a grown-up (not yet checked on a real iPad)

Everything here was tested in desktop Chromium with Playwright at iPad-like sizes. That doesn't prove it works on a
real iPad. Safari on iPadOS has its own touch handling, storage rules and offline behaviour. Please run through this
once on Bentley's iPad and tick what works. Anything that doesn't, note what you saw.

Device: ____________  iPadOS version: ________  Date: ________

## Setup
- [ ] The game opens in Safari from the address you use at home (see README → "Play on the iPad").
- [ ] Share → **Add to Home Screen** adds a "Garage" icon. Opening it fills the screen with no Safari bars.
- [ ] Grown-up settings → Offline shows the state honestly. Over plain `http://` on the home network it should say
      offline play needs a secure address. Over `https://` it should change to *Ready to play without internet*
      after a minute online.

## Touch and layout (landscape)
- [ ] The big jump button responds the instant it's touched, every time, including a quick tap.
- [ ] Holding jump makes the truck go a little higher. Releasing it doesn't leave the truck "stuck jumping".
- [ ] Dragging a bridge, ramp or pad onto its outline lands where your finger is. No offset at the screen edges.
- [ ] Tap a piece, then tap its outline. That places it too.
- [ ] Nothing important is under the camera notch or the Home bar. Buttons sit clear of the rounded corners.
- [ ] Pinching or swiping on the game doesn't scroll or zoom the page. The grown-up settings panel can still be
      pinch-zoomed.
- [ ] Jump on the left (grown-up setting) moves the jump button to the left corner.

## Interruptions
- [ ] Turning the iPad to portrait pauses the game and shows the turn-the-tablet picture. Turning back shows the
      pause menu, and Resume continues from the same spot.
- [ ] Pressing the Home button (or swiping up) mid-drive, then coming back, shows the pause menu. The truck isn't
      jumping or speeding on its own.
- [ ] A notification banner or Control Center pull-down mid-jump doesn't leave the jump button held.

## Saving
- [ ] Finish mission 1, close the Home Screen app fully (swipe it away), reopen. The pennant is on the shelf and the
      coin jar matches.
- [ ] Grown-up settings → Backup → Export saves a file (Files app). Import the same file and it says it worked.
- [ ] Grown-up settings → Saving → "Keep saves safe" reports what Safari decided.

## Offline (only if served over https; see README)
- [ ] After *Ready to play without internet*: turn on Airplane Mode, close and reopen the Home Screen app. It opens
      and a mission can be played to the end.

## Feel (watch Bentley play; don't coach)
- [ ] Movement looks smooth (no stutter while driving at normal speed).
- [ ] Celebrations are short and calm. Reduce Motion (iPad Settings → Accessibility → Motion) makes them calmer still.
