type MemoCache = Array<number | typeof $empty>;
declare const $empty: unique symbol;
declare const c: any;
declare enum GuardKind {
    PushGuardContext = 0,
    PopGuardContext = 1,
    PushExpectHook = 2,
    PopExpectHook = 3
}
declare function $dispatcherGuard(kind: GuardKind): void;
declare function $reset($: MemoCache): void;
declare function $makeReadOnly(): void;
declare const renderCounterRegistry: Map<string, Set<{
    count: number;
}>>;
declare function clearRenderCounterRegistry(): void;
declare function useRenderCounter(name: string): void;
declare function $structuralCheck(oldValue: any, newValue: any, variableName: string, fnName: string, kind: string, loc: string): void;

export { $dispatcherGuard, $makeReadOnly, $reset, $structuralCheck, c, clearRenderCounterRegistry, renderCounterRegistry, useRenderCounter };
