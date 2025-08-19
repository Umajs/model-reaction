import { createModel, Model } from './index';
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
export function runExample() {
    userModel.setField('name', 'John');
    userModel.setField('age', 30);

    console.log('数据信息:', userModel.data);
    console.log('姓名:', userModel.getField('name'));
    console.log('年龄:', userModel.getField('age'));
    console.log('信息:', userModel.getField('info'));

    console.log('\n-------分割线-------\n');

    const invalidAgeValid = userModel.setField('age', 'invalid');
    console.log('年龄设置是否有效:', invalidAgeValid);
    console.log('错误信息:', JSON.stringify(userModel.validationErrors));
    console.log('验证摘要:', userModel.getValidationSummary());

    console.log('\n-------分割线-------\n');

    console.log('数据信息:', userModel.data);
    // setTimeout(() => {
    //     console.log('数据信息:', userModel.data);
    // }, 0)
}

runExample();


// 定义地址模型
const addressSchema: Model = {
    street: { type: 'string', validator: [{ type: 'required', message: '街道必填' }] },
    city: { type: 'string', default: '上海', validator: [{ type: 'required', message: '城市必填' }] },
    zipCode: { type: 'string', validator: [{ type: 'required', message: '邮编必填' }] }
};

// 定义用户模型，包含地址嵌套模型
const userSchema: Model = {
    name: { type: 'string', validator: [{ type: 'required', message: '姓名必填' }] },
    age: { type: 'number', validator: [{ type: 'min', message: '年龄必须大于等于18', validate: (v) => v >= 18 }] },
    address: { type: 'model', model: addressSchema } // 嵌套模型
};

// 创建用户模型实例
const userModel2 = createModel(userSchema);

// 设置嵌套字段
userModel2.setField('name', '张三');
console.log(userModel2.getField('address.city'));
userModel2.setField('address.city', '北京'); // 路径访问

// 获取嵌套字段
console.log(userModel2.getField('address.city')); // 输出: 北京