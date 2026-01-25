import type { Logger } from '@sentry/core';
type LoggerMethod = (...args: unknown[]) => void;
interface LoggerConfig {
    captureExceptions: boolean;
    traceInternals: boolean;
}
interface ReplayLogger extends Logger {
    /**
     * Calls `logger.info` but saves breadcrumb in the next tick due to race
     * conditions before replay is initialized.
     */
    infoTick: LoggerMethod;
    /**
     * Captures exceptions (`Error`) if "capture internal exceptions" is enabled
     */
    exception: LoggerMethod;
    /**
     * Configures the logger with additional debugging behavior
     */
    setConfig(config: Partial<LoggerConfig>): void;
}
export declare const logger: ReplayLogger;
export {};
//# sourceMappingURL=logger.d.ts.map