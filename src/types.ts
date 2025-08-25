import { ErrorHandler } from './error-handler';
import type { Rule } from './validators';

// 增强的验证器接口
export interface Validator {
    type: string;
    message: string;
    validate: (value: any, data?: Record<string, any>) => boolean | Promise<boolean>;
    // 可选的条件验证
    condition?: (data: Record<string, any>) => boolean;
}

export interface ValidationError {
    field: string;
    message: string;
    rule?: string;
    // 添加错误代码以支持国际化
    code?: string;
}

export interface Reaction {
    fields: string[];
    computed: (values: Record<string, any>) => any;
    action?: (data: Record<string, any>) => void;
}

// 增强的字段架构接口
export interface FieldSchema {
    // 字段类型 - 增加date和enum类型
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'enum';
    // 验证规则
    validator?: (Rule | Validator)[];
    // 默认值
    default?: any;
    // 反应定义
    reaction?: Reaction | Reaction[];
    // 值转换函数
    transform?: (value: any) => any;
}

export interface Model {
    [key: string]: FieldSchema;
}

export interface ModelOptions {
    // 异步验证超时时间（毫秒）
    asyncValidationTimeout?: number;
    // 反应触发的防抖时间（毫秒）
    debounceReactions?: number;
    // 自定义错误格式化函数
    errorFormatter?: (error: ValidationError) => string;
    // 是否严格模式（未知字段会报错）
    strictMode?: boolean;
    // 错误处理器实例
    errorHandler?: ErrorHandler;
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
    off: (event: string, callback?: (...args: any[]) => void) => void;
    getDirtyData: () => Record<string, any>;
    clearDirtyData: () => void;
}