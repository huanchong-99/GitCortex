import { AnyFunction } from './types.cjs';
export declare function isFunction<T extends AnyFunction>(value: any): value is T;
export declare function parseFunctionOrValue<T, TArgs extends Array<any>>(value: T | ((...args: TArgs) => T), ...args: TArgs): T;
export declare function createKey(key?: string): string;
