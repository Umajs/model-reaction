// 类型定义区域 - 集中管理所有接口和类型
export interface Validator {
    type: string;
    message: string;
    validate?: (value: any) => boolean; // 同步验证
}

export interface ValidationError {
    field: string;
    rule: string;
    message: string;
    value?: any;
}

export interface Reaction<T = any> {
    fields: string[];
    computed: (values: Record<string, any>) => T;
    action?: (values: { computed: T } & Record<string, any>) => void; // 改为可选字段
}

export interface FieldSchema {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'model'; // 新增'model'类型
    validator?: Validator[];
    reaction?: Reaction | Reaction[];
    default?: any;
    transform?: (value: any) => any; // 同步转换
    model?: Model; // 当type为'model'时，指定嵌套模型的结构
}

export interface Model {
    [key: string]: FieldSchema;
}

// 更新类型定义以支持新的配置选项
export interface ModelOptions {
    debounceReactions?: number;
    errorFormatter?: (error: ValidationError) => string;
    validationDelay?: number; // 新增：验证延迟时间（毫秒）
    useCache?: boolean; // 新增：缓存开关选项
    cacheMaxAge?: number; // 新增：缓存最大存活时间（毫秒）
    cacheSizeLimit?: number; // 新增：缓存大小限制
}

export interface ModelReturn {
    data: Readonly<Record<string, any>>; // 只读数据访问
    setField: (field: string, value: any) => boolean; // 同步设置字段
    getField: (field: string) => any;
    setFields: (fields: Record<string, any>) => boolean; // 批量设置字段
    validationErrors: Readonly<Record<string, ValidationError[]>>; // 只读错误信息
    validateAll: () => boolean; // 同步整体验证
    getValidationSummary: () => string;
    on: (event: string, callback: (data: any) => void) => void; // 事件订阅
    clearCache: () => void; // 清除缓存
}

export interface CachedReaction {
    computedValue: any;
    dependencies: Record<string, any>;
    lastUsed: number; // 新增：最后使用时间戳
}