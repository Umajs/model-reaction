// 验证规则实现 - 独立的验证规则系统
export class Rule {
    type: string;
    message: string;
    validate: (value: any) => boolean | Promise<boolean>;

    constructor(
        type: string,
        message: string,
        validate: (value: any) => boolean | Promise<boolean>
    ) {
        this.type = type;
        this.message = message;
        this.validate = validate;
    }
}

// 内置验证规则 - 可复用的验证逻辑
export const ValidationRules = {
    required: new Rule('required', '该字段为必填项',
        (v) => v !== undefined && v !== null && v !== ''
    ),
    number: new Rule('number', '必须为数字',
        (v) => typeof v === 'number'
    ),
    min: (min: number) => new Rule('min', `值必须大于等于${min}`,
        (v) => v >= min
    ),
    email: new Rule('email', '无效的邮箱格式', // 添加email验证规则
        (v) => typeof v === 'string' && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)
    ),
    // 新增：异步验证示例 - 模拟服务器验证
    asyncUnique: (fieldName: string) => new Rule(
        'asyncUnique',
        `${fieldName} 已存在`,
        async (v) => {
            // 模拟API调用
            return new Promise((resolve) => {
                setTimeout(() => {
                    // 模拟验证逻辑，这里简单地假设非空值都是唯一的
                    resolve(!!v);
                }, 500);
            });
        }
    )
};