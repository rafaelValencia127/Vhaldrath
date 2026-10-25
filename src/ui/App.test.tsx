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
  });

  it('opens the class map and a quest drawer from the route', async () => {
    mount();
    await act(async () => {
      window.location.hash = '#/class/ai-engineer/week-01';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('dialog', { name: /Set up Python/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Complete quest/ })).toHaveProperty('disabled', true);
  });

  it('completes a quest through the UI, celebrates and keeps it after a remount', async () => {
    const view = mount();
    await act(async () => {
      window.location.hash = '#/class/ai-engineer/week-01';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reflection' }));
    fireEvent.change(screen.getByLabelText('Written reflection'), { target: { value: 'uv + pytest green on my machine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add evidence' }));
    fireEvent.click(screen.getByRole('button', { name: /Complete quest · \+60 XP/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Complete quest' }));
    });
    expect(screen.getByRole('heading', { name: 'Quest complete' })).toBeTruthy();
    expect(screen.getByText('+60 XP')).toBeTruthy();
    expect(screen.getByText('+2 CODE')).toBeTruthy();

    view.unmount();
    window.location.hash = '';
    mount();
    expect(screen.getByText(/60 XP total/)).toBeTruthy();
    expect(screen.getByText(/Write file-processing scripts/)).toBeTruthy();
  });
});
