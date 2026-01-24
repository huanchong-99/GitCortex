import { ServerFormState } from './types.js';
import { FormAsyncValidateOrFn } from '@tanstack/form-core';
interface ServerValidateErrorState<TFormData, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>> {
    formState: ServerFormState<TFormData, TOnServer>;
    response: Response;
}
export declare class ServerValidateError<TFormData, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>> extends Error implements ServerValidateErrorState<TFormData, TOnServer> {
    formState: ServerFormState<TFormData, TOnServer>;
    response: Response;
    constructor(options: ServerValidateErrorState<TFormData, TOnServer>);
}
export {};
