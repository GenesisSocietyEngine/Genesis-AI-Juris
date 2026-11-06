# CaseVant Line icon language

Original 34-symbol set, applied to workspace navigation, case sections and work commands. Source: `app/CaseVantIcon.tsx`; visual catalogue: `public/brand/casevant-line-icons.svg` (published at `/brand/casevant-line-icons.svg`). The catalogue is a reference sheet; application icons use the shared React component.

- Draw on a 24 × 24 grid with 1.65-unit open strokes, round ends/joins and restrained clipped document/case corners. Default rendered size is 20 × 20.
- Inherit `currentColor`; selected navigation uses the existing blue accent, ordinary commands inherit their readable foreground. Preserve forced-color support.
- Keep a visible text label beside actions. SVGs are decorative (`aria-hidden`, non-focusable); the button/link owns its accessible name and keyboard behavior.
- Use distinct symbols for tasks, calendar, reminders, applied workflows and reusable templates. Do not substitute emoji or filled dashboard tiles.
- Never insert SVG into native select options. Use text options and place decorative hints outside native form controls.
- Add future paths to the shared module and update the catalogue. Check the last row, 390px labels, keyboard focus and contrast in the actual interface. Do not duplicate vendor assets.

The published v183 catalogue was visually inspected: all 34 symbols, including the final row, fit its 960 × 600 canvas. Native options contain no SVG and icons do not introduce focus stops. Later firm People, Workflows and Case overview views reuse the same collection.
