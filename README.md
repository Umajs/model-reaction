


          
我需要先查看当前 README.md 文件的内容，以便了解已有的信息并进行扩展。
        
            
toolName: view_files
            
status: success
          
            
filePath: /Users/bytedance/code/test/model-reaction/README.md
          
# model-reaction

一个强大的、类型安全的数据模型管理库，支持数据验证、依赖反应和缓存机制。

## 项目简介

`model-reaction` 是一个用于管理应用程序数据模型的 TypeScript 库，提供以下核心功能：

- **数据验证**：支持同步验证规则，确保数据符合预期格式
- **依赖反应**：当指定字段变化时，自动触发相关计算和操作
- **缓存机制**：优化计算性能，避免不必要的重复计算
- **事件系统**：支持订阅字段变化和验证完成等事件
- **类型安全**：完全基于 TypeScript 构建，提供良好的类型提示

## 安装

```bash
# 使用 npm
npm install model-reaction

# 使用 yarn
yarn add model-reaction
```

## 基本使用

```typescript
import { createModel } from 'model-reaction';
import { ValidationRules } from 'model-reaction/validators';

// 定义模型架构
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
      fields: ['name', 'age'],
      computed: (values) => `My name is ${values.name} and I am ${values.age} years old.`,
      action: (values) => console.log('Info updated:', values.computed)
    },
    default: ''
  }
}, {
  debounceReactions: 100,
});

// 设置字段值
userModel.setField('name', 'John');
userModel.setField('age', 30);

// 获取字段值
console.log('姓名:', userModel.getField('name')); // 输出: John
console.log('年龄:', userModel.getField('age')); // 输出: 30
console.log('信息:', userModel.getField('info')); // 输出: My name is John and I am 30 years old.

// 验证所有字段
const isValid = userModel.validateAll();
console.log('验证是否通过:', isValid);
console.log('验证错误:', userModel.validationErrors);
console.log('验证摘要:', userModel.getValidationSummary());
```

## API 文档

### ModelManager

核心类，负责数据管理、验证和反应处理。

#### 构造函数

```typescript
new ModelManager(schema: Model, options?: ModelOptions);
```

**参数**：
- `schema`: 模型架构定义，详细说明见下方 **类型定义** 部分
- `options`: 可选配置参数，详细说明见下方 **模型选项** 部分

#### 方法

##### setField

设置单个字段值

```typescript
setField(field: string, value: any): boolean;
```

**参数**：
- `field`: 字段名称
- `value`: 要设置的值

**返回值**：
- `boolean`: 字段是否存在于模型中

**示例**：
```typescript
const result = modelManager.setField('name', 'John');
console.log(result); // true (如果 'name' 字段存在)
```

##### getField

获取字段值

```typescript
getField(field: string): any;
```

**参数**：
- `field`: 字段名称

**返回值**：
- `any`: 字段的当前值

**示例**：
```typescript
const name = modelManager.getField('name');
console.log(name); // 'John'
```

##### setFields

批量设置字段值

```typescript
setFields(fields: Record<string, any>): boolean;
```

**参数**：
- `fields`: 包含多个字段键值对的对象

**返回值**：
- `boolean`: 是否所有字段都成功设置

**示例**：
```typescript
const result = modelManager.setFields({
  name: 'John',
  age: 30
});
console.log(result); // true (如果所有字段都存在)
```

##### validateAll

验证所有字段

```typescript
validateAll(): boolean;
```

**返回值**：
- `boolean`: 所有字段是否都验证通过

**示例**：
```typescript
const isValid = modelManager.validateAll();
console.log(isValid); // true 或 false
```

##### getValidationSummary

获取验证摘要

```typescript
getValidationSummary(): string;
```

**返回值**：
- `string`: 验证结果的摘要信息

**示例**：
```typescript
const summary = modelManager.getValidationSummary();
console.log(summary); // '验证通过' 或 'name: 该字段为必填项; age: 必须为数字'
```

##### on

订阅事件

```typescript
on(event: string, callback: (data: any) => void): void;
```

**参数**：
- `event`: 事件名称
- `callback`: 事件触发时调用的回调函数

**示例**：
```typescript
modelManager.on('field:change', (data) => {
  console.log(`字段 ${data.field} 变更为 ${data.value}`);
});
```

##### clearCache

清除反应缓存

```typescript
clearCache(): void;
```

**示例**：
```typescript
modelManager.clearCache(); // 清除所有反应缓存
```

### 工厂函数

```typescript
createModel(schema: Model, options?: ModelOptions): ModelReturn;
```

创建并返回一个模型实例。

**参数**：
- `schema`: 模型架构定义
- `options`: 可选配置参数

