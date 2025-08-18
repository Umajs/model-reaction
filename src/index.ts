import type { Model, ModelOptions, ModelReturn } from './types';
import { ModelManager } from './model-manager';

// 导出常用类型和验证规则
export type { Model, ModelOptions, ModelReturn } from './types';
export { ValidationRules } from './validators';

// 工厂函数 - 创建模型实例
export function createModel(schema: Model, options: ModelOptions = {}): ModelReturn {
    const modelManager = new ModelManager(schema, options);

    return {
        get data() { return { ...modelManager.data }; },
        get validationErrors() { return { ...modelManager.validationErrors }; },
        setField: (field, value) => modelManager.setField(field, value),
        getField: (field) => modelManager.getField(field),
        validateAll: () => modelManager.validateAll(),
        getValidationSummary: () => modelManager.getValidationSummary()
    };
}