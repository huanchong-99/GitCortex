import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskWithAttemptStatus } from 'shared/types';
import { TaskCard } from './TaskCard';

const { mockNavigate, mockGetAttempt } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetAttempt: vi.fn(),
}));

vi.mock('@/hooks', () => ({
  useNavigateWithSearch: () => mockNavigate,
  useAuth: () => ({
    isSignedIn: true,
  }),
}));

vi.mock('@/components/ConfigProvider', () => ({
  useUserSystem: () => ({
    remoteFeaturesEnabled: false,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/actions-dropdown', () => ({
  ActionsDropdown: () => <div data-testid="actions-dropdown" />,
}));

vi.mock('@/lib/api', () => ({
  attemptsApi: {
    get: mockGetAttempt,
  },
}));

const baseTask: TaskWithAttemptStatus = {
  id: 'task-1',
  projectId: 'project-1',
  title: 'Child task',
  description: 'Child task description',
  status: 'todo',
  parentWorkspaceId: 'parent-attempt-1',
  sharedTaskId: null,
  hasInProgressAttempt: false,
  lastAttemptFailed: false,
  executor: 'claude-code',
  createdAt: '2026-02-08T00:00:00Z',
  updatedAt: '2026-02-08T00:00:00Z',
};

describe('tasks/TaskCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets parent navigation loading state after successful navigation', async () => {
    const user = userEvent.setup();
    let resolveParentAttempt: ((value: { taskId: string }) => void) | undefined;
    const firstParentAttempt = new Promise<{ taskId: string }>((resolve) => {
      resolveParentAttempt = resolve;
    });

    mockGetAttempt
      .mockReturnValueOnce(firstParentAttempt)
      .mockResolvedValueOnce({ taskId: 'parent-task-1' });

    render(
      <TaskCard
        task={baseTask}
        index={0}
        status="todo"
        projectId="project-1"
        onViewDetails={vi.fn()}
      />
    );

    const parentButton = screen.getByTitle('navigateToParent');

    await user.click(parentButton);

    await waitFor(() => {
      expect(parentButton).toBeDisabled();
    });
    expect(mockGetAttempt).toHaveBeenCalledTimes(1);

    resolveParentAttempt?.({ taskId: 'parent-task-1' });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/projects/project-1/tasks/parent-task-1/attempts/parent-attempt-1'
      );
    });

    await waitFor(() => {
      expect(parentButton).not.toBeDisabled();
    });

    await user.click(parentButton);

    await waitFor(() => {
      expect(mockGetAttempt).toHaveBeenCalledTimes(2);
    });
  });
});
