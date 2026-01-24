interface TanStackDevtoolsEvent<TEventName extends string, TPayload = any> {
    type: TEventName;
    payload: TPayload;
    pluginId?: string;
}
declare global {
    var __TANSTACK_EVENT_TARGET__: EventTarget | null;
}
type AllDevtoolsEvents<TEventMap extends Record<string, any>> = {
    [Key in keyof TEventMap]: TanStackDevtoolsEvent<Key & string, TEventMap[Key]>;
}[keyof TEventMap];
export declare class EventClient<TEventMap extends Record<string, any>, TPluginId extends string = TEventMap extends Record<infer P, any> ? P extends `${infer Id}:${string}` ? Id : never : never> {
    #private;
    constructor({ pluginId, debug, enabled, reconnectEveryMs, }: {
        pluginId: TPluginId;
        debug?: boolean;
        reconnectEveryMs?: number;
        enabled?: boolean;
    });
    private startConnectLoop;
    private stopConnectLoop;
    private debugLog;
    private getGlobalTarget;
    getPluginId(): TPluginId;
    private dispatchCustomEventShim;
    private dispatchCustomEvent;
    private emitEventToBus;
    emit<TSuffix extends Extract<keyof TEventMap, `${TPluginId & string}:${string}`> extends `${TPluginId & string}:${infer S}` ? S : never>(eventSuffix: TSuffix, payload: TEventMap[`${TPluginId & string}:${TSuffix}`]): void;
    on<TSuffix extends Extract<keyof TEventMap, `${TPluginId & string}:${string}`> extends `${TPluginId & string}:${infer S}` ? S : never>(eventSuffix: TSuffix, cb: (event: TanStackDevtoolsEvent<`${TPluginId & string}:${TSuffix}`, TEventMap[`${TPluginId & string}:${TSuffix}`]>) => void): () => void;
    onAll(cb: (event: TanStackDevtoolsEvent<string, any>) => void): () => void;
    onAllPluginEvents(cb: (event: AllDevtoolsEvents<TEventMap>) => void): () => void;
}
export {};
