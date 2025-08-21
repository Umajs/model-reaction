import type { Model, ModelOptions, Reaction, ValidationError, FieldSchema } from './types';
import { validateField, deepEqual } from './utils';

// 核心模型类 - 封装所有模型相关功能
export class ModelManager {
    data: Record<string, any> = {};
    validationErrors: Record<string, ValidationError[]> = {};
    dirtyData: Record<string, any> = {}; // 存储验证失败的字段及值
    private readonly schema: Model;
    private readonly options: ModelOptions;
    private readonly reactions: Array<{ field: string; reaction: Reaction }> = [];
    private readonly reactionTimeouts: Record<string, number> = {};
    private events: Record<string, Array<(data: any) => void>> = {};
    private asyncValidationTimeout: number;

    constructor(schema: Model, options?: ModelOptions) {
        this.schema = schema;
        this.options = options || {};
        this.asyncValidationTimeout = this.options.asyncValidationTimeout || 5000; // 默认超时时间5秒
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

    // 更新：设置字段值（异步）
    async setField(field: string, value: any): Promise<boolean> {
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
        const isValid = await validateField(schema, transformedValue, this.validationErrors, field, this.asyncValidationTimeout);

        // 验证通过更新值，否则保存到dirtyData
        if (isValid) {
            // 如果值没有变化，不触发反应
            const valueChanged = !deepEqual(this.data[field], transformedValue);
            if (valueChanged) {
                this.data[field] = transformedValue;
                // 从dirtyData中移除（如果存在）
                if (this.dirtyData[field] !== undefined) {
                    delete this.dirtyData[field];
                }
                this.emit('field:change', { field, value: transformedValue });
                this.triggerReactions(field);
            }
        } else {
            // 验证失败，保存到dirtyData
            this.dirtyData[field] = transformedValue;
        }

        // 返回验证结果
        return isValid;
    }

    // 更新：批量更新字段（异步）
    async setFields(fields: Record<string, any>): Promise<boolean> {
        let allValid = true;
        const changedFields: string[] = [];

        // 先验证并更新每个字段
        const validationPromises = Object.entries(fields).map(async ([field, value]) => {
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
            const isValid = await validateField(schema, transformedValue, this.validationErrors, field, this.asyncValidationTimeout);

            if (!isValid) {
                allValid = false;
                // 验证失败，保存到dirtyData
                this.dirtyData[field] = transformedValue;
                return;
            }

            // 只有验证通过且值发生变化才更新
            const valueChanged = !deepEqual(this.data[field], transformedValue);
            if (valueChanged) {
                this.data[field] = transformedValue;
                // 从dirtyData中移除（如果存在）
                if (this.dirtyData[field] !== undefined) {
                    delete this.dirtyData[field];
                }
                changedFields.push(field);
            }
        });

        // 等待所有验证完成
        await Promise.all(validationPromises);

        // 触发所有变更字段的反应
        changedFields.forEach(field => this.triggerReactions(field));

        return allValid;
    }

    // 获取字段值
    getField(field: string): any {
        return this.data[field];
    }

    // 获取dirty数据
    getDirtyData(): Record<string, any> {
        return { ...this.dirtyData };
    }

    // 清除dirty数据
    clearDirtyData(): void {
        this.dirtyData = {};
    }

    // 触发相关反应
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
    private processReaction(field: string, reaction: Reaction): void {
        try {
            const dependentValues = reaction.fields.reduce((values, f) => {
                if (this.data[f] === undefined) {
                    console.error(`依赖字段 ${f} 未定义`);
                    return { ...values, [f]: undefined };
                }
                return { ...values, [f]: this.data[f] };
            }, {} as Record<string, any>);

            // 计算新值
            try {
                const computedValue = reaction.computed(dependentValues);
                this.setField(field, computedValue);
                if (reaction.action) {
                    reaction.action({ ...dependentValues, computed: computedValue });
                }
            } catch (error) {
                this.handleReactionError(field, error);
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

    // 更新：整体验证（异步）
    async validateAll(): Promise<boolean> {
        let allValid = true;
    
        // 验证所有字段
        const validationPromises = Object.keys(this.schema).map(async (field) => {
          const schema = this.schema[field] as FieldSchema;
          // 优先使用 dirtyData 中的值，如果没有则使用 data 中的值
          const value = this.dirtyData[field] !== undefined ? this.dirtyData[field] : this.data[field];
          this.validationErrors[field] = [];
          const isValid = await validateField(schema, value, this.validationErrors, field, this.asyncValidationTimeout);
          if (!isValid) {
            allValid = false;
            // 验证失败，确保值在 dirtyData 中
            this.dirtyData[field] = value;
          } else {
            // 验证通过，从 dirtyData 中移除
            if (this.dirtyData[field] !== undefined) {
              delete this.dirtyData[field];
            }
            // 更新 data 中的值
            if (!deepEqual(this.data[field], value)) {
              this.data[field] = value;
              this.emit('field:change', { field, value });
              this.triggerReactions(field);
            }
          }
        });
    
        await Promise.all(validationPromises);
    
        // 触发验证完成事件
        this.emit('validation:complete', { isValid: allValid });
    
        // 检查是否有错误
        return allValid;
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