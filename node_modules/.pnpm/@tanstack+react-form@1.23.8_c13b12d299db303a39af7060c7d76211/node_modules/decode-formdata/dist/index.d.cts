/**
 * Form data entry type.
 */
interface FormDataEntry {
    path: string;
    input: File | string;
    output: boolean | Date | File | null | number | string | undefined;
}
/**
 * Form data transform type.
 */
type FormDataTransform = (entry: FormDataEntry) => any;
/**
 * Form data info type.
 */
interface FormDataInfo {
    arrays?: string[];
    booleans?: string[];
    dates?: string[];
    files?: string[];
    numbers?: string[];
}

/**
 * Decodes the form data entries. Information that is lost during the transfer
 * via HTTP can be supplemented.
 *
 * @param formData The form data object.
 * @param info The form data info.
 * @param transform The value transformation.
 *
 * @returns The decoded form values.
 */
declare function decode<TOutput extends Record<string, any> = Record<string, unknown>>(formData: FormData, info: FormDataInfo, transform?: FormDataTransform): TOutput;
/**
 * Decodes the form data entries. Information that is lost during the transfer
 * via HTTP can be supplemented.
 *
 * @param formData The form data object.
 * @param transform The value transformation.
 *
 * @returns The decoded form values.
 */
declare function decode<TOutput extends Record<string, any> = Record<string, unknown>>(formData: FormData, transform?: FormDataTransform): TOutput;

/**
 * Returns the decoded date of a field.
 *
 * @param value The field value.
 *
 * @returns The decoded date.
 */
declare function getFieldDate(value: string): Date | null | undefined;

/**
 * Returns the decoded value of a field.
 *
 * @param info The form data info.
 * @param templateName The template name.
 * @param value The field value.
 *
 * @returns The decoded value.
 */
declare function getFieldValue(info: FormDataInfo | undefined, templateName: string, value: FormDataEntryValue): boolean | Date | number | FormDataEntryValue | null | undefined;

/**
 * Returns the value of a path and supplements empty arrays and objects.
 *
 * @param pathKeys The path keys.
 * @param templateKeys The template keys.
 * @param values The values object.
 *
 * @returns The path value.
 */
declare function getPathObject(pathKeys: string[], templateKeys: string[], values: any): any;

/**
 * Returns every possible value path.
 *
 * @param templateName The template name.
 * @param values The values object.
 *
 * @returns Every value path.
 */
declare function getValuePaths(templateName: string, values: any): string[];

export { type FormDataEntry, type FormDataInfo, type FormDataTransform, decode, getFieldDate, getFieldValue, getPathObject, getValuePaths };
