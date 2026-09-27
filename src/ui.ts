/**
 * The page. Everything here is plain DOM; the interesting logic lives in the
 * pure modules it imports.
 */

import { addMonthsClamped, toDayNumber, toISODate, todayLocal, type DayNumber } from './dates';
import { eventsForPerson, primaryLabel, type BirthdayEvent, type FractionLabel, type Person } from './events';
import { ageText, dayFormats, errorText, relativeDays } from './format';
import { denominatorWord, fractionName, type Fraction } from './fractions';
import { calendarForCelebrations, calendarForEvents } from './ics';
import { MODES, modeById, type Mode } from './modes';
import { rankCelebrations, type Celebration } from './mutual';
import {
  MAX_DENOMINATOR,
  MAX_WINDOW_DAYS,
  decodeState,
  defaultState,
  encodeState,
  newPersonId,
  validPeople,
  type AppState,
  type PersonInput,
  type View,
} from './url';

const STORAGE_KEY = 'fractionalbdays.state.v1';
const RANK_PAGE = 20;
const ICS_LIMIT = 60;

type Child = Node | string | number | boolean | null | undefined | Child[];

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = String(value);
      else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(value));
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el: ParentNode, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || typeof child === 'boolean') continue;
    if (Array.isArray(child)) appendChildren(el, child);
    else el.append(child instanceof Node ? child : String(child));
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** How major a denominator is, 0 (the birthday itself) to 4 (fine fractions). */
function tierOf(q: number): number {
  if (q === 1) return 0;
  if (q === 2) return 1;
  if (q <= 4) return 2;
  if (q <= 7) return 3;
  return 4;
}

function fractionNode(f: Fraction, extraClass = ''): HTMLElement {
  return h(
    'span',
    { class: `frac ${extraClass}`.trim(), role: 'img', 'aria-label': `${f.p}/${f.q}` },
    h('span', { class: 'n', 'aria-hidden': 'true' }, f.p),
    h('span', { class: 'bar', 'aria-hidden': 'true' }, '⁄'),
    h('span', { class: 'd', 'aria-hidden': 'true' }, f.q),
  );
}

function ageNode(years: number, f: Fraction): HTMLElement {
  return h(
    'span',
    { class: 'age', role: 'img', 'aria-label': ageText(years, f) },
    h('span', { 'aria-hidden': 'true' }, years, f.p === 0 ? null : fractionNode(f)),
  );
}

function fractionText(label: FractionLabel, flagRounding: boolean): Child[] {
  if (label.p === 0) return [h('span', { class: 'birthday-word' }, '\u{1F382} Birthday')];
  const flagged = flagRounding && !label.exact;
  return [
    fractionNode(label),
    h(
      'span',
      { class: 'fname' },
      capitalize(fractionName(label)),
      flagged ? h('span', { class: 'approx', title: 'Rounded' }, ' \u2248') : null,
    ),
  ];
}

function turnPhrase(name: string): string {
  return name === 'You' ? 'You turn' : `${name} turns`;
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toast(message: string): void {
  const el = h('div', { class: 'toast', role: 'status' }, message);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 2200);
}

function loadState(): AppState {
  const hash = location.hash.replace(/^#/, '');
  if (hash) return decodeState(hash);
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return decodeState(stored);
  } catch {
    /* storage unavailable */
  }
  return defaultState();
}

function persist(state: AppState): void {
  const encoded = encodeState(state);
  history.replaceState(null, '', `#${encoded}`);
  try {
    localStorage.setItem(STORAGE_KEY, encoded);
  } catch {
    /* storage unavailable */
  }
}

function denominatorHint(mode: Mode): string {
  switch (mode.id) {
    case 'months':
      return 'Only whole months exist here, so the choice is halves, thirds, quarters, sixths and twelfths.';
    case 'weeks':
      return 'Halves, quarters, sevenths and thirteenths are exact. ≈ marks fractions rounded to the nearest week.';
    case 'days':
      return 'Everything rounds to the nearest day, never more than half a day off.';
  }
}

