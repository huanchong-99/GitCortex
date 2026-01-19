import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { handleApiResponse } from '@/lib/api';
import {
  useErrorNotification,
  type ErrorNotificationOptions,
} from './useErrorNotification';

// ============================================================================
// CLI Types
// ============================================================================

export interface CliType {
  id: string;
  name: string;
  displayName: string;
  description: string;
  executableCommand?: string;
  versionCheckCommand?: string;
  website?: string;
  documentationUrl?: string;
  isInstalled?: boolean;
  installedVersion?: string;
}

export interface CliModel {
  id: string;
  cliTypeId: string;
  modelId: string;
  displayName: string;
  provider: 'anthropic' | 'google' | 'openai' | 'other';
  apiType: 'anthropic' | 'google' | 'openai' | 'openai-compatible';
  requiresConfig: boolean;
  configSchema?: Record<string, unknown>;
}

export interface CliDetectionResult {
  cliTypeId: string;
  isInstalled: boolean;
  version?: string;
  path?: string;
  error?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const cliTypesKeys = {
  all: ['cliTypes'] as const,
  models: (cliTypeId: string) => ['cliTypes', 'models', cliTypeId] as const,
  detection: ['cliTypes', 'detection'] as const,
};

// ============================================================================
// CLI Types API
// ============================================================================

const cliTypesApi = {
  /**
   * Get all available CLI types
   */
  getAll: async (): Promise<CliType[]> => {
    const response = await fetch('/api/cli-types');
    return handleApiResponse<CliType[]>(response);
  },

  /**
   * Detect which CLIs are installed on the system
   */
  detectInstallation: async (): Promise<CliDetectionResult[]> => {
    const response = await fetch('/api/cli-types/detect');
    return handleApiResponse<CliDetectionResult[]>(response);
  },

  /**
   * Get available models for a specific CLI type
   */
  getModels: async (cliTypeId: string): Promise<CliModel[]> => {
    const response = await fetch(`/api/cli-types/${encodeURIComponent(cliTypeId)}/models`);
    return handleApiResponse<CliModel[]>(response);
  },
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all available CLI types
 * @returns Query result with CLI types array
 */
export function useCliTypes(
  options: ErrorNotificationOptions = {}
): UseQueryResult<CliType[], Error> {
  const { notifyError } = useErrorNotification({
    ...options,
    context: options.context ?? 'CliTypes',
  });

  return useQuery({
    queryKey: cliTypesKeys.all,
    queryFn: () => cliTypesApi.getAll(),
    onError: (error) => notifyError(error),
    staleTime: 1000 * 60 * 60, // 1 hour - CLI types don't change often
  });
}

/**
 * Hook to detect CLI installation status
 * @returns Query result with CLI detection results
 */
export function useCliDetection(
  options: ErrorNotificationOptions = {}
): UseQueryResult<CliDetectionResult[], Error> {
  const { notifyError } = useErrorNotification({
    ...options,
    context: options.context ?? 'CliDetection',
  });

  return useQuery({
    queryKey: cliTypesKeys.detection,
    queryFn: () => cliTypesApi.detectInstallation(),
    onError: (error) => notifyError(error),
    staleTime: 1000 * 60 * 5, // 5 minutes - installation status can change
    refetchOnWindowFocus: true, // Re-check when user returns to tab
  });
}

/**
 * Hook to fetch models available for a specific CLI type
 * @param cliTypeId - The CLI type ID to fetch models for
 * @returns Query result with models array
 */
export function useModelsForCli(
  cliTypeId: string,
  options: ErrorNotificationOptions = {}
): UseQueryResult<CliModel[], Error> {
  const { notifyError } = useErrorNotification({
    ...options,
    context: options.context ?? 'CliModels',
  });

  return useQuery({
    queryKey: cliTypesKeys.models(cliTypeId),
    queryFn: () => cliTypesApi.getModels(cliTypeId),
    enabled: !!cliTypeId,
    onError: (error) => notifyError(error),
    staleTime: 1000 * 60 * 30, // 30 minutes - available models don't change often
  });
}