**返回值**：
- `ModelReturn`: 包含模型操作方法的对象

**示例**：
```typescript
const userModel = createModel({
  // 模型架构
}, {
  // 配置选项
});
```

### 事件系统

`model-reaction` 提供了以下事件，可以通过 `on` 方法订阅：

- `field:change`: 字段值变化时触发
  ```typescript
  modelManager.on('field:change', (data) => {
    console.log(`字段 ${data.field} 变更为 ${data.value}`);
  });
  ```

- `validation:complete`: 所有字段验证完成时触发
  ```typescript
  modelManager.on('validation:complete', (data) => {
    console.log('验证完成:', data.errors);
  });
  ```

- `reaction:error`: 反应处理出错时触发
  ```typescript
  modelManager.on('reaction:error', (data) => {
    console.error('反应出错:', data.field, data.error);
  });
  ```

### 验证规则

内置的验证规则：

- `required`: 字段必填
  ```typescript
  validator: [ValidationRules.required]
  ```

- `number`: 必须为数字
  ```typescript
  validator: [ValidationRules.number]
  ```

- `min(value: number)`: 最小值验证
  ```typescript
  validator: [ValidationRules.min(18)]
  ```

### 类型定义

#### Model

模型架构定义

```typescript
interface Model {
  [field: string]: FieldSchema;
}
```

#### FieldSchema

字段架构定义

```typescript
interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  validator?: Validator[];
  reaction?: Reaction | Reaction[];
  default?: any;
  transform?: (value: any) => any;
}
```

#### Validator

验证器定义

```typescript
interface Validator {
  type: string;
  message: string;
  validate?: (value: any) => boolean;
}
```

#### Reaction

反应定义

```typescript
interface Reaction<T = any> {
  fields: string[]; // 依赖的字段
  computed: (values: Record<string, any>) => T; // 计算函数
  action: (values: { computed: T } & Record<string, any>) => void; // 操作函数
}
```

#### ModelOptions

模型选项

```typescript
interface ModelOptions {
  debounceReactions?: number; // 反应防抖时间(毫秒)
  errorFormatter?: (error: ValidationError) => string; // 错误格式化函数
  validationDelay?: number; // 验证延迟时间(毫秒)
}
```

#### ValidationError

验证错误

```typescript
interface ValidationError {
  field: string;
  rule: string;
  message: string;
  value?: any;
}
```

## 高级使用

### 多字段反应

```typescript
const orderModel = createModel({
  price: {
    type: 'number',
    default: 0
  },
  quantity: {
    type: 'number',
    default: 0
  },
  total: {
    type: 'number',
    reaction: {
      fields: ['price', 'quantity'],
      computed: (values) => values.price * values.quantity,
      action: (values) => {
        console.log(`订单总额更新为: ${values.computed}`);
      }
    },
    default: 0
  }
});

orderModel.setField('price', 100);
orderModel.setField('quantity', 5);
console.log(orderModel.getField('total')); // 500
```

### 链式反应

```typescript
const chainModel = createModel({
  a: {
    type: 'number',
    default: 1
  },
  b: {
    type: 'number',
    reaction: {
      fields: ['a'],
      computed: (values) => values.a * 2,
      action: () => {}
    },
    default: 0
  },
  c: {
    type: 'number',
    reaction: {
      fields: ['b'],
      computed: (values) => values.b * 3,
      action: () => {}
    },
    default: 0
  }
});

chainModel.setField('a', 2);
console.log(chainModel.getField('b')); // 4
console.log(chainModel.getField('c')); // 12
```

### 自定义验证规则

```typescript
import { Rule } from 'model-reaction/validators';

const customRules = {
  email: new Rule('email', '请输入有效的电子邮箱', (
    v
  ) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v))
};

const userModel = createModel({
  email: {
    type: 'string',
    validator: [customRules.email],
    default: ''
  }
});
```

## 项目结构

```
model-reaction/
├── src/
│   ├── __tests__/          # 测试用例
│   ├── examples.ts         # 使用示例
│   ├── index.ts            # 导出入口
│   ├── model-manager.ts    # 核心模型管理器
│   ├── types.ts            # 类型定义
│   ├── utils.ts            # 工具函数
│   └── validators.ts       # 验证规则
├── .gitignore
├── jest.config.js
├── package-lock.json
├── package.json
├── README.md
└── tsconfig.json
```

## 运行测试

```bash
npm test
```

## 构建项目

```bash
npm run build
```

构建后的文件将输出到 `dist` 目录。

## 贡献指南

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/new-feature`
3. 提交更改: `git commit -am 'Add new feature'`
4. 推送到分支: `git push origin feature/new-feature`
5. 提交 Pull Request

## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。
        