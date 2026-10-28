import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ServicesProvider } from '../app/services';
import { App } from './App';

function mount() {
  return render(
    <ServicesProvider>
      <App />
    </ServicesProvider>,
  );
}

async function openQuest(id: string) {
  await act(async () => {
    window.location.hash = `#/class/ai-engineer/${id}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

async function completeQuest(id: string) {
  await openQuest(id);
  fireEvent.click(screen.getByRole('button', { name: 'Reflection' }));
  fireEvent.change(screen.getByLabelText('Written reflection'), { target: { value: 'done and explained in my own words' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
  fireEvent.click(screen.getByRole('button', { name: /Complete quest · \+60 XP/ }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Complete quest' }));
  });
}

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  window.location.hash = '';
});

describe('app smoke', () => {
  it('renders the hub with the AI Engineer class and its next quest', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'AI Engineer' })).toBeTruthy();
    expect(screen.getByText(/Set up Python, uv or venv/)).toBeTruthy();
    expect(screen.getByText('Saved in this browser')).toBeTruthy();
    expect(screen.getByText('Complete your first quest to start growing skills.')).toBeTruthy();
    expect(screen.queryByText(/^Lv /)).toBeNull();
  });

  it('opens the class map and a quest drawer from the route', async () => {
    mount();
    await openQuest('week-01');
    expect(screen.getByRole('dialog', { name: /Set up Python/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Complete quest/ })).toHaveProperty('disabled', true);
  });

  it('completes a quest through the UI, celebrates and keeps it after a remount', async () => {
    const view = mount();
    await completeQuest('week-01');
    expect(screen.getByRole('heading', { name: 'Quest complete' })).toBeTruthy();
    expect(screen.getByText('+60 XP')).toBeTruthy();
    expect(screen.getByText('+2 CODE')).toBeTruthy();
    expect(screen.getByText('+60 Python')).toBeTruthy();
    expect(screen.getByText('+60 Testing')).toBeTruthy();

    view.unmount();
    window.location.hash = '';
    mount();
    expect(screen.getByText(/60 XP total/)).toBeTruthy();
    expect(screen.getByText(/Write file-processing scripts/)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Engineering · Lv 2/ })).toBeTruthy();
    expect(screen.getByText('Python')).toBeTruthy();
    expect(screen.queryByText('Complete your first quest to start growing skills.')).toBeNull();
  });

  it('levels a skill up and tells the player', async () => {
    mount();
    await completeQuest('week-01');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await completeQuest('week-02');
    expect(screen.getByText(/▲ Python Lv 2/)).toBeTruthy();
  });

  it('announces a level-up earned by logged study time', async () => {
    mount();
    await completeQuest('week-01');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await openQuest('week-01');
    fireEvent.change(screen.getByLabelText('Hours studied'), { target: { value: '15' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log hours' }));
    });
    expect(screen.getByText(/Python reached level 2/)).toBeTruthy();
  });
});
