import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { handleApiResponse, logApiError } from '@/lib/api';
import type { SlashCommandPresetDto } from 'shared/types';

// ============================================================================
// Types
// ============================================================================

export interface CreateSlashCommandPresetRequest {
  command: string;
  description: string;
  promptTemplate: string;
}

export interface UpdateSlashCommandPresetRequest {
  command?: string;
  description?: string;
  promptTemplate?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const slashCommandKeys = {
  all: ['slashCommands'] as const,
  presets: () => [...slashCommandKeys.all, 'presets'] as const,
  preset: (id: string) => [...slashCommandKeys.all, 'preset', id] as const,
};

// ============================================================================
// API
// ============================================================================

const slashCommandsApi = {
  /**
   * Get all slash command presets
   */
  getAll: async (): Promise<SlashCommandPresetDto[]> => {
    const response = await fetch('/api/workflows/presets/commands');
    return handleApiResponse<SlashCommandPresetDto[]>(response);
  },

  /**
   * Get a single preset by ID
   */
  getById: async (id: string): Promise<SlashCommandPresetDto> => {
    const response = await fetch(`/api/workflows/presets/commands/${encodeURIComponent(id)}`);
    return handleApiResponse<SlashCommandPresetDto>(response);
  },

  /**
   * Create a new slash command preset
   */
  create: async (data: CreateSlashCommandPresetRequest): Promise<SlashCommandPresetDto> => {
    const response = await fetch('/api/workflows/presets/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleApiResponse<SlashCommandPresetDto>(response);
  },

  /**
   * Update a slash command preset
   */
  update: async (id: string, data: UpdateSlashCommandPresetRequest): Promise<SlashCommandPresetDto> => {
    const response = await fetch(`/api/workflows/presets/commands/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleApiResponse<SlashCommandPresetDto>(response);
  },

  /**
   * Delete a slash command preset
   */
  delete: async (id: string): Promise<void> => {
    const response = await fetch(`/api/workflows/presets/commands/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return handleApiResponse<void>(response);
  },
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all slash command presets
 */
export function useSlashCommands(): UseQueryResult<SlashCommandPresetDto[], Error> {
  return useQuery({
    queryKey: slashCommandKeys.presets(),
    queryFn: () => slashCommandsApi.getAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single preset by ID
 */
export function useSlashCommand(id: string): UseQueryResult<SlashCommandPresetDto, Error> {
  return useQuery({
    queryKey: slashCommandKeys.preset(id),
    queryFn: () => slashCommandsApi.getById(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a new slash command preset
 */
export function useCreateSlashCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSlashCommandPresetRequest) => slashCommandsApi.create(data),
    onSuccess: (newPreset) => {
      // Add the new preset to the cache
      queryClient.setQueryData(
        slashCommandKeys.preset(newPreset.id),
        newPreset
      );
      // Invalidate the presets list
      queryClient.invalidateQueries({
        queryKey: slashCommandKeys.presets(),
      });
    },
    onError: (error) => {
      logApiError('Failed to create slash command preset:', error);
    },
  });
}

/**
 * Hook to update a slash command preset
 */
export function useUpdateSlashCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSlashCommandPresetRequest }) =>
      slashCommandsApi.update(id, data),
    onSuccess: (updatedPreset) => {
      // Update the preset in the cache
      queryClient.setQueryData(
        slashCommandKeys.preset(updatedPreset.id),
        updatedPreset
      );
      // Invalidate the presets list
      queryClient.invalidateQueries({
        queryKey: slashCommandKeys.presets(),
      });
    },
    onError: (error) => {
      logApiError('Failed to update slash command preset:', error);
    },
  });
}

/**
 * Hook to delete a slash command preset
 */
export function useDeleteSlashCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => slashCommandsApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove the preset from the cache
      queryClient.removeQueries({
        queryKey: slashCommandKeys.preset(deletedId),
      });
      // Invalidate the presets list
      queryClient.invalidateQueries({
        queryKey: slashCommandKeys.presets(),
      });
    },
    onError: (error) => {
      logApiError('Failed to delete slash command preset:', error);
    },
  });
}
