import { Derived, Store } from '@tanstack/store';
export * from '@tanstack/store';
/**
 * @private
 */
export type NoInfer<T> = [T][T extends any ? 0 : never];
export declare function useStore<TState, TSelected = NoInfer<TState>>(store: Store<TState, any>, selector?: (state: NoInfer<TState>) => TSelected): TSelected;
export declare function useStore<TState, TSelected = NoInfer<TState>>(store: Derived<TState, any>, selector?: (state: NoInfer<TState>) => TSelected): TSelected;
export declare function shallow<T>(objA: T, objB: T): boolean;
