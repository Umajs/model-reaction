import type { Model, ModelOptions, Reaction, ValidationError, FieldSchema } from './types';
import { validateField } from './utils';

// 核心模型类 - 封装所有模型相关功能
export class ModelManager {
    data: Record<string, any> = {};
    validationErrors: Record<string, ValidationError[]> = {};
    private readonly schema: Model;
    private readonly options: ModelOptions;
    private readonly reactions: Array<{ field: string; reaction: Reaction }> = [];
    private readonly reactionTimeouts: Record<string, number> = {};

    constructor(schema: Model, options?: ModelOptions) {
        this.schema = schema;
        // this.schema = schema; // 移除重复赋值
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

    // 设置字段值（同步）
    /**
     * 设置字段值并触发验证和反应
     * @param field 字段名称
     * @param value 要设置的值
     * @returns 是否成功设置（通过验证）
     */
    // 添加事件系统
    private events: Record<string, Array<(data: any) => void>> = {};
    
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
    
    // 在 setField 成功后触发事件
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

        // 执行验证
        const isValid = validateField(schema, transformedValue, this.validationErrors, field);

        if (isValid) {
            this.data[field] = transformedValue;
            this.emit('field:change', { field, value: transformedValue });
            this.triggerReactions(field);
        }

        return isValid;
    }

    // 添加批量更新方法
    setFields(fields: Record<string, any>): boolean {
        let allValid = true;
        const changedFields: string[] = [];
        this.validationErrors = {};
    
        // 先验证所有字段
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
    
            const isValid = validateField(schema, transformedValue, this.validationErrors, field);
            if (isValid) {
                this.data[field] = transformedValue;
                changedFields.push(field);
            } else {
                allValid = false;
            }
        });
    
        // 触发所有变更字段的反应
        if (allValid) {
            changedFields.forEach(field => this.triggerReactions(field));
        }
    
        return allValid;
    }

    // 获取字段值
    getField(field: string): any {
        return this.data[field];
    }

    // 触发相关反应
    // 优化 triggerReactions 方法
    private triggerReactions(changedField: string): void {
        const debounceTime = this.options.debounceReactions || 0;
        const affectedReactions = new Set<string>();
    
        // 收集所有受影响的反应字段
        this.reactions.forEach(({ field, reaction }) => {
            if (reaction.fields.includes(changedField)) {
                affectedReactions.add(field);
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

    // 处理单个反应
    // 增强错误处理
    private processReaction(field: string, reaction: Reaction): void {
        try {
            const dependentValues = reaction.fields.reduce((values, f) => {
                if (this.data[f] === undefined) {
                    throw new Error(`依赖字段 ${f} 未定义`);
                }
                return { ...values, [f]: this.data[f] };
            }, {} as Record<string, any>);
    
            const computedValue = reaction.computed(dependentValues);
    
            // 检查 computedValue 是否为 Promise
            if (computedValue instanceof Promise) {
                computedValue.then(value => {
                    this.setField(field, value);
                    reaction.action({ ...dependentValues, computed: value });
                }).catch(error => {
                    this.handleReactionError(field, error);
                });
            } else {
                this.setField(field, computedValue);
                reaction.action({ ...dependentValues, computed: computedValue });
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

    // 整体验证
    validateAll(): boolean {
        let isValid = true;
        this.validationErrors = {};

        Object.entries(this.schema).forEach(([field, schema]) => {
            const value = this.data[field];
            const fieldIsValid = validateField(schema, value, this.validationErrors, field);
            if (!fieldIsValid) isValid = false;
        });

        return isValid;
    }

    // 获取验证摘要
    getValidationSummary(): string {
        const errors = Object.values(this.validationErrors).flat();
        if (errors.length === 0) return '验证通过';

        if (this.options.errorFormatter) {
            return errors.map(this.options.errorFormatter).join('; ');
        }

        return errors.map(err => `${err.field}: ${err.message}`).join('; ');
    }
}