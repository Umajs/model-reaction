import { ErrorType, AppError } from './types';

// 统一错误处理类
export class ErrorHandler {
    private errorListeners: Record<
        ErrorType,
        Array<(error: AppError) => void>
    > = {
        [ErrorType.VALIDATION]: [],
        [ErrorType.REACTION]: [],
        [ErrorType.FIELD_NOT_FOUND]: [],
        [ErrorType.DEPENDENCY_ERROR]: [],
        [ErrorType.UNKNOWN]: [],
    };

    constructor() {}

    // 订阅错误
    onError(type: ErrorType, listener: (error: AppError) => void): void {
        if (!this.errorListeners[type]) {
            this.errorListeners[type] = [];
        }
        this.errorListeners[type].push(listener);
    }

    // 取消订阅
    offError(type: ErrorType, listener: (error: AppError) => void): void {
        if (this.errorListeners[type]) {
            this.errorListeners[type] = this.errorListeners[type].filter(
                (l) => l !== listener
            );
        }
    }

    // 触发错误
    triggerError(error: AppError): void {
        console.error(
            `[${error.type}] ${error.field ? `字段 ${error.field}: ` : ''}${
                error.message
            }`
        );

        // 触发特定类型的错误监听器
        if (this.errorListeners[error.type]) {
            this.errorListeners[error.type].forEach((listener) =>
                listener(error)
            );
        }

        // 触发通用错误监听器
        if (this.errorListeners[ErrorType.UNKNOWN]) {
            this.errorListeners[ErrorType.UNKNOWN].forEach((listener) =>
                listener(error)
            );
        }
    }

    // 创建验证错误
    createValidationError(field: string, message: string): AppError {
        return {
            type: ErrorType.VALIDATION,
            field,
            message,
        };
    }

    // 创建反应错误
    createReactionError(field: string, error: Error): AppError {
        return {
            type: ErrorType.REACTION,
            field,
            message: error.message,
            originalError: error,
        };
    }

    // 创建字段未找到错误
    createFieldNotFoundError(field: string): AppError {
        return {
            type: ErrorType.FIELD_NOT_FOUND,
            field,
            message: `字段 ${field} 不存在于模型架构中`,
        };
    }

    // 创建依赖错误
    createDependencyError(field: string, dependency: string): AppError {
        return {
            type: ErrorType.DEPENDENCY_ERROR,
            field,
            message: `依赖字段 ${dependency} 未定义`,
        };
    }
}
