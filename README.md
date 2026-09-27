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

A fractional birthday is the point p/q of the way through a birthday-year, with p/q in lowest terms. The smaller the denominator, the more major it is. Denominators run from 2 to 12 in the Me view and from 2 to 13 in the Together view. The chips for turning individual denominators off are hidden for now; `SHOW_DENOMINATOR_PICKER` in `src/ui.ts` brings them back.

Every fractional birthday is counted three ways, and the page shows each distinct date with the ways of counting that give it. There is no switch between them.

| Mode | Year is | Exact denominators | Everything else |
|---|---|---|---|
| Months | 12 months, day-of-month kept | 2, 3, 4, 6, 12 | not counted this way |
| Weeks | 52 weeks = 364 days | 2, 4, 7, 13 | rounded to the nearest whole week, marked ≈ |
| Days | 365 or 366 days, the real span between anniversaries | depends on the year | rounded to the nearest day |

Details worth knowing:

- Month-mode dates are computed from the birth date in a single step and clamped to the end of the month once, so someone born on the 31st stays on the 31st in long months.
- Leap-day births have their anniversary on Feb 28 in common years, but their month-mode fractional birthdays stay on the 29th.
- In weeks mode a seventh of a year is exactly 52 days, and a thirteenth is exactly 4 weeks.
- The Me view lists each fractional birthday once, with every date the modes give it. The modes rarely disagree by more than a few days, and the list is ordered by the earliest of those dates that has not passed.
- When two fractions land on the same day for one person, the shared-celebration search counts that day as the one that is not rounded to the week (≈), and otherwise as the lower denominator.

### Shared celebrations

A shared celebration is a day on which every person has a fractional birthday, counted any of the three ways, within the chosen window (0 to 7 days, 0 by default). Days on which the same people celebrate the same fractional birthdays are one celebration that lists every such day. Candidates are ranked by the sum of everyone's denominators, then by the largest denominator, then by how tightly the dates cluster. Lower is better throughout.

### Entering birthdays

A birthday is typed as three number boxes, in the order the browser's locale writes dates (month, day, year for en-US). A date picker opens on today and has to be scrolled back decades, which is slow for a birthday. Typing a separator such as `/` moves to the next box, nothing moves focus on its own, and pasting a whole date fills all three. Impossible values are flagged as soon as they are typed, while an unfinished date is only pointed out once focus leaves the boxes.

## Layout

```
src/birthdate.ts  the birthday boxes: locale order, pasted dates, validation
src/dates.ts      calendar arithmetic on integer day numbers, no time zones
src/fractions.ts  reduced fractions, Farey enumeration, names
src/modes.ts      the three modes as strategy objects
src/events.ts     fractional birthdays for one person, by date and by fraction
src/mutual.ts     shared-celebration search and ranking
src/format.ts     Intl date formatting and small text helpers
src/kings.ts      the king whose numeral matches a denominator
src/ics.ts        iCalendar export
src/url.ts        app state and its round trip through the URL hash
src/ui.ts         the page (plain DOM, no framework)
tests/            Vitest unit tests for everything above except the UI
```

## King portraits

The next-up card shows the king whose numeral matches the fraction's denominator, blowing out the candles. The busts in `public/kings/` are cut out of public-domain paintings on Wikimedia Commons, each the lead image of its king's English Wikipedia article. Backgrounds were removed with macOS Vision subject lifting, the face and lips located with Vision face landmarks (the lip positions live in `src/kings.ts`), and kings looking to the right were mirrored so every one faces the candles:

| # | King | Source file |
|---|------|-------------|
| I | Francis I of France | François_Ier_Louvre.jpg (Jean Clouet) |
| II | Charles II of England | King_Charles_II_by_John_Michael_Wright_or_studio.jpg |
| III | George III | Allan_Ramsay_-_King_George_III_in_coronation_robes_-_Google_Art_Project.jpg |
| IV | Henri IV of France | Frans_Pourbus_the_Younger_…_Henri_IV,_King_of_France_…_RCIN_402972_-_Royal_Collection.jpg |
| V | Charles V, Holy Roman Emperor | Portrait_of_Charles_V,_Holy_Roman_Emperor,_seated_…_(Alte_Pinakothek,_Munich).jpg |
| VI | Henry VI of England | Henry_VI_of_England,_Shrewsbury_book.jpg |
| VII | Edward VII | King-Edward-VII_(cropped)_(b).jpg |
| VIII | Henry VIII | After_Hans_Holbein_the_Younger_-_Portrait_of_Henry_VIII_-_Google_Art_Project.jpg |
| IX | Louis IX of France | Saintlouis_(cropped).jpg |
| X | Charles X of France | Carlos_X_de_Francia_(François_Gérard).jpg |
| XI | Louis XI | Louis_XI_(1423-1483).jpg |
| XII | Charles XII of Sweden | Copy_Charles_XII_-_Nationalmuseum_-_17886.png |

`breath.gif` (and its still frame for reduced motion) is pixel art drawn for this project; its right edge is placed on the king's lips.
