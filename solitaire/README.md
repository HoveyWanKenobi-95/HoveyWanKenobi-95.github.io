# HoveyBits Solitaire (web)

Upload the **contents** of this folder to `/solitaire/` in your GitHub Pages repository.

## Your original card artwork

Copy your 52 PNG files into `solitaire/assets/deck/` using these names:
`Hearts_A.png`, `Hearts_2.png` … `Hearts_K.png` (also Diamonds, Clubs, Spades).

A generated `Back.png` is included. You may replace it with your own.

If a face image is missing, the game displays a legible fallback card instead.

## Link from homepage

```html
<a class="button" href="solitaire/">♠ Play Solitaire</a>
```

## Features

Draw-one and draw-three, fanned waste, click-to-move tableau runs, foundations, undo, auto foundation, endgame Finish, automatic browser save/restore, responsive UI and About dialog.

No build tools, packages or external dependencies needed. Web saves are separate from the Android app.
