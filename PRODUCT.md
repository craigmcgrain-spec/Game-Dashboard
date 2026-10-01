# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Kids aged 4-8 playing on a family Fedora desktop or laptop with mouse or touch; a parent sets up players and adds games. Several kids share one machine, each with their own name, avatar, scores and saved progress.

## Product Purpose
A standalone launcher for kids' HTML5 games. A child taps their own player, then taps a game; the launcher keeps each player's best scores and lets them continue where they left off. Success: a 5-year-old can start a game alone.

## Positioning
Games live in one friendly place with per-child progress, no accounts, no internet, no ads.

## Operating Context
JavaFX 21 desktop app (not a website: styled with JavaFX CSS, not browser CSS; the `web` platform value is the closest schema match). Layout: left player sidebar, main game grid, in-game overlay (Back / player / Scores), a Scores list with Play/Continue. Games run in an embedded WebView and take over the window.

## Capabilities and Constraints
- Must stay JavaFX CSS-implementable (no backdrop blur, no web fonts without bundling, limited effects).
- Player avatars are emojis; game icons are emoji or an image file.
- Keep all existing behavior and copy intent (New Player, Scores, Play/Continue).
- Empty state when no player exists; empty state when no games.

## Brand Commitments
Chosen with the user: full visual redesign, bright sticker-book feeling, audience kids 4-8.

## Evidence on Hand
Three sample games (rocket-run, froglet, nom-nom). No logo or brand assets exist; do not invent claims.

## Product Principles
- A non-reader can operate it: big targets, pictures over words.
- Every tap gives clear, playful feedback.
- The child's own player is always visible and obvious.
- Games are the stars; the launcher stays out of the way once a game starts.

## Accessibility & Inclusion
Large hit targets (>= 56px), strong contrast for text, state never conveyed by color alone.
