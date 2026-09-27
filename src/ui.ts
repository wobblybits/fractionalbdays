/**
 * The page. Everything here is plain DOM; the interesting logic lives in the
 * pure modules it imports.
 */

import {
  PART_LENGTH,
  checkBirthParts,
  localeDateOrder,
  partsFromISO,
  splitPastedDate,
  type DatePart,
  type DateParts,
} from './birthdate';
import { candleRow } from './candles';
import { addMonthsClamped, toDayNumber, todayLocal, type DayNumber } from './dates';
import { occurrencesForPerson, primaryLabel, type Occurrence, type Person, type Source } from './events';
import { ageText, dayFormats, daysText, errorText, listText, methodsText, relativeDays } from './format';
import { denominatorWord, denominatorsUpTo, fractionName, type Fraction } from './fractions';
import { calendarForCelebrations, calendarForOccurrences } from './ics';
import { MODES, modesSupporting } from './modes';
import { byDenominator, rankCelebrations, type Celebration } from './mutual';
import {
  MAX_DENOMINATOR,
  MAX_WINDOW_DAYS,
  SOLO_MAX_DENOMINATOR,
  decodeState,
  defaultState,
  denominatorsForView,
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
/** The denominator chips are hidden for now. While they are, every view uses its full set of denominators. */
const SHOW_DENOMINATOR_PICKER = false;

const PART_LABEL: Record<DatePart, string> = { year: 'Year', month: 'Month', day: 'Day' };
const PART_PLACEHOLDER: Record<DatePart, string> = { year: 'YYYY', month: 'MM', day: 'DD' };
/** Typing one of these moves on to the next box, as a separator does in a native date field. */
const SEPARATOR_KEYS = new Set(['/', '-', '.', ',', ' ']);

/** What is typed in one person's birthday boxes, finished or not. */
interface BirthDraft {
  parts: DateParts;
  /** Focus has left the boxes at least once, so an unfinished date is worth pointing out. */
  left: boolean;
}

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

function fractionText(f: Fraction): Child[] {
  if (f.p === 0) return [h('span', { class: 'birthday-word' }, '\u{1F382} Birthday')];
  return [fractionNode(f), h('span', { class: 'fname' }, capitalize(fractionName(f)))];
}

/** "by weeks and days", or nothing when every mode that counts this denominator agrees on the date. */
function methodNote(sources: readonly Source[], q: number): string {
  return sources.length >= modesSupporting(q).length ? '' : `by ${methodsText(sources)}`;
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
  const state = readState();
  // A choice saved earlier or carried by a link could not be seen or undone while the chips are hidden.
  if (!SHOW_DENOMINATOR_PICKER) state.denominators = denominatorsUpTo(MAX_DENOMINATOR);
  return state;
}

function readState(): AppState {
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

const DENOMINATOR_HINT =
  'Every fraction is counted in weeks and in days. Halves, thirds, quarters, sixths and twelfths are also counted in months. The Me view stops at twelfths.';
const ROUNDED_LEGEND = ' ≈ marks a date rounded to the nearest week.';

function helpBody(): HTMLElement {
  return h(
    'div',
    { class: 'help-body' },
    h(
      'p',
      null,
      'A fractional birthday is the moment you are a simple fraction of the way from one birthday to the next. The smaller the denominator, the more major it is: a half birthday beats a third, which beats a quarter. Fractions are always in lowest terms, so six twelfths is simply a half.',
    ),
    h(
      'p',
      null,
      'There is more than one fair way to count a year, so every fractional birthday is worked out three ways: in months, in weeks and in days. They often agree. When they don’t, every date is listed with the way of counting that gives it.',
    ),
    MODES.map((mode) =>
      h('section', null, h('h3', null, `Counting in ${mode.name.toLowerCase()}`), mode.details.map((d) => h('p', null, d))),
    ),
    h('h3', null, 'Together'),
    h(
      'p',
      null,
      'A shared celebration is a day on which everyone has a fractional birthday, counted any of the three ways, within the chosen number of days. At 0 days, everyone’s date is that very day. Celebrations are ranked by adding up everyone’s denominators, lowest first. Ties go to the smaller largest denominator, then to the tighter spread of dates.',
    ),
    h(
      'p',
      null,
      'When the same fractional birthdays line up on more than one day, usually because the ways of counting land a day or two apart, they make one celebration that lists every day that works.',
    ),
    h(
      'p',
      null,
      'If two fractions land on the same day for one person, that day counts as the one that is not rounded to the week, and otherwise as the lower denominator.',
    ),
  );
}

export function mountApp(root: HTMLElement): void {
  let state = loadState();
  const today: DayNumber = toDayNumber(todayLocal());
  const horizon: DayNumber = toDayNumber(addMonthsClamped(todayLocal(), 12));
  const dateOrder = localeDateOrder();
  const drafts = new Map<string, BirthDraft>();
  let shownCelebrations = RANK_PAGE;

  // ----- shell -----------------------------------------------------------

  const tabButtons: Record<View, HTMLButtonElement> = {
    me: h('button', { type: 'button', role: 'tab', onClick: () => update({ view: 'me' }) }, 'Me'),
    together: h('button', { type: 'button', role: 'tab', onClick: () => update({ view: 'together' }) }, 'Together'),
  };

  const peopleList = h('div', { class: 'people-list' });
  const addButton = h('button', { type: 'button', class: 'btn ghost add', onClick: addPerson }, '+ Add a person');

  const chipButtons = new Map<number, HTMLButtonElement>();
  const denominatorField = SHOW_DENOMINATOR_PICKER ? denominatorPicker() : null;

  const windowInput = h('input', {
    type: 'range',
    id: 'window',
    min: 0,
    max: MAX_WINDOW_DAYS,
    step: 1,
    onInput: (e: Event) => update({ windowDays: Number((e.target as HTMLInputElement).value) }),
  });
  const windowOut = h('output', { for: 'window' });

  const settings = h(
    'section',
    { class: 'card settings' },
    denominatorField,
    h(
      'div',
      { class: 'field window-field' },
      h('label', { for: 'window', class: 'field-label' }, 'Celebrate within ', windowOut, ' of everyone’s date'),
      windowInput,
      h(
        'p',
        { class: 'hint' },
        'At 0, everyone’s fractional birthday falls on the celebration day itself. Allow a few days to find more dates.',
      ),
    ),
  );

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
    settings,
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
    drafts.clear();
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

  /** Chips for turning denominators on and off. Hidden for now, see SHOW_DENOMINATOR_PICKER. */
  function denominatorPicker(): HTMLElement {
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Denominators to include' });
    for (let q = 2; q <= MAX_DENOMINATOR; q++) {
      const plural = denominatorWord(q, true);
      const methods = listText(modesSupporting(q).map((m) => m.name.toLowerCase()));
      const button = h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': 'false',
          'aria-label': `${q}, ${plural}`,
          title: `${capitalize(plural)}, counted in ${methods}`,
          onClick: () => toggleDenominator(q),
        },
        String(q),
      );
      chipButtons.set(q, button);
      chips.append(button);
    }
    return h(
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
      h('p', { class: 'hint' }, DENOMINATOR_HINT),
    );
  }

  function toggleDenominator(q: number): void {
    const set = new Set(state.denominators);
    if (set.has(q)) set.delete(q);
    else set.add(q);
    update({ denominators: [...set].sort((a, b) => a - b) });
  }

  function setDenominators(preset: 'all' | 'classic' | 'none'): void {
    const all = denominatorsUpTo(MAX_DENOMINATOR);
    update({ denominators: preset === 'all' ? all : preset === 'classic' ? [2, 3, 4] : [] });
  }

  function addPerson(): void {
    state = { ...state, people: [...state.people, { id: newPersonId(), name: '', birth: '' }] };
    persist(state);
    renderPeople();
    renderResults();
    const names = peopleList.querySelectorAll<HTMLInputElement>('.person-row .name-input');
    names[names.length - 1]?.focus();
  }

  function removePerson(id: string): void {
    state = { ...state, people: state.people.filter((p) => p.id !== id) };
    drafts.delete(id);
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

  // ----- birthday boxes ------------------------------------------------------

  /**
   * Month, day and year as three number boxes in the locale's order. Nothing
   * moves focus on its own; typing a separator such as / moves to the next
   * box, and pasting a whole date fills all three.
   */
  function birthField(p: PersonInput, own: boolean, label: string, error: HTMLElement): HTMLElement {
    const draft = drafts.get(p.id) ?? { parts: partsFromISO(p.birth), left: false };
    drafts.set(p.id, draft);
    const group = h('div', { class: 'birth', role: 'group', 'aria-label': label });
    const boxes = new Map<DatePart, HTMLInputElement>();

    /** Shows what is wrong. An unfinished date waits until focus has left the boxes. */
    const check = (focusInside: boolean) => {
      const result = checkBirthParts(draft.parts, todayLocal());
      const unfinished = result.kind === 'partial' && draft.left && !focusInside;
      error.textContent = result.kind === 'invalid' || unfinished ? result.message : '';
      const wrong = result.kind === 'invalid' ? result.parts : [];
      for (const [part, box] of boxes) {
        if (wrong.includes(part)) box.setAttribute('aria-invalid', 'true');
        else box.removeAttribute('aria-invalid');
      }
      return result;
    };

    const commit = () => {
      const result = check(true);
      const birth = result.kind === 'valid' ? result.iso : '';
      if (state.people.find((x) => x.id === p.id)?.birth !== birth) changePerson(p.id, { birth });
    };

    const moveOn = (part: DatePart) => {
      const nextPart = dateOrder[dateOrder.indexOf(part) + 1];
      const next = nextPart ? boxes.get(nextPart) : undefined;
      next?.focus();
      next?.select();
    };

    for (const part of dateOrder) {
      const box = h('input', {
        type: 'text',
        inputmode: 'numeric',
        class: `part part-${part}`,
        value: draft.parts[part],
        placeholder: PART_PLACEHOLDER[part],
        maxlength: PART_LENGTH[part],
        autocomplete: own ? `bday-${part}` : 'off',
        'aria-label': PART_LABEL[part],
        'aria-describedby': error.id,
        onInput: () => {
          const digits = box.value.replace(/\D/g, '').slice(0, PART_LENGTH[part]);
          if (digits !== box.value) box.value = digits;
          draft.parts[part] = digits;
          commit();
        },
        onKeydown: (e: KeyboardEvent) => {
          // Leave shortcuts such as Ctrl or Cmd with minus (zoom out) to the browser.
          if (e.ctrlKey || e.metaKey || e.altKey || !SEPARATOR_KEYS.has(e.key)) return;
          e.preventDefault();
          if (box.value) moveOn(part);
        },
        onPaste: (e: ClipboardEvent) => {
          const pasted = splitPastedDate(e.clipboardData?.getData('text') ?? '', dateOrder);
          if (!pasted) return;
          e.preventDefault();
          draft.parts = pasted;
          for (const [name, target] of boxes) target.value = pasted[name];
          commit();
        },
        onBlur: () => {
          // Show a lone digit as 03, the way a saved date comes back.
          if (part === 'year' || !/^[1-9]$/.test(box.value)) return;
          box.value = `0${box.value}`;
          draft.parts[part] = box.value;
        },
      });
      boxes.set(part, box);
      group.append(box);
    }

    group.addEventListener('focusin', () => check(true));
    group.addEventListener('focusout', (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && group.contains(e.relatedTarget)) return;
      draft.left = true;
      check(false);
    });
    check(false);
    return group;
  }

  // ----- rendering ---------------------------------------------------------

  function personRow(p: PersonInput, index: number): HTMLElement {
    const who = index === 0 ? 'your' : `person ${index + 1}’s`;
    const nameInput = h('input', {
      type: 'text',
      class: 'name-input',
      value: p.name,
      placeholder: index === 0 ? 'You' : 'Name',
      maxlength: 60,
      autocomplete: 'off',
      'aria-label': `Name (${who})`,
      onInput: (e: Event) => changePerson(p.id, { name: (e.target as HTMLInputElement).value }),
    });
    const error = h('p', { class: 'field-error', id: `birth-error-${p.id}`, 'aria-live': 'polite' });
    return h(
      'div',
      { class: 'person-row' },
      h('div', { class: 'person-fields' }, nameInput, birthField(p, index === 0, capitalize(`${who} birthday`), error)),
      index === 0
        ? h('span', { class: 'icon-spacer', 'aria-hidden': 'true' })
        : h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remove person ${index + 1}`, onClick: () => removePerson(p.id) }, '×'),
      error,
    );
  }

  function renderPeople(): void {
    peopleList.replaceChildren(...state.people.map(personRow));
  }

  function renderControls(): void {
    app.classList.toggle('view-me', state.view === 'me');
    app.classList.toggle('view-together', state.view === 'together');
    for (const [view, button] of Object.entries(tabButtons)) {
      button.setAttribute('aria-selected', String(view === state.view));
    }
    // Without the chips, the Me view has nothing to set, so the whole card goes.
    settings.hidden = state.view === 'me' && !denominatorField;
    for (const [q, button] of chipButtons) {
      button.setAttribute('aria-pressed', String(state.denominators.includes(q)));
      button.hidden = state.view === 'me' && q > SOLO_MAX_DENOMINATOR;
    }

    const w = state.windowDays;
    windowInput.value = String(w);
    windowOut.textContent = w === 0 ? '0 days' : `±${w} ${w === 1 ? 'day' : 'days'}`;
    icsButton.textContent = state.view === 'me' ? 'Add to calendar (.ics)' : 'Export top dates (.ics)';
  }

  function renderResults(): void {
    results.replaceChildren(...(state.view === 'me' ? meView() : togetherView()));
  }

  function empty(message: string): HTMLElement {
    return h('div', { class: 'empty' }, message);
  }

  /** One date with the modes that give it, ≈ when it is only a rounded week, dimmed once it has passed. */
  function datedNode(date: DayNumber, sources: readonly Source[], q: number): HTMLElement {
    const note = methodNote(sources, q);
    const rounded = sources.every((s) => s.approx) ? sources[0] : undefined;
    const past = date < today;
    const notes = [
      rounded ? `Rounded to the nearest week, ${errorText(rounded.errorDays)}` : '',
      sources.some((s) => s.clamped) ? 'Moved to the end of a shorter month' : '',
      past ? 'Already passed' : '',
    ].filter(Boolean);
    return h(
      'span',
      { class: past ? 'dated past' : 'dated', title: notes.length > 0 ? notes.join('. ') : null },
      h('span', { class: 'dated-day' }, dayFormats.medium(date)),
      note ? ` ${note}` : null,
      rounded ? h('span', { class: 'approx' }, ' ≈') : null,
    );
  }

  /** The dates of one fractional birthday, when the modes disagree about it. */
  function datesList(o: Occurrence): HTMLElement | null {
    if (o.dates.length < 2) return null;
    return h(
      'ul',
      { class: 'dates', 'aria-label': 'Dates by way of counting' },
      o.dates.map((d) => h('li', null, datedNode(d.date, d.sources, o.q))),
    );
  }

  function meView(): HTMLElement[] {
    const me = firstPerson();
    if (!me) return [empty('Enter your birthday to see every fractional birthday in the next year.')];
    const occurrences = occurrencesForPerson(me, MODES, denominatorsForView(state, 'me'), today, horizon);
    const next = occurrences[0];
    if (!next) return [empty('Nothing falls in the next year.')];

    const nodes: HTMLElement[] = [
      h(
        'div',
        { class: `next-card tier-${tierOf(next.q)}` },
        h('div', { class: 'eyebrow' }, `Next up · ${relativeDays(today, next.date)}`),
        h('div', { class: 'next-fraction' }, fractionText(next), candleRow(next)),
        h('div', { class: 'next-date' }, dayFormats.full(next.date)),
        datesList(next),
        h('div', { class: 'next-age' }, `${turnPhrase(me.name)} `, ageNode(next.years, next)),
      ),
    ];
    if (occurrences.some((o) => o.dates.length > 1)) {
      const rounded = occurrences.some((o) => o.dates.some((d) => d.approx));
      nodes.push(
        h(
          'p',
          { class: 'intro' },
          'Counting the year in months, weeks or days can land a few days apart. When they disagree, each date says which way of counting gives it.',
          rounded ? ROUNDED_LEGEND : null,
        ),
      );
    }

    let currentMonth = '';
    let list: HTMLOListElement | null = null;
    // The first one is already in the Next up card.
    for (const o of occurrences.slice(1)) {
      const month = dayFormats.monthYear(o.date);
      if (month !== currentMonth) {
        currentMonth = month;
        nodes.push(h('h3', { class: 'month-head' }, month));
        list = h('ol', { class: 'events' });
        nodes.push(list);
      }
      list?.append(occurrenceRow(o));
    }
    return nodes;
  }

  function occurrenceRow(o: Occurrence): HTMLElement {
    return h(
      'li',
      { class: `event tier-${tierOf(o.q)}` },
      h(
        'div',
        { class: 'when' },
        h('span', { class: 'dow' }, dayFormats.weekdayShort(o.date)),
        h('span', { class: 'dom' }, dayFormats.dayOfMonth(o.date)),
      ),
      h(
        'div',
        { class: 'what' },
        h('div', { class: 'frac-line' }, fractionText(o)),
        h('div', { class: 'meta' }, ageNode(o.years, o), ' · ', relativeDays(today, o.date)),
        datesList(o),
      ),
    );
  }

  function togetherView(): HTMLElement[] {
    const people = validPeople(state);
    if (people.length < 2) return [empty('Add at least one more person with a birthday to find days you can all celebrate.')];
    const ranked = rankCelebrations(people, MODES, denominatorsForView(state, 'together'), today, horizon, state.windowDays);
    if (ranked.length === 0) {
      const hint =
        state.windowDays === 0
          ? 'No day in the next year is a fractional birthday for everyone at once. Allow a day or two of difference above to find near misses.'
          : 'No day in the next year lines up for everyone. Allow a few more days above.';
      return [empty(hint)];
    }

    const shown = ranked.slice(0, shownCelebrations);
    const count = `${ranked.length} shared ${ranked.length === 1 ? 'celebration' : 'celebrations'}`;
    const rounded = shown.some((c) => c.personEvents.some((events) => events.some((e) => primaryLabel(e).approx)));
    const nodes: HTMLElement[] = [
      h('p', { class: 'intro' }, `${count} in the next 12 months, most major first.`, rounded ? ROUNDED_LEGEND : null),
      h('ol', { class: 'celebrations' }, shown.map((c, i) => celebrationItem(c, i + 1, people))),
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

  /** The day or days, then who celebrates what, most major fraction first, with the dates each fraction falls on. */
  function celebrationItem(c: Celebration, rank: number, people: Person[]): HTMLElement {
    return h(
      'li',
      { class: `celebration tier-${tierOf(c.maxQ)}` },
      h('div', { class: 'rank', 'aria-label': `Rank ${rank}` }, rank),
      h(
        'div',
        { class: 'cel-body' },
        h('div', { class: 'cel-date' }, daysText(c.days)),
        h(
          'ul',
          { class: 'cel-people' },
          byDenominator(c).map(({ index, event }) => {
            const label = primaryLabel(event);
            const dated = (c.personEvents[index] ?? [event]).map((e) => datedNode(e.date, primaryLabel(e).sources, label.q));
            return h(
              'li',
              null,
              h('span', { class: 'who' }, people[index]?.name ?? '?'),
              h('span', { class: 'cel-frac' }, label.p === 0 ? '\u{1F382}' : fractionNode(label)),
              h('span', { class: 'cel-on' }, dated),
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
    if (state.view === 'me') {
      const me = firstPerson();
      if (!me) return toast('Enter a birthday first');
      const occurrences = occurrencesForPerson(me, MODES, denominatorsForView(state, 'me'), today, horizon);
      download('fractional-birthdays.ics', calendarForOccurrences(occurrences, me));
    } else {
      const people = validPeople(state);
      if (people.length < 2) return toast('Add more people first');
      const ranked = rankCelebrations(people, MODES, denominatorsForView(state, 'together'), today, horizon, state.windowDays);
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
