import { EventClient } from '@tanstack/devtools-event-client';
import { AsyncBatcher } from './async-batcher.js';
import { AsyncDebouncer } from './async-debouncer.js';
import { AsyncQueuer } from './async-queuer.js';
import { AsyncRateLimiter } from './async-rate-limiter.js';
import { AsyncThrottler } from './async-throttler.js';
import { Debouncer } from './debouncer.js';
import { Batcher } from './batcher.js';
import { Queuer } from './queuer.js';
import { RateLimiter } from './rate-limiter.js';
import { Throttler } from './throttler.js';
export interface PacerEventMap {
    'pacer:d-AsyncBatcher': AsyncBatcher<any>;
    'pacer:d-AsyncDebouncer': AsyncDebouncer<any>;
    'pacer:d-AsyncQueuer': AsyncQueuer<any>;
    'pacer:d-AsyncRateLimiter': AsyncRateLimiter<any>;
    'pacer:d-AsyncThrottler': AsyncThrottler<any>;
    'pacer:d-Batcher': Batcher<any>;
    'pacer:d-Debouncer': Debouncer<any>;
    'pacer:d-Queuer': Queuer<any>;
    'pacer:d-RateLimiter': RateLimiter<any>;
    'pacer:d-Throttler': Throttler<any>;
    'pacer:AsyncBatcher': AsyncBatcher<any>;
    'pacer:AsyncDebouncer': AsyncDebouncer<any>;
    'pacer:AsyncQueuer': AsyncQueuer<any>;
    'pacer:AsyncRateLimiter': AsyncRateLimiter<any>;
    'pacer:AsyncThrottler': AsyncThrottler<any>;
    'pacer:Batcher': Batcher<any>;
    'pacer:Debouncer': Debouncer<any>;
    'pacer:Queuer': Queuer<any>;
    'pacer:RateLimiter': RateLimiter<any>;
    'pacer:Throttler': Throttler<any>;
}
export type PacerEventName = keyof PacerEventMap extends `pacer:${infer T}` ? T : never;
declare class PacerEventClient extends EventClient<PacerEventMap> {
    constructor(props?: {
        debug: boolean;
    });
}
export declare const emitChange: <TSuffix extends Extract<keyof PacerEventMap, `${string}:${string}`> extends `${string}:${infer S}` ? S : never>(event: TSuffix, payload: PacerEventMap[`pacer:${TSuffix}`]) => void;
export declare const pacerEventClient: PacerEventClient;
export {};
