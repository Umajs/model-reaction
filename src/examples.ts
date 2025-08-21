import { createModel } from './index';
import { ValidationRules } from './validators';

// 使用示例
const userModel = createModel({
    name: {
        type: 'string',
        validator: [ValidationRules.required],
        default: '',
    },
    age: {
        type: 'number',
        validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
        default: 18
    },
    info: {
        type: 'string',
        reaction: {
            fields: ['name', 'age', 'aaa'],
            computed: (values) => `My name is ${values.name} and I am ${values.age} years old.`,
            action: (values) => console.log('Info updated:', values.computed)
        },
        default: ''
    }
}, {
    debounceReactions: 0,
});

// 同步使用示例
export async function runExample() {
    await userModel.setField('name', 'John');
    await userModel.setField('age', 30);

    console.log('数据信息:', userModel.data);
    console.log('姓名:', userModel.getField('name'));
    console.log('年龄:', userModel.getField('age'));
    console.log('信息:', userModel.getField('info'));

    console.log('\n-------分割线-------\n');

    const invalidAgeValid = await userModel.setField('age', 'invalid');
    console.log('年龄设置是否有效:', invalidAgeValid);
    console.log('错误信息:', JSON.stringify(userModel.validationErrors));
    console.log('验证摘要:', userModel.getValidationSummary());

    console.log('\n-------分割线-------\n');

    setTimeout(() => {
        console.log('数据信息:', userModel.data);
    }, 0)
}

runExample();