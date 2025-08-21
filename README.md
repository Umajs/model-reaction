# model-reaction

一个强大的、类型安全的数据模型管理库，支持同步和异步数据验证、依赖反应和脏数据管理。

## 项目简介

`model-reaction` 是一个用于管理应用程序数据模型的 TypeScript 库，提供以下核心功能：

- **数据验证**：支持同步和异步验证规则，确保数据符合预期格式
- **依赖反应**：当指定字段变化时，自动触发相关计算和操作
- **脏数据管理**：跟踪验证失败的数据，并提供清除功能
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

### 同步验证示例

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
  asyncValidationTimeout: 5000
});

// 设置字段值
await userModel.setField('name', 'John');
await userModel.setField('age', 30);

// 获取字段值
console.log('姓名:', userModel.getField('name')); // 输出: John
console.log('年龄:', userModel.getField('age')); // 输出: 30
console.log('信息:', userModel.getField('info')); // 输出: My name is John and I am 30 years old.

// 验证所有字段
const isValid = await userModel.validateAll();
console.log('验证是否通过:', isValid);
console.log('验证错误:', userModel.validationErrors);
console.log('验证摘要:', userModel.getValidationSummary());

// 获取脏数据
console.log('脏数据:', userModel.getDirtyData());

// 清除脏数据
userModel.clearDirtyData();
console.log('清除后脏数据:', userModel.getDirtyData());
```

### 异步验证示例

```typescript
import { createModel } from 'model-reaction';
import { ValidationRules } from 'model-reaction/validators';

// 定义模型架构
const asyncUserModel = createModel({
  name: {
    type: 'string',
    validator: [ValidationRules.required],
    default: '',
  },
  username: {
    type: 'string',
    validator: [
      ValidationRules.required,
      {
        type: 'asyncUnique',
        message: '用户名已存在',
        validate: async (value: string): Promise<boolean> => {
          // 模拟异步检查用户名是否已存在
          return new Promise<boolean>((resolve) => {
            setTimeout(() => {
              // 假设 'admin' 已被占用
              resolve(value !== 'admin');
            }, 100);
          });
        }
      }
    ],
    default: ''
  }
}, {
  asyncValidationTimeout: 3000
});

// 异步设置字段值
const result1 = await asyncUserModel.setField('username', 'newuser');
console.log('设置新用户名结果:', result1); // 输出: true

const result2 = await asyncUserModel.setField('username', 'admin');
console.log('设置已存在用户名结果:', result2); // 输出: false
console.log('验证错误:', asyncUserModel.validationErrors);
console.log('脏数据:', asyncUserModel.getDirtyData());
```

## API 参考

### ModelManager

模型管理器是库的核心类，提供以下方法：

#### 构造函数
```typescript
new ModelManager(schema: Model, options?: ModelOptions);
```

#### 方法

- `setField(field: string, value: any): Promise<boolean>`: 设置单个字段值，返回验证结果
- `setFields(fields: Record<string, any>): Promise<boolean>`: 批量设置字段值，返回验证结果
- `getField(field: string): any`: 获取字段值
- `validateAll(): Promise<boolean>`: 验证所有字段，返回整体验证结果
- `getValidationSummary(): string`: 获取验证摘要信息
- `getDirtyData(): Record<string, any>`: 获取验证失败的脏数据
- `clearDirtyData(): void`: 清除所有脏数据
- `on(event: string, callback: (data: any) => void): void`: 订阅事件

#### 事件

- `field:change`: 字段值变化时触发
- `validation:complete`: 验证完成时触发
- `reaction:error`: 反应处理错误时触发

### ModelOptions

模型配置选项：

- `debounceReactions?: number`: 反应触发的防抖时间（毫秒）
- `asyncValidationTimeout?: number`: 异步验证的超时时间（毫秒）
- `errorFormatter?: (error: ValidationError) => string`: 自定义错误格式化函数

### 类型定义

详细类型定义请参考 `src/types.ts` 文件。

## 高级用法

### 自定义验证规则

您可以创建自定义验证规则：

```typescript
import { Rule } from 'model-reaction/validators';

const customRule = new Rule(
  'custom',
  '不符合自定义规则',
  (value: any) => {
    // 自定义验证逻辑
    return value === 'custom';
  }
);

// 在模型中使用
const model = createModel({
  field: {
    type: 'string',
    validator: [customRule],
    default: ''
  }
});
```

### 异步转换和验证

```typescript
const asyncModel = createModel({
  field: {
    type: 'string',
    transform: async (value: string) => {
      // 异步转换值
      return value.toUpperCase();
    },
    validator: [
      {
        type: 'asyncValidator',
        message: '异步验证失败',
        validate: async (value: string) => {
          // 异步验证逻辑
          return value.length > 3;
        }
      }
    ],
    default: ''
  }
});
```
        