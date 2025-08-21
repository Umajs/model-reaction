import type { Rule } from './validators';

export interface Validator {
    type: string;
    message: string;
    validate: (value: any, data?: Record<string, any>) => boolean | Promise<boolean>;
}

export interface ValidationError {
    field: string;
    message: string;
    rule?: string;
}

export interface Reaction {
    fields: string[];
    computed: (values: Record<string, any>) => any;
    action?: (data: Record<string, any>) => void;
}

export interface FieldSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validator?: (Rule | Validator)[];
    default?: any;
    reaction?: Reaction | Reaction[];
    transform?: (value: any) => any;
}

export interface Model {
    [key: string]: FieldSchema;
}

export interface ModelOptions {
    asyncValidationTimeout?: number;
    debounceReactions?: number;
    errorFormatter?: (error: ValidationError) => string;
}

export interface ModelReturn {
    data: Record<string, any>;
    validationErrors: Record<string, ValidationError[]>;
    setField: (field: string, value: any) => Promise<boolean>;
    getField: (field: string) => any;
    setFields: (fields: Record<string, any>) => Promise<boolean>;
    validateAll: () => Promise<boolean>;
    getValidationSummary: () => string;
    on: (event: string, callback: (...args: any[]) => void) => void;
    getDirtyData: () => Record<string, any>;
    clearDirtyData: () => void;
}