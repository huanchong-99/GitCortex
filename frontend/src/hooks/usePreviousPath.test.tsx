import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { resetPreviousPathHistory, usePreviousPath } from './usePreviousPath';

const authState = vi.hoisted(() => ({
  userId: null as string | null,
}));

vi.mock('./auth/useAuth', () => ({
  useAuth: () => ({
    userId: authState.userId,
    isSignedIn: Boolean(authState.userId),
    isLoaded: true,
  }),
}));

function PreviousPathHarness() {
  const goToPreviousPath = usePreviousPath();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div>
      <button onClick={() => navigate('/board')}>to-board</button>
      <button onClick={() => navigate('/settings/general')}>to-settings</button>
      <button onClick={goToPreviousPath}>go-previous</button>
      <span data-testid="path">{location.pathname}</span>
    </div>
  );
}

function renderHarness(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<PreviousPathHarness />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('usePreviousPath', () => {
  beforeEach(() => {
    authState.userId = null;
    resetPreviousPathHistory();
    globalThis.sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetPreviousPathHistory();
  });

  it('isolates path history by user scope', () => {
    authState.userId = 'user-a';
    const first = renderHarness('/board');

    fireEvent.click(screen.getByText('to-settings'));
    expect(screen.getByTestId('path')).toHaveTextContent('/settings/general');

    fireEvent.click(screen.getByText('go-previous'));
    expect(screen.getByTestId('path')).toHaveTextContent('/board');
    first.unmount();

    authState.userId = 'user-b';
    renderHarness('/settings/general');
    fireEvent.click(screen.getByText('go-previous'));

    expect(screen.getByTestId('path')).toHaveTextContent('/');
  });

  it('supports resetting stored history', () => {
    authState.userId = 'user-a';
    renderHarness('/board');

    fireEvent.click(screen.getByText('to-settings'));
    expect(screen.getByTestId('path')).toHaveTextContent('/settings/general');

    resetPreviousPathHistory();
    fireEvent.click(screen.getByText('go-previous'));

    expect(screen.getByTestId('path')).toHaveTextContent('/');
  });
});
