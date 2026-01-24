import { Store } from '@tanstack/store';
import { OptionalKeys } from './types.js';
export interface AsyncBatcherState<TValue> {
    /**
     * Number of batch executions that have resulted in errors
     */
    errorCount: number;
    /**
     * Array of items that failed during batch processing
     */
    failedItems: Array<TValue>;
    /**
     * Whether the batcher has no items to process (items array is empty)
     */
    isEmpty: boolean;
    /**
     * Whether a batch is currently being processed asynchronously
     */
    isExecuting: boolean;
    /**
     * Whether the batcher is waiting for the timeout to trigger batch processing
     */
    isPending: boolean;
    /**
     * Array of items currently queued for batch processing
     */
    items: Array<TValue>;
    /**
     * The result from the most recent batch execution
     */
    lastResult: any;
    /**
     * Number of batch executions that have completed (either successfully or with errors)
     */
    settleCount: number;
    /**
     * Number of items currently in the batch queue
     */
    size: number;
    /**
     * Current processing status - 'idle' when not processing, 'pending' when waiting for timeout, 'executing' when processing, 'populated' when items are present, but no wait is configured
     */
    status: 'idle' | 'pending' | 'executing' | 'populated';
    /**
     * Number of batch executions that have completed successfully
     */
    successCount: number;
    /**
     * Total number of items that have failed processing across all batches
     */
    totalItemsFailed: number;
    /**
     * Total number of items that have been processed across all batches
     */
    totalItemsProcessed: number;
}
/**
 * Options for configuring an AsyncBatcher instance
 */
export interface AsyncBatcherOptions<TValue> {
    /**
     * Custom function to determine if a batch should be processed
     * Return true to process the batch immediately
     */
    getShouldExecute?: (items: Array<TValue>, batcher: AsyncBatcher<TValue>) => boolean;
    /**
     * Initial state for the async batcher
     */
    initialState?: Partial<AsyncBatcherState<TValue>>;
    /**
     * Optional key to identify this async batcher instance.
     * If provided, the async batcher will be identified by this key in the devtools and PacerProvider if applicable.
     */
    key?: string;
    /**
     * Maximum number of items in a batch
     * @default Infinity
     */
    maxSize?: number;
    /**
     * Optional error handler for when the batch function throws.
     * If provided, the handler will be called with the error, the batch of items that failed, and batcher instance.
     * This can be used alongside throwOnError - the handler will be called before any error is thrown.
     */
    onError?: (error: unknown, batch: Array<TValue>, batcher: AsyncBatcher<TValue>) => void;
    /**
     * Callback fired after items are added to the batcher
     */
    onItemsChange?: (batcher: AsyncBatcher<TValue>) => void;
    /**
     * Optional callback to call when a batch is settled (completed or failed)
     */
    onSettled?: (batch: Array<TValue>, batcher: AsyncBatcher<TValue>) => void;
    /**
     * Optional callback to call when a batch succeeds
     */
    onSuccess?: (result: any, batch: Array<TValue>, batcher: AsyncBatcher<TValue>) => void;
    /**
     * Whether the batcher should start processing immediately
     * @default true
     */
    started?: boolean;
    /**
     * Whether to throw errors when they occur.
     * Defaults to true if no onError handler is provided, false if an onError handler is provided.
     * Can be explicitly set to override these defaults.
     */
    throwOnError?: boolean;
    /**
     * Maximum time in milliseconds to wait before processing a batch.
     * If the wait duration has elapsed, the batch will be processed.
     * If not provided, the batch will not be triggered by a timeout.
     * @default Infinity
     */
    wait?: number | ((asyncBatcher: AsyncBatcher<TValue>) => number);
}
type AsyncBatcherOptionsWithOptionalCallbacks<TValue> = OptionalKeys<Required<AsyncBatcherOptions<TValue>>, 'initialState' | 'onError' | 'onItemsChange' | 'onSettled' | 'onSuccess' | 'key'>;
/**
 * A class that collects items and processes them in batches asynchronously.
 *
 * This is the async version of the Batcher class. Unlike the sync version, this async batcher:
 * - Handles promises and returns results from batch executions
 * - Provides error handling with configurable error behavior
 * - Tracks success, error, and settle counts separately
 * - Has state tracking for when batches are executing
 * - Returns the result of the batch function execution
 *
 * Batching is a technique for grouping multiple operations together to be processed as a single unit.
 *
 * The AsyncBatcher provides a flexible way to implement async batching with configurable:
 * - Maximum batch size (number of items per batch)
 * - Time-based batching (process after X milliseconds)
 * - Custom batch processing logic via getShouldExecute
 * - Event callbacks for monitoring batch operations
 * - Error handling for failed batch operations
 *
 * Error Handling:
 * - If an `onError` handler is provided, it will be called with the error, the batch of items that failed, and batcher instance
 * - If `throwOnError` is true (default when no onError handler is provided), the error will be thrown
 * - If `throwOnError` is false (default when onError handler is provided), the error will be swallowed
 * - Both onError and throwOnError can be used together - the handler will be called before any error is thrown
 * - The error state can be checked using the AsyncBatcher instance
 *
 * State Management:
 * - Uses TanStack Store for reactive state management
 * - Use `initialState` to provide initial state values when creating the async batcher
 * - Use `onSuccess` callback to react to successful batch execution and implement custom logic
 * - Use `onError` callback to react to batch execution errors and implement custom error handling
 * - Use `onSettled` callback to react to batch execution completion (success or error) and implement custom logic
 * - Use `onExecute` callback to react to batch execution and implement custom logic
 * - Use `onItemsChange` callback to react to items being added or removed from the batcher
 * - The state includes total items processed, success/error counts, and execution status
 * - State can be accessed via `asyncBatcher.store.state` when using the class directly
 * - When using framework adapters (React/Solid), state is accessed from `asyncBatcher.state`
 *
 * @example
 * ```ts
 * const batcher = new AsyncBatcher<number>(
 *   async (items) => {
 *     const result = await processItems(items);
 *     console.log('Processing batch:', items);
 *     return result;
 *   },
 *   {
 *     maxSize: 5,
 *     wait: 2000,
 *     onSuccess: (result) => console.log('Batch succeeded:', result),
 *     onError: (error) => console.error('Batch failed:', error)
 *   }
 * );
 *
 * batcher.addItem(1);
 * batcher.addItem(2);
 * // After 2 seconds or when 5 items are added, whichever comes first,
 * // the batch will be processed and the result will be available
 * // batcher.execute() // manually trigger a batch
 * ```
 */
