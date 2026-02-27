import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { JSONEditor } from '@/components/ui/json-editor';
import { Loader2 } from 'lucide-react';
import { BaseCodingAgent, McpConfig } from 'shared/types';
import { useUserSystem } from '@/components/ConfigProvider';
import { ApiError, mcpServersApi } from '@/lib/api';
import { McpConfigStrategyGeneral } from '@/lib/mcpStrategies';

const MCP_NOT_SUPPORTED_ERROR_CODE = 'MCP_NOT_SUPPORTED';

interface McpUiError {
  code: string | null;
  message: string;
}

function isMcpUiErrorData(
  data: unknown
): data is { code?: string | null; message?: string } {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as { code?: unknown; message?: unknown };
  const codeOk =
    candidate.code === undefined ||
    candidate.code === null ||
    typeof candidate.code === 'string';
  const messageOk =
    candidate.message === undefined || typeof candidate.message === 'string';

  return codeOk && messageOk;
}

export const buildMcpServersPayload = (
  editorValue: string,
  mcpConfig: McpConfig
): McpConfig['servers'] => {
  if (!editorValue.trim()) {
    return {};
  }

  const fullConfig = JSON.parse(editorValue);
  McpConfigStrategyGeneral.validateFullConfig(mcpConfig, fullConfig);
  return McpConfigStrategyGeneral.extractServersForApi(mcpConfig, fullConfig);
};

