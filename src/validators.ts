// 验证规则实现 - 独立的验证规则系统
export class Rule {
    type: string;
    message: string;
    validate: (value: any) => boolean;

    constructor(
        type: string,
        message: string,
        validate: (value: any) => boolean,
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
};