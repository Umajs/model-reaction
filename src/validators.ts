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

    // 允许自定义错误消息
    withMessage(message: string): Rule {
        return new Rule(this.type, message, this.validate);
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
    email: new Rule('email', '无效的邮箱格式',
        (v) => typeof v === 'string' && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)
    )
};