function helpBody(): HTMLElement {
  return h(
    'div',
    { class: 'help-body' },
    h(
      'p',
      null,
      'A fractional birthday is the moment you are a simple fraction of the way from one birthday to the next. The smaller the denominator, the more major it is: a half birthday beats a third, which beats a quarter. Fractions are always in lowest terms, so six twelfths is simply a half.',
    ),
    MODES.map((mode) =>
      h('section', null, h('h3', null, mode.name), mode.details.map((d) => h('p', null, d))),
    ),
    h('h3', null, 'Together'),
    h(
      'p',
      null,
      'A shared celebration is a day on which everyone has a fractional birthday within the chosen number of days. Shared days are ranked by adding up everyone’s denominators, lowest first. Ties go to the smaller largest denominator, then to the tighter spread of dates.',
    ),
    h(
      'p',
      null,
      'When two fractions land on the same day for one person, the exact one is the main label, and otherwise the lower denominator. The other fraction is still listed.',
    ),
  );
}

export function mountApp(root: HTMLElement): void {
  let state = loadState();
  const today: DayNumber = toDayNumber(todayLocal());
  const horizon: DayNumber = toDayNumber(addMonthsClamped(todayLocal(), 12));
  let shownCelebrations = RANK_PAGE;

  // ----- shell -----------------------------------------------------------

  const tabButtons: Record<View, HTMLButtonElement> = {
    me: h('button', { type: 'button', role: 'tab', onClick: () => update({ view: 'me' }) }, 'Me'),
    together: h('button', { type: 'button', role: 'tab', onClick: () => update({ view: 'together' }) }, 'Together'),
  };

  const peopleList = h('div', { class: 'people-list' });
  const addButton = h('button', { type: 'button', class: 'btn ghost add', onClick: addPerson }, '+ Add a person');

  const modeButtons = new Map<string, HTMLButtonElement>();
  const modeSegment = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Measure the year in' });
  for (const mode of MODES) {
    const button = h(
      'button',
      { type: 'button', role: 'radio', 'aria-checked': 'false', onClick: () => update({ mode: mode.id }) },
      mode.name,
    );
    modeButtons.set(mode.id, button);
    modeSegment.append(button);
  }
  const modeHint = h('p', { class: 'hint' });

  const chipButtons = new Map<number, HTMLButtonElement>();
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Denominators to include' });
  for (let q = 2; q <= MAX_DENOMINATOR; q++) {
    const button = h(
      'button',
      { type: 'button', class: 'chip', 'aria-pressed': 'false', onClick: () => toggleDenominator(q) },
      String(q),
      h('span', { class: 'mark', 'aria-hidden': 'true' }),
    );
    chipButtons.set(q, button);
    chips.append(button);
  }
  const denomHint = h('p', { class: 'hint' });

  const windowInput = h('input', {
    type: 'range',
    id: 'window',
    min: 0,
    max: MAX_WINDOW_DAYS,
    step: 1,
    onInput: (e: Event) => update({ windowDays: Number((e.target as HTMLInputElement).value) }),
  });
  const windowOut = h('output', { for: 'window' });

  const results = h('main', { class: 'results', 'aria-live': 'polite' });
  const icsButton = h('button', { type: 'button', class: 'btn ghost', onClick: exportCalendar }, 'Download .ics');
  const shareButton = h('button', { type: 'button', class: 'btn', onClick: share }, 'Share link');

  const app = h(
    'div',
    { class: 'app' },
    h(
      'header',
      { class: 'hero' },
      h('h1', null, 'Fractional ', h('span', null, 'Birthdays')),
      h('p', { class: 'tagline' }, 'Half birthdays, third birthdays, and the days a whole group can celebrate at once.'),
    ),
    h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'View' }, tabButtons.me, tabButtons.together),
    h('section', { class: 'card people' }, h('h2', { class: 'card-title' }, 'Birthdays'), peopleList, addButton),
    h(
      'section',
      { class: 'card settings' },
      h('div', { class: 'field' }, h('div', { class: 'field-label' }, 'Measure the year in'), modeSegment, modeHint),
      h(
        'div',
        { class: 'field' },
        h('div', { class: 'field-label' }, 'Fractions to include, by denominator'),
        chips,
        h(
          'div',
          { class: 'chip-actions' },
          h('button', { type: 'button', class: 'linkish', onClick: () => setDenominators('all') }, 'All'),
          h('button', { type: 'button', class: 'linkish', onClick: () => setDenominators('classic') }, 'Halves, thirds, quarters'),
          h('button', { type: 'button', class: 'linkish', onClick: () => setDenominators('none') }, 'None'),
        ),
        denomHint,
      ),
      h(
        'div',
        { class: 'field window-field' },
        h('label', { for: 'window', class: 'field-label' }, 'Celebrate within ', windowOut, ' of everyone’s date'),
        windowInput,
        h('p', { class: 'hint' }, 'Set to 0 for days where the fractional birthdays coincide exactly.'),
      ),
    ),
    results,
    h('section', { class: 'actions' }, shareButton, icsButton),
    h('details', { class: 'card help' }, h('summary', null, 'How the math works'), helpBody()),
    h('footer', { class: 'foot' }, 'Everything runs in your browser. Birthdays live only in the link and on this device.'),
  );
  root.replaceChildren(app);

  renderPeople();
  renderControls();
  renderResults();

  window.addEventListener('hashchange', () => {
    state = loadState();
    renderPeople();
    renderControls();
    renderResults();
  });

  // ----- state -----------------------------------------------------------

  function update(patch: Partial<AppState>): void {
    state = { ...state, ...patch };
    shownCelebrations = RANK_PAGE;
    persist(state);
    renderControls();
    renderResults();
  }

  function toggleDenominator(q: number): void {
    const set = new Set(state.denominators);
    if (set.has(q)) set.delete(q);
    else set.add(q);
    update({ denominators: [...set].sort((a, b) => a - b) });
  }

  function setDenominators(preset: 'all' | 'classic' | 'none'): void {
    const all: number[] = [];
    for (let q = 2; q <= MAX_DENOMINATOR; q++) all.push(q);
    update({ denominators: preset === 'all' ? all : preset === 'classic' ? [2, 3, 4] : [] });
  }

  function addPerson(): void {
    state = { ...state, people: [...state.people, { id: newPersonId(), name: '', birth: '' }] };
    persist(state);
    renderPeople();
    renderResults();
    const rows = peopleList.querySelectorAll<HTMLInputElement>('.person-row input[type="text"]');
    rows[rows.length - 1]?.focus();
  }

  function removePerson(id: string): void {
    state = { ...state, people: state.people.filter((p) => p.id !== id) };
    persist(state);
    renderPeople();
    renderResults();
  }

  function changePerson(id: string, patch: Partial<PersonInput>): void {
    state = { ...state, people: state.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    shownCelebrations = RANK_PAGE;
    persist(state);
    renderResults();
  }

  // ----- rendering ---------------------------------------------------------

  function personRow(p: PersonInput, index: number): HTMLElement {
    const who = index === 0 ? 'your' : `person ${index + 1}’s`;
    const onName = (e: Event) => changePerson(p.id, { name: (e.target as HTMLInputElement).value });
    const onBirth = (e: Event) => changePerson(p.id, { birth: (e.target as HTMLInputElement).value });
    const nameInput = h('input', {
      type: 'text',
      value: p.name,
      placeholder: index === 0 ? 'You' : 'Name',
      maxlength: 60,
      autocomplete: 'off',
      'aria-label': `Name (${who})`,
      onInput: onName,
    });
    const birthInput = h('input', {
      type: 'date',
      value: p.birth,
      min: '1900-01-01',
      max: toISODate(todayLocal()),
      'aria-label': capitalize(`${who} birthday`),
      onInput: onBirth,
      onChange: onBirth,
    });
    return h(
      'div',
      { class: 'person-row' },
      h('div', { class: 'person-fields' }, nameInput, birthInput),
      index === 0
        ? null
        : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove person ${index + 1}`, onClick: () => removePerson(p.id) }, '×'),
    );
  }

  function renderPeople(): void {
    peopleList.replaceChildren(...state.people.map(personRow));
  }

  function renderControls(): void {
    const mode = modeById(state.mode);
    app.classList.toggle('view-me', state.view === 'me');
    app.classList.toggle('view-together', state.view === 'together');
    for (const [view, button] of Object.entries(tabButtons)) {
      button.setAttribute('aria-selected', String(view === state.view));
    }
    for (const [id, button] of modeButtons) button.setAttribute('aria-checked', String(id === mode.id));
    modeHint.textContent = mode.summary;

    for (const [q, button] of chipButtons) {
      const status = mode.status(q);
      const note =
        status === 'unsupported'
          ? `not a whole number of ${mode.name.toLowerCase()}`
          : status === 'rounded' && mode.flagRounding
            ? 'rounded to the nearest week'
            : 'exact';
      button.setAttribute('aria-pressed', String(state.denominators.includes(q)));
      button.setAttribute('aria-label', `${q}, ${note}`);
      button.disabled = status === 'unsupported';
      button.title = capitalize(note);
      const mark = button.querySelector('.mark');
      if (mark) mark.textContent = status === 'rounded' && mode.flagRounding ? '\u2248' : '';
    }
    denomHint.textContent = denominatorHint(mode);

    windowInput.value = String(state.windowDays);
    windowOut.textContent = `±${state.windowDays} ${state.windowDays === 1 ? 'day' : 'days'}`;
    icsButton.textContent = state.view === 'me' ? 'Add to calendar (.ics)' : 'Export top dates (.ics)';
  }

  function renderResults(): void {
    results.replaceChildren(...(state.view === 'me' ? meView() : togetherView()));
  }

  function empty(message: string): HTMLElement {
    return h('div', { class: 'empty' }, message);
  }

  function meView(): HTMLElement[] {
    const me = firstPerson();
    if (!me) return [empty('Enter your birthday to see every fractional birthday in the next year.')];
    const mode = modeById(state.mode);
    const events = eventsForPerson(me, mode, state.denominators, today, horizon);
    if (events.length === 0) return [empty('No fractions are selected. Turn some denominators back on above.')];

    const next = events[0]!;
    const nextLabel = primaryLabel(next);
    const nodes: HTMLElement[] = [
      h(
        'div',
        { class: `next-card tier-${tierOf(nextLabel.q)}` },
        h('div', { class: 'eyebrow' }, `Next up · ${relativeDays(today, next.date)}`),
        h('div', { class: 'next-fraction' }, fractionText(nextLabel, mode.flagRounding)),
        h('div', { class: 'next-date' }, dayFormats.full(next.date)),
        h('div', { class: 'next-age' }, `${turnPhrase(me.name)} `, ageNode(next.years, nextLabel)),
      ),
    ];

    let currentMonth = '';
    let list: HTMLOListElement | null = null;
    for (const event of events) {
      const month = dayFormats.monthYear(event.date);
      if (month !== currentMonth) {
        currentMonth = month;
        nodes.push(h('h3', { class: 'month-head' }, month));
        list = h('ol', { class: 'events' });
        nodes.push(list);
      }
      list?.append(eventRow(event, mode));
    }
    return nodes;
  }

  function eventRow(event: BirthdayEvent, mode: Mode): HTMLElement {
    const label = primaryLabel(event);
    const others = event.labels.slice(1);
    const meta: Child[] = [ageNode(event.years, label), ' · ', relativeDays(today, event.date)];
    if (mode.flagRounding && !label.exact) meta.push(' · ', `rounded, ${errorText(label.errorDays)}`);
    if (label.clamped) meta.push(' · ', 'moved to the end of the month');
    if (others.length > 0) {
      meta.push(' · also ');
      others.forEach((o, i) => {
        if (i > 0) meta.push(', ');
        meta.push(fractionNode(o), mode.flagRounding && !o.exact ? '\u2248' : '');
      });
    }
    return h(
      'li',
      { class: `event tier-${tierOf(label.q)}` },
      h(
        'div',
        { class: 'when' },
        h('span', { class: 'dow' }, dayFormats.weekdayShort(event.date)),
        h('span', { class: 'dom' }, dayFormats.dayOfMonth(event.date)),
      ),
      h('div', { class: 'what' }, h('div', { class: 'frac-line' }, fractionText(label, mode.flagRounding)), h('div', { class: 'meta' }, meta)),
    );
  }

  function togetherView(): HTMLElement[] {
    const people = validPeople(state);
    if (people.length < 2) return [empty('Add at least one more person with a birthday to find days you can all celebrate.')];
    const mode = modeById(state.mode);
    const ranked = rankCelebrations(people, mode, state.denominators, today, horizon, state.windowDays);
    if (ranked.length === 0) {
      const hint =
        mode.id === 'months'
          ? 'In months mode every date keeps its own day of the month, so a group only lines up when those days are close together. Allow a few more days, or switch to weeks or days.'
          : 'Allow a few more days, or switch to days for the most possible dates.';
      return [empty(`No day in the next year lines up for everyone. ${hint}`)];
    }

    const shown = ranked.slice(0, shownCelebrations);
    const nodes: HTMLElement[] = [
      h('p', { class: 'intro' }, `${ranked.length} shared ${ranked.length === 1 ? 'date' : 'dates'} in the next 12 months, most major first.`),
      h('ol', { class: 'celebrations' }, shown.map((c, i) => celebrationItem(c, i + 1, people, mode))),
    ];
    if (ranked.length > shown.length) {
      nodes.push(
        h(
          'button',
          {
            type: 'button',
            class: 'btn ghost more',
            onClick: () => {
              shownCelebrations += RANK_PAGE;
              renderResults();
            },
          },
          `Show ${Math.min(RANK_PAGE, ranked.length - shown.length)} more`,
        ),
      );
    }
    return nodes;
  }

  function celebrationItem(c: Celebration, rank: number, people: Person[], mode: Mode): HTMLElement {
    const dateText = c.first === c.last ? dayFormats.full(c.first) : `${dayFormats.medium(c.first)} – ${dayFormats.medium(c.last)}`;
    const quality =
      c.maxQ === 1 ? 'everyone on their actual birthday' : `everyone at ${denominatorWord(c.maxQ, true)} or better`;
    const spread = c.spread === 0 ? '' : ` · ${c.spread} ${c.spread === 1 ? 'day' : 'days'} apart`;
    return h(
      'li',
      { class: `celebration tier-${tierOf(c.maxQ)}` },
      h('div', { class: 'rank', 'aria-label': `Rank ${rank}` }, rank),
      h(
        'div',
        { class: 'cel-body' },
        h('div', { class: 'cel-date' }, dateText),
        h('div', { class: 'cel-score' }, `Score ${c.sumQ} · ${quality}${spread}`),
        h(
          'ul',
          { class: 'cel-people' },
          c.events.map((e, i) => {
            const label = primaryLabel(e);
            return h(
              'li',
              null,
              h('span', { class: 'who' }, people[i]?.name ?? '?'),
              h('span', { class: 'cel-frac' }, label.p === 0 ? '\u{1F382}' : fractionNode(label)),
              ageNode(e.years, label),
              mode.flagRounding && !label.exact ? h('span', { class: 'approx' }, '\u2248') : null,
              h('span', { class: 'cel-on' }, dayFormats.medium(e.date)),
            );
          }),
        ),
      ),
    );
  }

  function firstPerson(): Person | undefined {
    const firstId = state.people[0]?.id;
    return validPeople(state).find((p) => p.id === firstId);
  }

  // ----- actions -----------------------------------------------------------

  function exportCalendar(): void {
    const mode = modeById(state.mode);
    if (state.view === 'me') {
      const me = firstPerson();
      if (!me) return toast('Enter a birthday first');
      const events = eventsForPerson(me, mode, state.denominators, today, horizon);
      download('fractional-birthdays.ics', calendarForEvents(events, me, mode.name));
    } else {
      const people = validPeople(state);
      if (people.length < 2) return toast('Add more people first');
      const ranked = rankCelebrations(people, mode, state.denominators, today, horizon, state.windowDays);
      if (ranked.length === 0) return toast('Nothing to export yet');
      download('shared-fractional-birthdays.ics', calendarForCelebrations(ranked.slice(0, ICS_LIMIT), people));
    }
  }

  async function share(): Promise<void> {
    const url = location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Fractional Birthdays', url });
        return;
      } catch {
        /* cancelled or unsupported, fall through to copying */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast(url);
    }
  }
}
