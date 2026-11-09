## Naming conventions

Use kebab-case for every file and folder, screens included (icon files are the one exception, see below); casing for identifiers is handled inside the code. Mixed file casing breaks on case-sensitive Linux CI and servers, and Git does not reliably track case-only renames.

| Thing                                              | Convention           | Example                                                               |
| -------------------------------------------------- | -------------------- | --------------------------------------------------------------------- |
| Files and folders                                  | kebab-case           | `home-screen.tsx`, `game-lobby/`                                      |
| Icon files (`src/lib/icons`)                       | `<name>.icon.tsx`    | `coin.icon.tsx`, `ozCoins.icon.tsx`                                   |
| Route folders                                      | kebab-case           | `app/play/[game-id]/page.tsx`                                         |
| React components, types, interfaces                | PascalCase           | `export function HomeScreen()`, `type GameEntry`                      |
| Variables, functions                               | camelCase            | `loadCatalogue()`, `currentScore`                                     |
| Hooks                                              | camelCase with `use` | `useGameSession()`                                                    |
| Constants                                          | UPPER_SNAKE          | `MAX_PLAYERS`, `STORAGE_PREFIX`                                       |
| Game ids, CSS classes, CSS variables, storage keys | kebab-case           | `penalty-cup`, `--color-pitch-green`, `statoz.games.penalty-cup.save` |
| JSON or API fields                                 | camelCase            | `{ "gameId": "...", "sizeBytes": 0 }`                                 |

A file is kebab-case and the component it exports is PascalCase: `home-screen.tsx` exports `HomeScreen`. Never name a component in camelCase; React treats `<homeScreen />` as an HTML tag.

Icon files end in `.icon.tsx`, and a multi-word name is camelCase: `ozCoins.icon.tsx` exports `OzCoinsIcon`. The shared base is `svg.icon.tsx`.

## Code style

- Write minimal, clean, and efficient code without unnecessary complexity.
- Use Tailwind classes. Use a CSS module only when Tailwind can't express it.
- No `any`. Use `unknown` and narrow it.
- Keep comments short and explain why, not what.
- Don't read or print `.env` files.
- Whatever is asked to do, just do that, never take decisions on your own and always ask whenever you are in a confusion.
- Always give the best suggestions whenever I ask something, don't just agree to me blindly.
- Never edit this file `CLAUDE.md` & `AGENTS.md` without asking first.
- Don't touch any file unnecessarily for making any changes that is not related to the given instructions
- Never run a formatter (`npm run format`, `npx prettier --write` or any other) unless asked.
- Whenever creating a css file add it in the css folder of that level.
- When removing a wrapper element, check every style that relied on it.
- Check layout changes at both phone and desktop width before calling them done.
- If by any chance, the user misses selecting the options of the questions you asked, ask them again, never take any decisions on your own in any condition.
- Whenever creating a sample data always create a sample-data.ts file and add in those.
