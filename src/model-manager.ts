import type { Model, ModelOptions, Reaction, ValidationError, FieldSchema, CachedReaction } from './types';
import { validateField, deepEqual } from './utils';

// 核心模型类 - 封装所有模型相关功能
export class ModelManager {
    data: Record<string, any> = {};
    validationErrors: Record<string, ValidationError[]> = {};
    private readonly schema: Model;
    private readonly options: ModelOptions;
    private readonly reactions: Array<{ field: string; reaction: Reaction }> = [];
    private readonly reactionTimeouts: Record<string, number> = {};
    private events: Record<string, Array<(data: any) => void>> = {};

    // 惰性验证相关属性
    private dirtyFields: Set<string> = new Set();
    private isValidationPending: boolean = false;

    // 缓存机制相关属性
    private useCache: boolean; // 新增：缓存开关状态
    private cacheMaxAge: number;
    private cacheSizeLimit: number;
    private reactionCache: Record<string, CachedReaction> = {};

    constructor(schema: Model, options?: ModelOptions) {
        this.schema = schema;
        this.options = options || {};
        this.cacheMaxAge = this.options.cacheMaxAge || 3600000; // 默认1小时
        this.cacheSizeLimit = this.options.cacheSizeLimit || 1000; // 默认最多1000个缓存项
        this.useCache = this.options.useCache !== undefined ? this.options.useCache : false; // 默认关闭缓存
        this.initializeDefaults();
        this.collectReactions();
    }

    // 初始化默认值
    private initializeDefaults(): void {
        Object.entries(this.schema).forEach(([field, schema]) => {
            if (schema.default !== undefined) {
                this.data[field] = schema.default;
            }
        });
    }

    // 收集所有反应
    private collectReactions(): void {
        Object.entries(this.schema).forEach(([field, schema]) => {
            if (schema.reaction) {
                const reactions = Array.isArray(schema.reaction) ? schema.reaction : [schema.reaction];
                reactions.forEach(reaction => {
                    this.reactions.push({ field, reaction });
                });
            }
        });
    }

