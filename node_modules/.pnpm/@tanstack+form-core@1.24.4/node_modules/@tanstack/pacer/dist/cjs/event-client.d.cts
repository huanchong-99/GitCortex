import { EventClient } from '@tanstack/devtools-event-client';
import { AsyncBatcher } from './async-batcher.cjs';
import { AsyncDebouncer } from './async-debouncer.cjs';
import { AsyncQueuer } from './async-queuer.cjs';
import { AsyncRateLimiter } from './async-rate-limiter.cjs';
import { AsyncThrottler } from './async-throttler.cjs';
import { Debouncer } from './debouncer.cjs';
import { Batcher } from './batcher.cjs';
import { Queuer } from './queuer.cjs';
import { RateLimiter } from './rate-limiter.cjs';
import { Throttler } from './throttler.cjs';
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
