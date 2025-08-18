# model-reaction
一个强大的、类型安全的数据模型管理库，支持数据验证、依赖反应和缓存机制。

## 项目简介
model-reaction 是一个用于管理应用程序数据模型的 TypeScript 库，提供以下核心功能：

- 数据验证：支持同步验证规则
- 依赖反应：当指定字段变化时，自动触发相关计算和操作
- 缓存机制：优化计算性能，避免不必要的重复计算
- 事件系统：支持订阅字段变化和验证完成等事件
- 类型安全：完全基于 TypeScript 构建，提供良好的类型提示
## 安装
```bash
# 使用 npm
npm install model-reaction

# 使用 yarn
yarn add model-reaction
```
## 基本使用
```JS
import { createModel } from 'model-reaction';
import { ValidationRules } from 'model-reaction/validators';

// 定义模型架构
const userModel = createModel({
  name: {
    type: 'string',
    validator: [ValidationRules.required],
    default: '',
  },
  age: {
    type: 'number',
    validator: [ValidationRules.required, ValidationRules.number, ValidationRules.min(18)],
    default: 18
  },
  info: {
    type: 'string',
    reaction: {
      fields: ['name', 'age'],
      computed: (values) => `My name is ${values.name} and I am ${values.age} years old.`,
      action: (values) => console.log('Info updated:', values.computed)
    },
    default: ''
  }
}, {
  debounceReactions: 100,
});

// 设置字段值
userModel.setField('name', 'John');
userModel.setField('age', 30);

// 获取字段值
console.log('姓名:', userModel.getField('name')); // 输出: John
console.log('年龄:', userModel.getField('age')); // 输出: 30
console.log('信息:', userModel.getField('info')); // 输出: My name is John and I am 30 years old.

// 验证所有字段
const isValid = userModel.validateAll();
console.log('验证是否通过:', isValid);
console.log('验证错误:', userModel.validationErrors);
console.log('验证摘要:', userModel.getValidationSummary());
```
## API 文档
### ModelManager
核心类，负责数据管理、验证和反应处理。
 构造函数
```JS
new ModelManager(schema: Model, options?: ModelOptions);
``` 方法
- setField(field: string, value: any): boolean - 设置单个字段值
- getField(field: string): any - 获取字段值
- setFields(fields: Record<string, any>): boolean - 批量设置字段值
- validateAll(): boolean - 验证所有字段
- getValidationSummary(): string - 获取验证摘要
- on(event: string, callback: (data: any) => void): void - 订阅事件
- clearCache(): void - 清除缓存
```
### 事件
```JS
- fieldChange: 字段值变化时触发
- validationComplete: 所有字段验证完成时触发
- validationError: 验证错误时触发
- reactionComplete: 反应处理完成时触发
- error: 其他错误时触发
```
### 类型定义
```JS
interface Model {
  [field: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    validator?: ValidationRule[];
    reaction?: Reaction;
    default?: any;
  };
}
```
### 反应
```JS
interface Reaction {
  fields: string[];
  computed?: (values: Record<string, any>) => any;
  action?: (values: Record<string, any>) => void;
}
```
### 验证规则
```JS
interface ValidationRule {
  name: string;
  params?: any[];
}
```
### 验证错误
```JS
interface ValidationError {
  field: string;
  rule: string;
  params?: any[];
}
```

### 工厂函数
```JS
createModel(schema: Model, options?: ModelOptions): ModelReturn;
```
创建并返回一个模型实例。

### 验证规则
内置的验证规则：
```JS
- required - 字段必填
- number - 必须为数字
- min(value: number) - 最小值验证
```

## 运行测试
```bash
npm test
```
## 构建项目
```bash
npm run build
```
构建后的文件将输出到 dist 目录。

## 项目结构
```
model-reaction/
├── src/
│   ├── __tests__/          # 测试用例
│   ├── examples.ts         # 使用示例
│   ├── index.ts            # 导出入口
│   ├── model-manager.ts    # 核心模型管理器
│   ├── types.ts            # 类型定义
│   ├── utils.ts            # 工具函数
│   └── validators.ts       # 验证规则
├── .gitignore
├── jest.config.js
├── package-lock.json
├── package.json
├── readme.md
└── tsconfig.json
```
