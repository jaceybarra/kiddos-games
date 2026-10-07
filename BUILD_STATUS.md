# Build status

Legend:
- **Implemented**: the code exists and works in the browser during development.
- **Tested by automation**: unit tests or scripted browser runs cover it.
- **Tested with a child**: observed in a family playtest. Nothing has been tested with a child yet.

## Milestone 1: Windmill Kite slice (in progress)

| Area | Implemented | Tested by automation | Tested with a child |
| --- | --- | --- | --- |
| Project setup (Vite, TS, Phaser 4.2.1) | ✅ | typecheck | — |
| Art pipeline (SVG → atlas), 5 cast and 4 avatar puppets with 12 expressions | ✅ | SVG validity, rig references | — |
| Save system (IndexedDB/localStorage/memory, versioned, repair, quarantine, export/import) | ✅ | 13 unit tests | — |
| Session reminders (bounded grace, no chaining) | ✅ | 6 unit tests | — |
| Profiles, first-run setup, avatar picker | ✅ | scripted browser run | — |
| Windmill Kite (launcher route, mix-up, repair, decorate, fly) | ✅ | scripted full playthrough; puzzle and encounter unit tests | — |
| Windmill Kite (windmill/pumpkin and Rowan routes) | ✅ | not yet scripted | — |
| Map with quick jump | ✅ | partial | — |
| Clubhouse | placeholder | — | — |
| Adult area | ✅ (first version) | — | — |

## Next concrete step

Script the windmill route and the More help preset. Test refresh in the middle of the quest. Then build
the full clubhouse.