export declare class AsyncBatcher<TValue> {
    #private;
    fn: (items: Array<TValue>) => Promise<any>;
    readonly store: Store<Readonly<AsyncBatcherState<TValue>>>;
    key: string;
    options: AsyncBatcherOptionsWithOptionalCallbacks<TValue>;
    constructor(fn: (items: Array<TValue>) => Promise<any>, initialOptions: AsyncBatcherOptions<TValue>);
    /**
     * Updates the async batcher options
     */
    setOptions: (newOptions: Partial<AsyncBatcherOptions<TValue>>) => void;
    /**
     * Adds an item to the async batcher
     * If the batch size is reached, timeout occurs, or shouldProcess returns true, the batch will be processed
     */
    addItem: (item: TValue) => void;
    /**
     * Processes the current batch of items immediately
     */
    flush: () => Promise<any>;
    /**
     * Returns a copy of all items in the async batcher
     */
    peekAllItems: () => Array<TValue>;
    peekFailedItems: () => Array<TValue>;
    /**
     * Removes all items from the async batcher
     */
    clear: () => void;
    /**
     * Resets the async batcher state to its default values
     */
    reset: () => void;
}
/**
 * Creates an async batcher that processes items in batches
 *
 * Unlike the sync batcher, this async version:
 * - Handles promises and returns results from batch executions
 * - Provides error handling with configurable error behavior
 * - Tracks success, error, and settle counts separately
 * - Has state tracking for when batches are executing
 *
 * Error Handling:
 * - If an `onError` handler is provided, it will be called with the error, the batch of items that failed, and batcher instance
 * - If `throwOnError` is true (default when no onError handler is provided), the error will be thrown
 * - If `throwOnError` is false (default when onError handler is provided), the error will be swallowed
 * - Both onError and throwOnError can be used together - the handler will be called before any error is thrown
 * - The error state can be checked using the underlying AsyncBatcher instance
 *
 * State Management:
 * - Uses TanStack Store for reactive state management
 * - Use `initialState` to provide initial state values when creating the async batcher
 * - Use `onSuccess` callback to react to successful batch execution and implement custom logic
 * - Use `onError` callback to react to batch execution errors and implement custom error handling
 * - Use `onSettled` callback to react to batch execution completion (success or error) and implement custom logic
 * - Use `onExecute` callback to react to batch execution and implement custom logic
 * - Use `onItemsChange` callback to react to items being added or removed from the batcher
 * - The state includes total items processed, success/error counts, and execution status
 * - State can be accessed via the underlying AsyncBatcher instance's `store.state` property
 * - When using framework adapters (React/Solid), state is accessed from the hook's state property
 *
 * @example
 * ```ts
 * const batchItems = asyncBatch<number>(
 *   async (items) => {
 *     const result = await processApiCall(items);
 *     console.log('Processing:', items);
 *     return result;
 *   },
 *   {
 *     maxSize: 3,
 *     wait: 1000,
 *     onSuccess: (result) => console.log('Batch succeeded:', result),
 *     onError: (error) => console.error('Batch failed:', error)
 *   }
 * );
 *
 * batchItems(1);
 * batchItems(2);
 * batchItems(3); // Triggers batch processing
 * ```
 */
export declare function asyncBatch<TValue>(fn: (items: Array<TValue>) => Promise<any>, options: AsyncBatcherOptions<TValue>): (item: TValue) => void;
export {};
