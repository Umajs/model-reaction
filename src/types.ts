// 类型定义区域 - 集中管理所有接口和类型
interface Validator {
    type: string;
    message: string;
    validate?: (value: any) => boolean; // 同步验证
}

interface ValidationError {
    field: string;
    rule: string;
    message: string;
    value?: any;
}

interface Reaction<T = any> {
    fields: string[];
    computed: (values: Record<string, any>) => T;
    action: (values: { computed: T } & Record<string, any>) => void;
}

interface FieldSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validator?: Validator[];
    reaction?: Reaction | Reaction[];
    default?: any;
    transform?: (value: any) => any; // 同步转换
}

interface Model {
    [key: string]: FieldSchema;
}

interface ModelOptions {
    debounceReactions?: number;
    errorFormatter?: (error: ValidationError) => string;
}

interface ModelReturn {
    data: Readonly<Record<string, any>>; // 只读数据访问
    setField: (field: string, value: any) => boolean; // 同步设置字段
    getField: (field: string) => any;
    validationErrors: Readonly<Record<string, ValidationError[]>>; // 只读错误信息
    validateAll: () => boolean; // 同步整体验证
    getValidationSummary: () => string;
}

export type {
    Validator, ValidationError, Reaction, FieldSchema, Model, ModelOptions, ModelReturn
};