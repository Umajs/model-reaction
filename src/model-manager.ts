import type { Model, ModelOptions, Reaction, ValidationError, FieldSchema, CachedReaction } from './types';
import { validateField } from './utils';

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
    private reactionCache: Record<string, CachedReaction> = {};

    constructor(schema: Model, options?: ModelOptions) {
        this.schema = schema;
        this.options = options || {};
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

        // 标记字段为脏
        this.dirtyFields.add(field);

        // 如果值没有变化，不触发反应
        const valueChanged = this.data[field] !== transformedValue;
        if (valueChanged) {
            this.data[field] = transformedValue;
            this.emit('field:change', { field, value: transformedValue });
            this.triggerReactions(field);
        }

        // 延迟验证
        this.scheduleValidation();

        // 注意：这里返回的是字段是否存在，实际验证结果需要通过 validationErrors 获取
        return true;
    }

    // 批量更新字段
    setFields(fields: Record<string, any>): boolean {
        let allValid = true;
        const changedFields: string[] = [];

        // 先更新所有字段值
        Object.entries(fields).forEach(([field, value]) => {
            const schema = this.schema[field];
            if (!schema) {
                console.error(`字段 ${field} 不存在于模型架构中`);
                allValid = false;
                return;
            }

            let transformedValue = value;
            if (schema.transform) {
                transformedValue = schema.transform(value);
            }

            // 标记字段为脏
            this.dirtyFields.add(field);

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
                    throw new Error(`依赖字段 ${f} 未定义`);
                }
                return { ...values, [f]: this.data[f] };
            }, {} as Record<string, any>);

            // 生成缓存键
            const cacheKey = this.getCacheKey(field, reaction);

            // 检查缓存是否有效
            const cached = this.reactionCache[cacheKey] as CachedReaction;
            let useCache = false;

            if (cached) {
                useCache = true;
                // 检查所有依赖的值是否变化
                for (const depField of reaction.fields) {
                    if (cached.dependencies[depField] !== dependentValues[depField]) {
                        useCache = false;
                        break;
                    }
                }
            }

            if (useCache) {
                // 使用缓存的值
                this.setField(field, cached.computedValue);
                reaction.action({ ...dependentValues, computed: cached.computedValue });
            } else {
                // 计算新值（根据类型定义，这里不再支持Promise）
                try {
                    const computedValue = reaction.computed(dependentValues);

                    // 更新缓存
                    this.reactionCache[cacheKey] = {
                        computedValue: computedValue,
                        dependencies: { ...dependentValues }
                    };

                    this.setField(field, computedValue);
                    reaction.action({ ...dependentValues, computed: computedValue });
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
        // 强制验证所有字段
        this.dirtyFields = new Set(Object.keys(this.schema));
        this.performValidation();

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

    // 清除缓存
    clearCache(): void {
        this.reactionCache = {};
    }
}