export function McpSettings() {
  const { t } = useTranslation('settings');
  const { config, profiles } = useUserSystem();
  const [mcpServers, setMcpServers] = useState('{}');
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [mcpError, setMcpError] = useState<McpUiError | null>(null);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [selectedProfileKey, setSelectedProfileKey] =
    useState<BaseCodingAgent | null>(null);
  const [mcpApplying, setMcpApplying] = useState(false);
  const [mcpConfigPath, setMcpConfigPath] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const toMcpUiError = (err: unknown, fallbackMessage: string): McpUiError => {
    if (err instanceof ApiError && err.error_data && isMcpUiErrorData(err.error_data)) {
      if (err.error_data.code || err.error_data.message) {
        return {
          code: err.error_data.code ?? null,
          message: err.error_data.message ?? err.message,
        };
      }
    }

    if (err instanceof Error) {
      return { code: null, message: err.message };
    }

    return { code: null, message: fallbackMessage };
  };

  // Initialize selected profile when config loads
  useEffect(() => {
    if (!profiles || selectedProfileKey) {
      return;
    }

    const currentExecutor = config?.executor_profile?.executor;
    if (currentExecutor && profiles[currentExecutor]) {
      setSelectedProfileKey(currentExecutor as BaseCodingAgent);
      return;
    }

    const firstProfileKey = Object.keys(profiles)[0];
    if (firstProfileKey) {
      setSelectedProfileKey(firstProfileKey as BaseCodingAgent);
    }
  }, [config?.executor_profile, profiles, selectedProfileKey]);

  // Load existing MCP configuration when selected profile changes
  useEffect(() => {
    const loadMcpServersForProfile = async (profileKey: BaseCodingAgent) => {
      // Reset state when loading
      setMcpLoading(true);
      setMcpError(null);
      // Set default empty config based on agent type using strategy
      setMcpConfigPath('');

      try {
        const result = await mcpServersApi.load({
          executor: profileKey,
        });
        // Store the McpConfig from backend
        setMcpConfig(result.mcp_config);
        // Create the full configuration structure using the schema
        const fullConfig = McpConfigStrategyGeneral.createFullConfig(
          result.mcp_config
        );
        const configJson = JSON.stringify(fullConfig, null, 2);
        setMcpServers(configJson);
        setMcpConfigPath(result.config_path);
      } catch (err: unknown) {
        setMcpError(toMcpUiError(err, t('settings.mcp.errors.loadFailed')));
        console.error('Error loading MCP servers:', err);
      } finally {
        setMcpLoading(false);
      }
    };

    // Load MCP servers for the selected profile
    if (selectedProfileKey) {
      loadMcpServersForProfile(selectedProfileKey);
    }
  }, [selectedProfileKey, t]);

  const handleMcpServersChange = (value: string) => {
    setMcpServers(value);
    setMcpError(null);

    // Validate JSON on change
    if (value.trim() && mcpConfig) {
      try {
        const parsedConfig = JSON.parse(value);
        // Validate using the schema path from backend
        McpConfigStrategyGeneral.validateFullConfig(mcpConfig, parsedConfig);
      } catch (err) {
        if (err instanceof SyntaxError) {
          setMcpError({
            code: null,
            message: t('settings.mcp.errors.invalidJson'),
          });
        } else {
          setMcpError({
            code: null,
            message:
              err instanceof Error
                ? err.message
                : t('settings.mcp.errors.validationError'),
          });
        }
      }
    }
  };

  const handleApplyMcpServers = async () => {
    if (!selectedProfileKey || !mcpConfig) return;

    setMcpApplying(true);
    setMcpError(null);

    try {
      // Validate and save MCP configuration
      try {
        const mcpServersConfig = buildMcpServersPayload(mcpServers, mcpConfig);

        await mcpServersApi.save(
          {
            executor: selectedProfileKey,
          },
          { servers: mcpServersConfig }
        );

        // Show success feedback
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (mcpErr) {
        if (mcpErr instanceof SyntaxError) {
          setMcpError({
            code: null,
            message: t('settings.mcp.errors.invalidJson'),
          });
        } else {
          setMcpError(
            toMcpUiError(mcpErr, t('settings.mcp.errors.saveFailed'))
          );
        }
      }
    } catch (err) {
      setMcpError({
        code: null,
        message: t('settings.mcp.errors.applyFailed'),
      });
      console.error('Error applying MCP servers:', err);
    } finally {
      setMcpApplying(false);
    }
  };

  const addServer = (key: string) => {
    try {
      const existing = mcpServers.trim() ? JSON.parse(mcpServers) : {};
      const updated = McpConfigStrategyGeneral.addPreconfiguredToConfig(
        mcpConfig!,
        existing,
        key
      );
      setMcpServers(JSON.stringify(updated, null, 2));
      setMcpError(null);
    } catch (err) {
      console.error(err);
      setMcpError({
        code: null,
        message:
          err instanceof Error
            ? err.message
            : t('settings.mcp.errors.addServerFailed'),
      });
    }
  };

  const isMcpUnsupported = mcpError?.code === MCP_NOT_SUPPORTED_ERROR_CODE;

  const preconfiguredObj = (mcpConfig?.preconfigured || {}) as Record<
    string,
    unknown
  >;
  const meta =
    typeof preconfiguredObj.meta === 'object' && preconfiguredObj.meta !== null
      ? (preconfiguredObj.meta as Record<
          string,
          { name?: string; description?: string; url?: string; icon?: string }
        >)
      : {};
  const servers = Object.fromEntries(
    Object.entries(preconfiguredObj).filter(([k]) => k !== 'meta')
  ) as Record<string, unknown>;
  const getMetaFor = (key: string) => meta[key] || {};

  if (!config) {
    return (
      <div className="py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {t('settings.mcp.errors.loadFailed')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mcpError && (
        <Alert variant="destructive">
          <AlertDescription>
            {t('settings.mcp.errors.mcpError', { error: mcpError.message })}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription className="font-medium">
            {t('settings.mcp.save.successMessage')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.mcp.title')}</CardTitle>
          <CardDescription>{t('settings.mcp.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mcp-executor">
              {t('settings.mcp.labels.agent')}
            </Label>
            <Select
              value={selectedProfileKey ?? ''}
              onValueChange={(value: string) => {
                if (!profiles?.[value]) return;
                setSelectedProfileKey(value as BaseCodingAgent);
              }}
            >
              <SelectTrigger id="mcp-executor">
                <SelectValue
                  placeholder={t('settings.mcp.labels.agentPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {profiles &&
                  Object.entries(profiles)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([profileKey]) => (
                      <SelectItem key={profileKey} value={profileKey}>
                        {profileKey}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {t('settings.mcp.labels.agentHelper')}
            </p>
          </div>

          {isMcpUnsupported ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    {t('settings.mcp.errors.notSupported')}
                  </h3>
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <p>{mcpError?.message}</p>
                    <p className="mt-1">
                      {t('settings.mcp.errors.supportMessage')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="mcp-servers">
                {t('settings.mcp.labels.serverConfig')}
              </Label>
              <JSONEditor
                id="mcp-servers"
                placeholder={
                  mcpLoading
                    ? t('settings.mcp.save.loading')
                    : '{\n  "server-name": {\n    "type": "stdio",\n    "command": "your-command",\n    "args": ["arg1", "arg2"]\n  }\n}'
                }
                value={
                  mcpLoading ? t('settings.mcp.loading.jsonEditor') : mcpServers
                }
                onChange={handleMcpServersChange}
                disabled={mcpLoading}
                minHeight={300}
              />
              {mcpError && !isMcpUnsupported && (
                <p className="text-sm text-destructive dark:text-red-400">
                  {mcpError.message}
                </p>
              )}
              <div className="text-sm text-muted-foreground">
                {mcpLoading ? (
                  t('settings.mcp.loading.configuration')
                ) : (
                  <span>
                    {t('settings.mcp.labels.saveLocation')}
                    {mcpConfigPath && (
                      <span className="ml-2 font-mono text-xs">
                        {mcpConfigPath}
                      </span>
                    )}
                  </span>
                )}
              </div>

              {mcpConfig?.preconfigured &&
                typeof mcpConfig.preconfigured === 'object' && (
                  <div className="pt-4">
                    <Label>{t('settings.mcp.labels.popularServers')}</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('settings.mcp.labels.serverHelper')}
                    </p>

                    <div className="relative overflow-hidden rounded-xl border bg-background">
                      <Carousel className="w-full px-4 py-3">
                        <CarouselContent>
                          {Object.entries(servers).map(([key]) => {
                            const metaObj = getMetaFor(key) as {
                              name?: string;
                              description?: string;
                              url?: string;
                              icon?: string;
                            };
                            const name = metaObj.name || key;
                            const description =
                              metaObj.description || 'No description';
                            const icon = metaObj.icon
                              ? `/${metaObj.icon}`
                              : null;

                            return (
                              <CarouselItem
                                key={name}
                                className="sm:basis-1/3 lg:basis-1/4"
                              >
                                <button
                                  type="button"
                                  onClick={() => addServer(key)}
                                  aria-label={`Add ${name} to config`}
                                  className="group w-full text-left outline-none"
                                >
                                  <Card className="h-32 rounded-xl border hover:shadow-md transition">
                                    <CardHeader className="pb-0">
                                      <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-lg border bg-muted grid place-items-center overflow-hidden">
                                          {icon ? (
                                            <img
                                              src={icon}
                                              alt=""
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="font-semibold">
                                              {name.slice(0, 1).toUpperCase()}
                                            </span>
                                          )}
                                        </div>
                                        <CardTitle className="text-base font-medium truncate">
                                          {name}
                                        </CardTitle>
                                      </div>
                                    </CardHeader>

                                    <CardContent className="pt-2 px-4">
                                      <p className="text-sm text-muted-foreground line-clamp-3">
                                        {description}
                                      </p>
                                    </CardContent>
                                  </Card>
                                </button>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>

                        <CarouselPrevious className="left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border bg-background/80 shadow-sm backdrop-blur hover:bg-background" />
                        <CarouselNext className="right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full border bg-background/80 shadow-sm backdrop-blur hover:bg-background" />
                      </Carousel>
                    </div>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Save Button */}
      <div className="sticky bottom-0 z-10 bg-background/80 backdrop-blur-sm border-t py-4">
        <div className="flex justify-end">
          <Button
            onClick={handleApplyMcpServers}
            disabled={mcpApplying || mcpLoading || !!mcpError || success}
          >
            {mcpApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {success && <span className="mr-2">✓</span>}
            {success
              ? t('settings.mcp.save.success')
              : t('settings.mcp.save.button')}
          </Button>
        </div>
      </div>
    </div>
  );
}
