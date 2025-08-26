import { Model, ModelOptions, ModelReturn, ErrorType } from './types';
import { ModelManager } from './model-manager';

// 导出常用类型和验证规则
export { Model, ModelOptions, ModelReturn, ErrorType };
export { ValidationRules, Rule } from './validators';
export { ErrorHandler } from './error-handler';

// 工厂函数 - 创建模型实例
export function createModel(schema: Model, options: ModelOptions = {}): ModelReturn {
    const modelManager = new ModelManager(schema, options);

    return {
        get data() { return { ...modelManager.data }; },
        get validationErrors() { return { ...modelManager.validationErrors }; },
        setField: (field, value) => modelManager.setField(field, value),
        getField: (field) => modelManager.getField(field),
        setFields: (fields) => modelManager.setFields(fields),
        validateAll: () => modelManager.validateAll(),
        getValidationSummary: () => modelManager.getValidationSummary(),
        on: (event, callback) => modelManager.on(event, callback),
        off: (event, callback) => modelManager.off(event, callback),
        getDirtyData: () => modelManager.getDirtyData(),
        clearDirtyData: () => modelManager.clearDirtyData(),
    };
}