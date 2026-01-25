import { FormApi, FormAsyncValidateOrFn, FormValidateOrFn } from './FormApi.js';
import { AnyFieldMeta } from './FieldApi.js';
import { DeepKeys } from './util-types.js';
type ArrayFieldMode = 'insert' | 'remove' | 'swap' | 'move';
export declare const defaultFieldMeta: AnyFieldMeta;
export declare function metaHelper<TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TSubmitMeta>(formApi: FormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>): {
    handleArrayFieldMetaShift: (field: DeepKeys<TFormData>, index: number, mode: ArrayFieldMode, secondIndex?: number) => void;
};
export {};
