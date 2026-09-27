# Fractional Birthdays

A mobile-first static site that finds your fractional birthdays (half, third, quarter and so on) and ranks the days on which a whole group can celebrate together.

Everything runs in the browser. There is no backend, and birthdays only ever live in the page URL and in the device's local storage.

## Running it

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (Vitest)
npm run build     # type-check and build to dist/
```

`dist/` is plain static files with relative paths, so it can be dropped on GitHub Pages, Cloudflare Pages, Netlify or any web server.

## Deploying

Every push to `main` runs `.github/workflows/deploy.yml`, which installs dependencies, runs the tests, builds the site and publishes `dist/` to GitHub Pages. It can also be started by hand from the Actions tab.

Pages has to be switched on once per repository, with the source set to "GitHub Actions" (Settings, then Pages), because the workflow's own token is not allowed to do it. For this repository that is done, and the site lives at https://wobblybits.github.io/fractionalbdays/.

## How the math works

A fractional birthday is the point p/q of the way through a birthday-year, with p/q in lowest terms. The smaller the denominator, the more major it is. Denominators run from 2 to 13 and can be toggled individually.

Three ways of measuring the year are offered:

| Mode | Year is | Exact denominators | Everything else |
|---|---|---|---|
| Months | 12 months, day-of-month kept | 2, 3, 4, 6, 12 | not offered |
| Weeks | 52 weeks = 364 days | 2, 4, 7, 13 | rounded to the nearest whole week, marked ≈ |
| Days | 365 or 366 days, the real span between anniversaries | depends on the year | rounded to the nearest day |

Details worth knowing:

- Month-mode dates are computed from the birth date in a single step and clamped to the end of the month once, so someone born on the 31st stays on the 31st in long months.
- Leap-day births have their anniversary on Feb 28 in common years, but their month-mode fractional birthdays stay on the 29th.
- In weeks mode a seventh of a year is exactly 52 days, and a thirteenth is exactly 4 weeks.
- When two fractions land on the same day for one person, the exact one is the main label, otherwise the lower denominator wins. The other fraction is still shown.

### Shared celebrations

A shared celebration is a day on which every person has a fractional birthday within the chosen window (0 to 7 days). Candidates are ranked by the sum of everyone's denominators, then by the largest denominator, then by how tightly the dates cluster. Lower is better throughout.

## Layout

```
src/dates.ts      calendar arithmetic on integer day numbers, no time zones
src/fractions.ts  reduced fractions, Farey enumeration, names
src/modes.ts      the three modes as strategy objects
src/events.ts     fractional birthdays for one person in a date window
src/mutual.ts     shared-celebration search and ranking
src/format.ts     Intl date formatting and small text helpers
src/ics.ts        iCalendar export
src/url.ts        app state and its round trip through the URL hash
src/ui.ts         the page (plain DOM, no framework)
tests/            Vitest unit tests for everything above except the UI
```
