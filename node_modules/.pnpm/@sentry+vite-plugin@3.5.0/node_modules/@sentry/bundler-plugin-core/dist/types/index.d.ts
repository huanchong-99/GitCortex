import { TransformResult, UnpluginOptions } from "unplugin";
import { Logger } from "./logger";
import { Options, SentrySDKBuildFlags } from "./types";
interface SentryUnpluginFactoryOptions {
    releaseInjectionPlugin: (injectionCode: string) => UnpluginOptions;
    componentNameAnnotatePlugin?: (ignoredComponents?: string[]) => UnpluginOptions;
    moduleMetadataInjectionPlugin: (injectionCode: string) => UnpluginOptions;
    debugIdInjectionPlugin: (logger: Logger) => UnpluginOptions;
    debugIdUploadPlugin: (upload: (buildArtifacts: string[]) => Promise<void>, logger: Logger, createDependencyOnBuildArtifacts: () => () => void, webpack_forceExitOnBuildComplete?: boolean) => UnpluginOptions;
    bundleSizeOptimizationsPlugin: (buildFlags: SentrySDKBuildFlags) => UnpluginOptions;
}
/**
 * Creates an unplugin instance used to create Sentry plugins for Vite, Rollup, esbuild, and Webpack.
 */
export declare function sentryUnpluginFactory({ releaseInjectionPlugin, componentNameAnnotatePlugin, moduleMetadataInjectionPlugin, debugIdInjectionPlugin, debugIdUploadPlugin, bundleSizeOptimizationsPlugin, }: SentryUnpluginFactoryOptions): import("unplugin").UnpluginInstance<Options | undefined, true>;
/**
 * @deprecated
 */
export declare function getBuildInformation(): {
    deps: string[];
    depsVersions: Record<string, number>;
    nodeVersion: number | undefined;
};
/**
 * Determines whether the Sentry CLI binary is in its expected location.
 * This function is useful since `@sentry/cli` installs the binary via a post-install
 * script and post-install scripts may not always run. E.g. with `npm i --ignore-scripts`.
 */
export declare function sentryCliBinaryExists(): boolean;
export declare function createRollupReleaseInjectionHooks(injectionCode: string): {
    resolveId(id: string): {
        id: string;
        external: boolean;
        moduleSideEffects: boolean;
    } | null;
    load(id: string): string | null;
    transform(code: string, id: string): {
        code: string;
        map: import("magic-string").SourceMap;
    } | null;
};
export declare function createRollupBundleSizeOptimizationHooks(replacementValues: SentrySDKBuildFlags): {
    transform(code: string): {
        code: string;
        map: import("magic-string").SourceMap;
    } | null;
};
export declare function createRollupDebugIdInjectionHooks(): {
    renderChunk(code: string, chunk: {
        fileName: string;
    }): {
        code: string;
        map: import("magic-string").SourceMap;
    } | null;
};
export declare function createRollupModuleMetadataInjectionHooks(injectionCode: string): {
    renderChunk(code: string, chunk: {
        fileName: string;
    }): {
        code: string;
        map: import("magic-string").SourceMap;
    } | null;
};
export declare function createRollupDebugIdUploadHooks(upload: (buildArtifacts: string[]) => Promise<void>, _logger: Logger, createDependencyOnBuildArtifacts: () => () => void): {
    writeBundle(outputOptions: {
        dir?: string;
        file?: string;
    }, bundle: {
        [fileName: string]: unknown;
    }): Promise<void>;
};
export declare function createComponentNameAnnotateHooks(ignoredComponents?: string[]): {
    transform(this: void, code: string, id: string): Promise<TransformResult>;
};
export declare function getDebugIdSnippet(debugId: string): string;
export type { Logger } from "./logger";
export type { Options, SentrySDKBuildFlags } from "./types";
export { replaceBooleanFlagsInCode, stringToUUID } from "./utils";
export { createSentryBuildPluginManager } from "./build-plugin-manager";
//# sourceMappingURL=index.d.ts.map