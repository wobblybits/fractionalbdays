import { describe, expect, it } from 'vitest';
import { decodeState, defaultState, encodeState, validPeople, type AppState } from '../src/url';

describe('state in the URL', () => {
  it('round-trips a full state', () => {
    const state: AppState = {
      view: 'together',
      mode: 'weeks',
      denominators: [2, 3, 4, 7, 13],
      windowDays: 2,
      people: [
        { id: 'a', name: 'Sam', birth: '1990-07-04' },
        { id: 'b', name: 'A|B; C~D&E=F', birth: '1988-11-30' },
        { id: 'c', name: '', birth: '2001-02-28' },
      ],
    };
    const decoded = decodeState(encodeState(state));
    expect(decoded.view).toBe('together');
    expect(decoded.mode).toBe('weeks');
    expect(decoded.denominators).toEqual([2, 3, 4, 7, 13]);
    expect(decoded.windowDays).toBe(2);
    expect(decoded.people.map((p) => [p.name, p.birth])).toEqual([
      ['Sam', '1990-07-04'],
      ['A|B; C~D&E=F', '1988-11-30'],
      ['', '2001-02-28'],
    ]);
  });

  it('omits the denominator list when everything is selected', () => {
    expect(encodeState(defaultState())).not.toContain('q=');
  });

  it('falls back on garbage', () => {
    const decoded = decodeState('#v=nope&m=fortnights&q=1,99,x,5&w=42&p=Only%7Cnot-a-date');
    expect(decoded.view).toBe('me');
    expect(decoded.mode).toBe('months');
    expect(decoded.denominators).toEqual([5]);
    expect(decoded.windowDays).toBe(3);
    expect(decoded.people).toHaveLength(1);
    expect(decoded.people[0]).toMatchObject({ name: 'Only', birth: '' });
  });

  it('returns the default for an empty hash', () => {
    const decoded = decodeState('');
    expect(decoded.people).toHaveLength(1);
    expect(decoded.denominators).toHaveLength(12);
  });

  it('lists only people with usable birthdays and fills in names', () => {
    const state = defaultState();
    state.people = [
      { id: 'a', name: '', birth: '1990-07-04' },
      { id: 'b', name: '  ', birth: '' },
      { id: 'c', name: 'Zed', birth: '1999-02-29' },
      { id: 'd', name: '', birth: '2000-02-29' },
    ];
    expect(validPeople(state).map((p) => [p.name, p.birth.y])).toEqual([
      ['You', 1990],
      ['Person 4', 2000],
    ]);
  });
});
