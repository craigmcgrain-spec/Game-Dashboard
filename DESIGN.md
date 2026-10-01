# Design system: die-cut sticker sheet

Implemented in JavaFX CSS (`src/main/resources/application.css`), not browser CSS. Audience: kids 4-8, mouse or touch.

## Idea
The launcher is an album page of die-cut stickers. Every tappable thing is a sticker with a thick white cut-line and a soft blue-black shadow. Games are big coloured stickers, players are round avatar stickers, scores are star badges.

## Colour
- Page: cobalt `#2d5bff` with the halftone tile `img/dots.png`.
- Sticker fills (`StickerPalette`, cycled per game; stable per player id): cherry `#ff4d6d`, grape `#8f5cf5`, grass `#0f8f42`, sun `#ffc83d`, tangerine `#ff8a3d`, aqua `#17c3d6`. Each carries its own ink (white or navy); `StickerPaletteTest` enforces >= 3:1.
- Ink: navy `#16205c`. Label plates and panels: white `#ffffff`, cream `#fffaf0`. Badges and primary-on-blue actions: sun yellow.
- Go/confirm: grass green with white text.

## Type
Lilita One (bundled, SIL OFL, `fonts/OFL-LilitaOne.txt`) for everything; sizes 22-56px. Loaded by `Theme.loadFonts()`.

## Shape and depth
- White cut-line borders 4-9px, radii 26-40px; stickers tilt +-2 degrees (`setRotate`, not CSS, so hover scale stays CSS).
- Shadows are soft blue-black (blur 10-18, y offset 5-9); the only hard-ish shadow is the 4px blur title.
- Fill sits behind the border via `-fx-background-insets: 4` to avoid a coloured hairline outside the cut-line.

## Components
- Game sticker (`.sticker`): coloured tile, one-ink emoji glyph (96px), white label plate, optional star score badge. Hover/press scale; focus = navy border + yellow glow.
- Player button (`.player-btn`): 64px avatar + name; selected = tinted row, navy border AND a green check badge (never colour alone). `.new-btn` dashed target.
- Buttons: `.go-btn` (green), `.scores-btn` (yellow), `.back-btn` (white), `.row-go` (white on a coloured row), `.overlay-btn` (yellow, in games). All >= 56px tall in the places a child taps.
- Scores rows: coloured sticker rows with name plate, white score pill, Play/Continue.
- Empty states are tilted yellow stickers.

## Motion
One authored moment: game stickers pop in on first render, 70ms apart (`HomeController.popIn`). Hover/press scale on stickers and buttons.

## Constraints
- JavaFX on Linux cannot draw colour emoji; emoji appear as monochrome glyphs, which is why they are inked on coloured stickers. Image icons from the manifest are shown as-is.
- `-fx-background` is not `-fx-background-color`; the old stylesheet silently did nothing because of this.
