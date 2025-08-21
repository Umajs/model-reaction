import type { FieldSchema, ValidationError } from './types';

// 统一验证函数 - 同时支持同步和异步验证
export async function validateField(
    schema: FieldSchema,
    value: any,
    errors: Record<string, ValidationError[]>,
    field: string,
    timeout: number = 5000
): Promise<boolean> {
    if (!schema.validator) return true;
    let isValid = true;

    // 收集所有验证Promise
    const validationPromises = schema.validator.map(validator => {
        // 包装同步验证为Promise
        let validationPromise: Promise<boolean>;
        if (validator.validate) {
            const result = validator.validate(value);
            if (result instanceof Promise) {
                validationPromise = result;
            } else {
                validationPromise = Promise.resolve(result);
            }
        } else {
            validationPromise = Promise.resolve(true);
        }

        // 添加超时处理 - 浏览器环境中timeoutId为number类型
        let timeoutId: number;
        const timeoutPromise = new Promise<boolean>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error(`验证超时: ${field}`)), timeout) as unknown as number;
        });

        return Promise.race([validationPromise, timeoutPromise])
            .then(result => {
                clearTimeout(timeoutId); // 验证完成后清除定时器
                if (!result) {
                    errors[field] = errors[field] || [];
                    errors[field].push({
                        field,
                        rule: validator.type,
                        message: validator.message
                    });
                    isValid = false;
                }
                return result;
            })
            .catch(error => {
                clearTimeout(timeoutId); // 验证失败后清除定时器
                console.error(`验证失败 [${field}]:`, error);
                errors[field] = errors[field] || [];
                errors[field].push({
                    field,
                    rule: 'validation_error',
                    message: `验证失败: ${error.message}`
                });
                isValid = false;
                return false;
            });
    });

    // 等待所有验证完成
    await Promise.all(validationPromises);

    return isValid;
}

// 深度比较两个值是否相等
export function deepEqual(a: any, b: any): boolean {
    // 如果引用相同，直接返回true
    if (a === b) return true;

    // 如果其中一个为null或不是对象，返回false
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }

    // 处理数组
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // 处理对象
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
            return false;
        }
    }
    return true;
}