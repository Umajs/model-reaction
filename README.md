# model-reaction

[中文版本](README_CN.md) | English

A powerful, type-safe data model management library supporting synchronous and asynchronous data validation, dependency reactions, dirty data management, and unified error handling.

## Project Introduction

`model-reaction` is a TypeScript library for managing application data models, providing the following core features:

- **Data Validation**: Supports synchronous and asynchronous validation rules, with custom validation messages
- **Dependency Reactions**: Automatically triggers related calculations and operations when specified fields change
- **Dirty Data Management**: Tracks validation-failed data and provides clearing functionality
- **Event System**: Supports subscribing to field changes, validation completion, and error events
- **Error Handling**: Unified error handling mechanism, supporting error type classification and custom error listening
- **Type Safety**: Built entirely on TypeScript, providing excellent type hints

## Installation

```bash
# Using npm
npm install model-reaction

# Using yarn
yarn add model-reaction
```

## Basic Usage

### Synchronous Validation Example

```typescript
import { createModel, Model, ValidationRules, ErrorType } from 'model-reaction';

// Define model schema
const userModel = createModel({
  name: {
    type: 'string',
    validator: [
      ValidationRules.required.withMessage('Name cannot be empty'),
      // ValidationRules.minLength(2).withMessage('Name length cannot be less than 2 characters')
    ],
    default: '',
  },
  age: {
    type: 'number',
    validator: [
      ValidationRules.required.withMessage('Age cannot be empty'),
      ValidationRules.number.withMessage('Age must be a number'),
      ValidationRules.min(18).withMessage('Age must be greater than or equal to 18')
    ],
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

// Subscribe to error events
userModel.on('validation:error', (error) => {
  console.error(`Validation error: ${error.field} - ${error.message}`);
});

userModel.on('field:not-found', (error) => {
  console.error(`Field not found: ${error.field}`);
});

// Set field values
await userModel.setField('name', 'John');
await userModel.setField('age', 30);

// Try to set non-existent field
await userModel.setField('nonexistentField', 'value');

// Get field values
console.log('Name:', userModel.getField('name')); // Output: John
console.log('Age:', userModel.getField('age')); // Output: 30
console.log('Info:', userModel.getField('info')); // Output: My name is John and I am 30 years old.

// Validate all fields
const isValid = await userModel.validateAll();
console.log('Validation passed:', isValid);
console.log('Validation errors:', userModel.validationErrors);
console.log('Validation summary:', userModel.getValidationSummary());

// Get dirty data
console.log('Dirty data:', userModel.getDirtyData());

// Clear dirty data
userModel.clearDirtyData();
console.log('Dirty data after clearing:', userModel.getDirtyData());
```

### Asynchronous Validation Example

```typescript
import { createModel, Model, ValidationRules } from 'model-reaction';

ValidationRules.asyncUnique: (fieldName: string) => new Rule(
    'asyncUnique',
    `${fieldName} already exists`,
    async (v) => {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(!!v);
            }, 500);
        });
    }
)

// Define model schema
const asyncUserModel = createModel({
  name: {
    type: 'string',
    validator: [ValidationRules.required.withMessage('Username cannot be empty')],
    default: '',
  },
  username: {
    type: 'string',
    validator: [
      ValidationRules.required.withMessage('Account cannot be empty'),
      ValidationRules.asyncUnique(
        async (value: string): Promise<boolean> => {
          // Simulate asynchronous check if username already exists
          return new Promise<boolean>((resolve) => {
            setTimeout(() => {
              // Assume 'admin' is already taken
              resolve(value !== 'admin');
            }, 100);
          });
        }
      ).withMessage('Username already exists')
    ],
    default: ''
  }
}, {
  asyncValidationTimeout: 3000
});

// Asynchronously set field value
const result1 = await asyncUserModel.setField('username', 'newuser');
console.log('Setting new username result:', result1); // Output: true

const result2 = await asyncUserModel.setField('username', 'admin');
console.log('Setting existing username result:', result2); // Output: false
console.log('Validation errors:', asyncUserModel.validationErrors);
console.log('Dirty data:', asyncUserModel.getDirtyData());
```

## API Reference

### createModel

The model manager is the core class of the library, providing the following methods:

#### Constructor
```typescript
createModel(schema: Model, options?: ModelOptions);
```

#### Methods