    // 订阅事件
    on(event: string, callback: (data: any) => void): void {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    // 触发事件
    private emit(event: string, data: any): void {
        if (this.events[event]) {
            this.events[event].forEach(callback => callback(data));
        }
    }

    // 设置字段值（使用惰性验证）
    setField(field: string, value: any): boolean {
        const schema = this.schema[field];
        if (!schema) {
            console.error(`字段 ${field} 不存在于模型架构中`);
            return false;
        }

        // 清除之前的错误
        this.validationErrors[field] = [];

        // 应用转换
        let transformedValue = value;
        if (schema.transform) {
            transformedValue = schema.transform(value);
        }

        // 立即验证该字段
        const isValid = validateField(schema, transformedValue, this.validationErrors, field);

        // 只有验证通过才更新值
        if (isValid) {
            // 标记字段为脏
            this.dirtyFields.add(field);

            // 如果值没有变化，不触发反应
            const valueChanged = this.data[field] !== transformedValue;
            if (valueChanged) {
                this.data[field] = transformedValue;
                this.emit('field:change', { field, value: transformedValue });
                this.triggerReactions(field);
            }

            // 延迟验证其他脏字段
            this.scheduleValidation();
        }

        // 返回验证结果
        return isValid;
    }

    // 批量更新字段
    setFields(fields: Record<string, any>): boolean {
        let allValid = true;
        const changedFields: string[] = [];

        // 先验证并更新每个字段
        Object.entries(fields).forEach(([field, value]) => {
            const schema = this.schema[field];
            if (!schema) {
                console.error(`字段 ${field} 不存在于模型架构中`);
                allValid = false;
                return;
            }

            // 清除之前的错误
            this.validationErrors[field] = [];

            // 应用转换
            let transformedValue = value;
            if (schema.transform) {
                transformedValue = schema.transform(value);
            }

            // 验证字段
            const isValid = validateField(schema, transformedValue, this.validationErrors, field);

            if (!isValid) {
                allValid = false;
                return;
            }

            // 标记字段为脏
            this.dirtyFields.add(field);

            // 只有验证通过且值发生变化才更新
            if (this.data[field] !== transformedValue) {
                this.data[field] = transformedValue;
                changedFields.push(field);
            }
        });

        // 触发所有变更字段的反应
        changedFields.forEach(field => this.triggerReactions(field));

        // 延迟验证
        this.scheduleValidation();

        return allValid;
    }

    // 安排验证
    private scheduleValidation(): void {
        if (this.isValidationPending) return;

        this.isValidationPending = true;

        // 使用微任务或宏任务延迟验证
        const validationDelay = this.options.validationDelay || 0;
        if (validationDelay > 0) {
            setTimeout(() => this.performValidation(), validationDelay);
        } else {
            // 使用微任务优先
            Promise.resolve().then(() => this.performValidation());
        }
    }

    // 执行验证
    private performValidation(): void {
        if (this.dirtyFields.size === 0) {
            this.isValidationPending = false;
            return;
        }

        // 验证所有脏字段
        this.dirtyFields.forEach(field => {
            const schema = this.schema[field] as FieldSchema;
            const value = this.data[field];
            this.validationErrors[field] = [];
            validateField(schema, value, this.validationErrors, field);
        });

        this.dirtyFields.clear();
        this.isValidationPending = false;
        this.emit('validation:complete', { errors: this.validationErrors });
    }

    // 获取字段值
    getField(field: string): any {
        return this.data[field];
    }

    // 触发相关反应
    private triggerReactions(changedField: string): void {
        const debounceTime = this.options.debounceReactions || 0;
        const affectedReactions = new Set<string>();

        // 收集所有受影响的反应字段
        this.reactions.forEach(({ field, reaction }) => {
            if (reaction.fields.includes(changedField)) {
                affectedReactions.add(field);
                // 使相关反应的缓存失效
                const cacheKey = this.getCacheKey(field, reaction);
                delete this.reactionCache[cacheKey];
            }
        });

        // 触发反应，确保每个字段只触发一次
        affectedReactions.forEach(field => {
            const reaction = this.reactions.find(r => r.field === field)?.reaction;
            if (reaction) {
                if (this.reactionTimeouts[field]) {
                    clearTimeout(this.reactionTimeouts[field]);
                }

                if (debounceTime > 0) {
                    this.reactionTimeouts[field] = setTimeout(() => {
                        this.processReaction(field, reaction);
                    }, debounceTime);
                } else {
                    this.processReaction(field, reaction);
                }
            }
        });
    }

    // 生成缓存键
    private getCacheKey(field: string, reaction: Reaction): string {
        return `${field}_${reaction.fields.join('_')}`;
    }

    // 处理单个反应（带缓存）
    private processReaction(field: string, reaction: Reaction): void {
        try {
            const dependentValues = reaction.fields.reduce((values, f) => {
                if (this.data[f] === undefined) {
                    console.error(`依赖字段 ${f} 未定义`);
                    return { ...values, [f]: undefined };
                }
                return { ...values, [f]: this.data[f] };
            }, {} as Record<string, any>);

            // 生成缓存键
            const cacheKey = this.getCacheKey(field, reaction);

            // 检查缓存是否有效
            let cached: CachedReaction | undefined;
            let useCache = false;

            // 只有启用缓存时才检查缓存
            if (this.useCache) {
                cached = this.reactionCache[cacheKey];

                // 改进的依赖比较算法
                if (cached) {
                    // 快速路径：如果依赖字段数量不同，直接失效缓存
                    if (Object.keys(cached.dependencies).length !== Object.keys(dependentValues).length) {
                        useCache = false;
                    } else {
                        useCache = true;
                        // 使用Map和更高效的比较方式
                        for (const depField of reaction.fields) {
                            const cachedValue = cached.dependencies[depField];
                            const currentValue = dependentValues[depField];

                            // 针对复杂对象使用深度比较
                            if (typeof cachedValue === 'object' && cachedValue !== null &&
                                typeof currentValue === 'object' && currentValue !== null) {
                                // 使用导入的deepEqual函数
                                if (!deepEqual(cachedValue, currentValue)) {
                                    useCache = false;
                                    break;
                                }
                            } else if (cachedValue !== currentValue) {
                                // 基本类型使用严格比较
                                useCache = false;
                                break;
                            }
                        }
                    }
                }
            }

            if (this.useCache && useCache && cached) {
                // 使用缓存的值
                this.setField(field, cached.computedValue);
                if (reaction.action) {
                    reaction.action({ ...dependentValues, computed: cached.computedValue });
                }
            } else {
                // 计算新值
                try {
                    const computedValue = reaction.computed(dependentValues);

                    // 只有启用缓存时才更新缓存
                    if (this.useCache) {
                        this.reactionCache[cacheKey] = {
                            computedValue: computedValue,
                            dependencies: { ...dependentValues },
                            lastUsed: Date.now()
                        };
                    }

                    this.setField(field, computedValue);
                    if (reaction.action) {
                        reaction.action({ ...dependentValues, computed: computedValue });
                    }
                } catch (error) {
                    this.handleReactionError(field, error);
                }
            }
        } catch (error) {
            this.handleReactionError(field, error);
        }
    }

    private handleReactionError(field: string, error: unknown): void {
        console.error(`反应处理失败 [${field}]:`, error);
        if (!this.validationErrors['__reactions']) {
            this.validationErrors['__reactions'] = [];
        }
        this.validationErrors['__reactions'].push({
            field,
            rule: 'reaction_error',
            message: `反应处理失败: ${error instanceof Error ? error.message : String(error)}`
        });
        this.emit('reaction:error', { field, error });
    }

    // 整体验证（强制验证所有字段）
    validateAll(): boolean {
        // 检查是否有错误（包括反应错误）
        return Object.values(this.validationErrors).flat().length === 0;
    }

    // 获取验证摘要
    getValidationSummary(): string {
        // 确保验证已完成
        if (this.isValidationPending) {
            this.performValidation();
        }

        const errors = Object.values(this.validationErrors).flat();
        if (errors.length === 0) return '验证通过';

        if (this.options.errorFormatter) {
            return errors.map(this.options.errorFormatter).join('; ');
        }

        return errors.map(err => `${err.field}: ${err.message}`).join('; ');
    }

    // 手动触发缓存全部清除方法
    clearCache(): void {
        // 只有启用缓存时才执行清除
        if (this.useCache) {
            // 清空缓存对象
            this.reactionCache = {};
            // 触发缓存清除事件
            this.emit('cache:cleared', {});
        }
    }

    // 供外部调用的定期清理过期缓存方法
    cleanupCache(): void {
        // 只有启用缓存时才执行清理
        if (!this.useCache) return;

        const now = Date.now();
        const cacheEntries = Object.entries(this.reactionCache);

        // 1. 移除过期缓存
        for (const [key, cache] of cacheEntries) {
            if (now - cache.lastUsed > this.cacheMaxAge) {
                delete this.reactionCache[key];
            }
        }

        // 2. 如果缓存数量超过限制，使用LRU策略清理
        const currentCacheSize = Object.keys(this.reactionCache).length;
        if (currentCacheSize > this.cacheSizeLimit) {
            // 按最后使用时间排序
            const sortedEntries = cacheEntries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
            // 移除最早使用的缓存项
            const itemsToRemove = currentCacheSize - this.cacheSizeLimit;
            for (let i = 0; i < itemsToRemove; i++) {
                if (sortedEntries[i]?.[0]) {
                    const cacheKey = sortedEntries[i]?.[0];
                    if (cacheKey) {
                        delete this.reactionCache[cacheKey];
                    }
                }
            }
        }
    }
}