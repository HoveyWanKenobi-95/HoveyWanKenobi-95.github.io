# Pocket Mahjong — Browser Edition

A static HTML/CSS/JavaScript port of Pocket Mahjong. No build tools, servers, or dependencies.

## Publish with GitHub Pages

1. Extract this ZIP.
2. Upload the **contents** of `pocket_mahjong_web/` (index.html, style.css, game.js, assets/) to a `mahjong/` folder in your GitHub Pages repository.
3. Commit changes. The game will be at `https://YOUR-USERNAME.github.io/mahjong/` for a username.github.io repository, or `https://YOUR-USERNAME.github.io/REPOSITORY/mahjong/` for a project repository.
4. Link to the game from your homepage.

## Local testing

From the extracted folder, run `python -m http.server 8000` and visit `http://localhost:8000`.

## Features

- 11 layouts, including four phone-friendly Pocket layouts
- Solvable board generation (at least one legal solution on creation)
- Match free identical tiles, store tiles, undo, restart, and new game
- Auto-save and resume with browser localStorage
- Responsive portrait/landscape layout; original tile PNG artwork
- No ads, tracking, or external dependencies

Notes: Browser saves are separate from Android saves. Clearing site data or using private browsing can erase progress. Browser gameplay is a JavaScript port, not a Kivy compilation.