- `setField(field: string, value: any): Promise<boolean>`: Set a single field value, returns validation result
- `setFields(fields: Record<string, any>): Promise<boolean>`: Batch set field values, returns validation result
- `getField(field: string): any`: Get field value
- `validateAll(): Promise<boolean>`: Validate all fields, returns overall validation result
- `getValidationSummary(): string`: Get validation summary information
- `getDirtyData(): Record<string, any>`: Get validation-failed dirty data
- `clearDirtyData(): void`: Clear all dirty data
- `on(event: string, callback: (data: any) => void): void`: Subscribe to events
- `off(event: string, callback?: (data: any) => void): void`: Unsubscribe from events
- `emit(event: string, data: any): void`: Trigger events

#### Events

- `field:change`: Triggered when field value changes
- `validation:complete`: Triggered when validation is complete
- `validation:error`: Triggered when validation error occurs
- `reaction:error`: Triggered when reaction processing error occurs
- `field:not-found`: Triggered when attempting to access a non-existent field
- `error`: General error event triggered when any error occurs

### ModelOptions

Model configuration options:

- `debounceReactions?: number`: Debounce time for reaction triggering (in milliseconds)
- `asyncValidationTimeout?: number`: Timeout time for asynchronous validation (in milliseconds)
- `errorFormatter?: (error: ValidationError) => string`: Custom error formatting function

### ErrorHandler

Error handler provides unified error management:

- `onError(type: ErrorType, callback: (error: AppError) => void): void`: Subscribe to specific type of error
- `offError(type: ErrorType, callback?: (error: AppError) => void): void`: Unsubscribe from specific type of error
- `triggerError(error: AppError): void`: Trigger error
- `createValidationError(field: string, message: string): AppError`: Create validation error
- `createFieldNotFoundError(field: string): AppError`: Create field not found error
- ... other error creation methods

### ErrorType Enum

- `VALIDATION`: Validation error
- `FIELD_NOT_FOUND`: Field not found error
- `REACTION_ERROR`: Reaction processing error
- `ASYNC_VALIDATION_TIMEOUT`: Asynchronous validation timeout error
- `UNKNOWN`: Unknown error

### Type Definitions

For detailed type definitions, please refer to the `src/types.ts` file.

## Advanced Usage

### Custom Validation Rules and Messages

You can create custom validation rules and set custom error messages:

```typescript
import { createModel, Model, Rule, ErrorHandler } from 'model-reaction';

// Create error handler instance
const errorHandler = new ErrorHandler();

// Create custom validation rule
const customRule = new Rule(
  'custom',
  'Does not meet custom rules', // Default error message
  (value: any) => {
    // Custom validation logic
    return value === 'custom';
  }
);

// Use in model and override error message
const model = createModel({
  field: {
    type: 'string',
    validator: [
      customRule.withMessage('Field value must be "custom"')
    ],
    default: ''
  }
}, {
  errorHandler: errorHandler // Add errorHandler configuration
});
```

### Unified Error Handling

```typescript
import { createModel, Model, ValidationRules, ErrorHandler, ErrorType } from 'model-reaction';

// Create error handler
const errorHandler = new ErrorHandler();

// Subscribe to all validation errors
errorHandler.onError(ErrorType.VALIDATION, (error) => {
  console.error(`Validation error: ${error.field} - ${error.message}`);
});

// Subscribe to field not found errors
errorHandler.onError(ErrorType.FIELD_NOT_FOUND, (error) => {
  console.error(`Field not found: ${error.field}`);
});

// Subscribe to all errors
errorHandler.onError(ErrorType.UNKNOWN, (error) => {
  console.error(`Unknown error: ${error.message}`);
});

// Define model schema, pass custom error handler
const model = createModel({
  name: {
    type: 'string',
    validator: [ValidationRules.required.withMessage('Name cannot be empty')],
    default: ''
  }
}, {
  errorHandler: errorHandler
});
```

### Asynchronous Transformation and Validation

```typescript
import { createModel, Model, Rule } from 'model-reaction';

const asyncModel = createModel({
  field: {
    type: 'string',
    transform: async (value: string) => {
      // Asynchronously transform value
      return value.toUpperCase();
    },
    validator: [
      new Rule(
        'asyncValidator',
        'Asynchronous validation failed',
        async (value: string) => {
          // Asynchronous validation logic
          return value.length > 3;
        }
      ).withMessage('Field length must be greater than 3 characters')
    ],
    default: ''
  }
});
```

## Examples

For more examples, please check the files in the `examples/` directory.

## Best Practices

Please refer to the best practices guide in the `BEST_PRACTICES.md` file.