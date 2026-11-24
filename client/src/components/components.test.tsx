import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SignRule } from '../engine';
import { SAMPLES } from '../samples/samples';
import { useStore } from '../store';
import { AnswerPanel } from './AnswerPanel';
import { Scrubber } from './Scrubber';

const cleaning: SignRule = {
  order: 1,
  rawText: 'NO PARKING 10AM-12PM TUE',
  type: 'street_cleaning',
  days: ['TUE'],
  anytime: false,
  start: '10:00',
  end: '12:00',
  maxMinutes: null,
  permitZone: null,
  exceptText: null,
  arrow: 'none',
  confidence: 0.95,
};

// Tuesday 2026-11-24, 11:05 AM local
const TUE_1105 = new Date(2026, 10, 24, 11, 5).getTime();

function reset(rules: SignRule[], notes = '') {
  act(() => {
    useStore.setState({
      mode: 'demo',
      rules,
      notes,
      readable: true,
      confirmed: false,
      edited: false,
      phase: 'idle',
      error: null,
      baseTime: TUE_1105,
      offsetMin: 0,
      profile: { side: 'both' },
      source: { kind: 'sample', label: 'Test' },
    });
  });
}

describe('AnswerPanel', () => {
  beforeEach(() => reset([cleaning]));

  it('shows a big NO with the next allowed time and the Why trace', () => {
    render(<AnswerPanel />);
    expect(screen.getByText('NO')).toBeInTheDocument();
    expect(screen.getByText(/Next allowed today at 12:00 PM/)).toBeInTheDocument();
    expect(screen.getByText(/✕ No parking/)).toBeInTheDocument();
    expect(screen.getAllByText(/Sign 1 says 'NO PARKING 10AM-12PM TUE'/).length).toBeGreaterThan(0);
  });

  it('editing a rule chip re-runs the engine instantly', async () => {
    const user = userEvent.setup();
    render(<AnswerPanel />);
    await user.click(screen.getByRole('button', { name: 'Edit sign 1' }));
    // Move the sign from Tuesday to Monday → it no longer applies → YES
    await user.click(screen.getByRole('button', { name: 'MON' }));
    expect(screen.getByText('NO')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'TUE' }));
    expect(screen.getByText('YES')).toBeInTheDocument();
    expect(screen.getByText('Edited by you ✓')).toBeInTheDocument();
  });

  it('changing the end time updates the answer', () => {
    render(<AnswerPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit sign 1' }));
    fireEvent.change(screen.getByLabelText('End time for sign 1'), { target: { value: '11:00' } });
    expect(screen.getByText('YES')).toBeInTheDocument();
  });

  it('asks the user to confirm low-confidence reads', async () => {
    const permit = SAMPLES.find((s) => s.id === 'permit-b');
    if (!permit) throw new Error('sample missing');
    reset(permit.expected.signs, permit.expected.notes);
    const user = userEvent.setup();
    render(<AnswerPanel />);
    expect(screen.getByText(/Please confirm what I read/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Looks right' }));
    expect(screen.queryByText(/Please confirm what I read/)).not.toBeInTheDocument();
  });
});

describe('Scrubber', () => {
  beforeEach(() => reset([cleaning]));

  it('is keyboard operable and announces the time + status', () => {
    render(<Scrubber />);
    const slider = screen.getByRole('slider', { name: /Time-travel/ });
    expect(slider).toHaveAttribute('aria-valuetext', 'Tuesday 11:05 AM, No parking');
    // Native <input type="range">: arrow keys/Home/End work in every browser.
    expect(slider.tagName).toBe('INPUT');
    expect(slider).toHaveAttribute('step', '15');
    fireEvent.change(slider, { target: { value: '15' } });
    expect(useStore.getState().offsetMin).toBe(15);
    // Jump ahead to 12:05 → allowed
    act(() => useStore.getState().setOffset(60));
    expect(screen.getByRole('slider')).toHaveAttribute(
      'aria-valuetext',
      'Tuesday 12:05 PM, Allowed',
    );
  });

  it('"Now" returns to live time', async () => {
    const user = userEvent.setup();
    act(() => useStore.getState().setOffset(600));
    render(<Scrubber />);
    await user.click(screen.getByRole('button', { name: 'Now' }));
    expect(useStore.getState().offsetMin).toBe(0);
  });
});

describe('samples', () => {
  it('ships 6 sample stacks with expected rules', () => {
    expect(SAMPLES).toHaveLength(6);
    for (const s of SAMPLES) expect(s.expected.signs.length).toBeGreaterThan(0);
    expect(SAMPLES.find((s) => s.id === 'nightmare')?.expected.signs).toHaveLength(4);
  });
});

describe('DemoBanner', () => {
  it('welcomes visitors on the hosted demo instead of showing setup commands', async () => {
    const { DemoBanner } = await import('./DemoBanner');
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, hostname: 'saigupta954.github.io' },
    });
    act(() => useStore.setState({ mode: 'demo', health: null, forceDemo: false }));
    render(<DemoBanner />);
    expect(screen.getByText(/This is the online demo/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Run it locally/ })).toHaveAttribute(
      'href',
      'https://github.com/SaiGupta954/parksense#setup',
    );
    expect(screen.queryByText('npm run dev')).not.toBeInTheDocument();
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});
