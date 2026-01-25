import { ServerFormState } from './types.cjs';
export declare const initialFormState: {
    errorMap: {
        onServer: undefined;
    };
    errors: never[];
};
export declare const getFormData: () => Promise<{
    errorMap: {
        onServer: undefined;
    };
    errors: never[];
} | ServerFormState<any, undefined>>;
