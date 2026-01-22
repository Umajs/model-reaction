import { Model, ModelOptions, Reaction, ValidationError, FieldSchema, ErrorType } from './types';
import { validateField, deepEqual } from './utils';
import { ErrorHandler } from './error-handler';
import { EventEmitter } from './event-emitter';

// Core model class - encapsulates all model-related functionality
export class ModelManager<T extends Record<string, any> = Record<string, any>> {
    data: T = {} as T;
    validationErrors: Record<string, ValidationError[]> = {};
    dirtyData: Partial<T> = {}; // Stores fields with validation failures and their values
    private readonly schema: Model;
    private readonly options: ModelOptions;
    // Optimization: Map dependency field -> List of reactions that depend on it
    private readonly reactionDeps: Map<string, Array<{ field: string; reaction: Reaction }>> = new Map();
    // Optimization: Map reaction -> timeout ID for debouncing
    private readonly reactionTimeouts: Map<Reaction, any> = new Map();
    private readonly eventEmitter: EventEmitter;
    private readonly errorHandler: ErrorHandler;
    private asyncValidationTimeout: number;

    constructor(schema: Model, options?: ModelOptions) {
        this.schema = schema;
        this.options = options || {};
        this.asyncValidationTimeout = this.options.asyncValidationTimeout || 5000; // Default timeout 5 seconds
        this.errorHandler = this.options.errorHandler || new ErrorHandler();
        this.eventEmitter = new EventEmitter();

        // Default error listeners
        this.errorHandler.onError(ErrorType.VALIDATION, (error) => {
            this.emit('validation:error', error);
        });
    
        this.errorHandler.onError(ErrorType.REACTION, (error) => {
            this.emit('reaction:error', error);
        });

        this.errorHandler.onError(ErrorType.CIRCULAR_DEPENDENCY, (error) => {
            this.emit('reaction:error', error);
        });
    
        // Add field not found error event forwarding
        this.errorHandler.onError(ErrorType.FIELD_NOT_FOUND, (error) => {
            this.emit('field:not-found', error);
        });
        this.initializeDefaults();
        this.collectReactions();
    }

    // Initialize default values
    private initializeDefaults(): void {
        Object.entries(this.schema).forEach(([field, schema]) => {
            if (schema.default !== undefined) {
                (this.data as any)[field] = schema.default;
            }
        });
    }

    // Collect all reactions and build dependency graph
    private collectReactions(): void {
        Object.entries(this.schema).forEach(([field, schema]) => {
            if (schema.reaction) {
                const reactions = Array.isArray(schema.reaction) ? schema.reaction : [schema.reaction];
                reactions.forEach(reaction => {
                    reaction.fields.forEach(depField => {
                        if (!this.reactionDeps.has(depField)) {
                            this.reactionDeps.set(depField, []);
                        }
                        this.reactionDeps.get(depField)!.push({ field, reaction });
                    });
                });
            }
        });
    }

    // Subscribe to events
    on(event: string, callback: (data: any) => void): void {
        this.eventEmitter.on(event, callback);
    }

    // Unsubscribe from events
    off(event: string, callback?: (data: any) => void): void {
        this.eventEmitter.off(event, callback);
    }

    // Trigger event
    private emit(event: string, data: any): void {
        this.eventEmitter.emit(event, data);
    }

    // Update: Set field value (async)
    async setField<K extends keyof T>(field: K, value: T[K], options: { reactionStack?: string[] } = {}): Promise<boolean> {
        const schema = this.schema[field as string];
        if (!schema) {
            const error = this.errorHandler.createFieldNotFoundError(field as string);
            this.errorHandler.triggerError(error);
            return false;
        }

        // Clear previous errors
        this.validationErrors[field as string] = [];

        // Apply transformation
        let transformedValue = value;
        if (schema.transform) {
            transformedValue = schema.transform(value);
        }

        // Validate the field immediately
        const isValid = await this.validateSingleField(schema, transformedValue, field as string);

        // Process validation result
        if (isValid) {
            this.handleValidField(field, transformedValue, options.reactionStack);
        } else {
            this.handleInvalidField(field as string, transformedValue);
        }

        // Return validation result
        return isValid;
    }

    // Validate single field
    private async validateSingleField(schema: FieldSchema, value: any, field: string): Promise<boolean> {
        return validateField(schema, value, this.validationErrors, field, this.asyncValidationTimeout, this.errorHandler);
    }

    // Handle valid field value
    private handleValidField<K extends keyof T>(field: K, value: T[K], reactionStack: string[] = []): void {
        // If value hasn't changed, don't trigger reactions
        const valueChanged = !deepEqual(this.data[field], value);
        if (valueChanged) {
            this.data[field] = value;
            // Remove from dirtyData if exists
            if (this.dirtyData[field] !== undefined) {
                delete this.dirtyData[field];
            }
            this.emit('field:change', { field, value });
            this.triggerReactions(field as string, reactionStack);
        }
    }

    // Handle invalid field value
    private handleInvalidField(field: string, value: any): void {
        // Validation failed, save to dirtyData
        (this.dirtyData as any)[field] = value;
    }

    // Update: Batch update fields (async)
    async setFields(fields: Partial<T>): Promise<boolean> {
        let allValid = true;
        
        // First validate and update each field
        const validationPromises = Object.entries(fields).map(async ([field, value]) => {
            const isValid = await this.setField(field as keyof T, value as T[keyof T]);
            if (!isValid) {
                allValid = false;
            }
        });

        // Wait for all validations to complete
        await Promise.all(validationPromises);

        return allValid;
    }

    // Get field value
    getField<K extends keyof T>(field: K): T[K] {
        return this.data[field];
    }

    // Get dirty data
    getDirtyData(): Partial<T> {
        return { ...this.dirtyData };
    }

    // Clear dirty data
    clearDirtyData(): void {
        this.dirtyData = {};
    }

    // Trigger related reactions
    private triggerReactions(changedField: string, reactionStack: string[] = []): void {
        const debounceTime = this.options.debounceReactions || 0;
        const reactionsToTrigger = this.reactionDeps.get(changedField);
        
        if (!reactionsToTrigger) return;

        // Trigger reactions
        reactionsToTrigger.forEach(({ field, reaction }) => {
            // Check for circular dependency
            if (reactionStack.includes(field)) {
                // Circular dependency detected, skip this reaction
                // Log warning or trigger error
                const error = this.errorHandler.createCircularDependencyError(reactionStack.join(' -> '), field);
                this.errorHandler.triggerError(error);
                return;
            }

            this.scheduleReaction(field, reaction, debounceTime, [...reactionStack, changedField]);
        });
    }

    // Schedule reaction execution (considering debouncing)
    private scheduleReaction(field: string, reaction: Reaction, debounceTime: number, reactionStack: string[] = []): void {
        if (this.reactionTimeouts.has(reaction)) {
            clearTimeout(this.reactionTimeouts.get(reaction));
        }

        if (debounceTime > 0) {
            const timeoutId = setTimeout(() => {
                this.reactionTimeouts.delete(reaction);
                this.processReaction(field, reaction, reactionStack);
            }, debounceTime);
            this.reactionTimeouts.set(reaction, timeoutId);
        } else {
            this.processReaction(field, reaction, reactionStack);
        }
    }

    // Process single reaction
    private processReaction(field: string, reaction: Reaction, reactionStack: string[] = []): void {
        try {
            const dependentValues = reaction.fields.reduce((values, f) => {
                if (this.data[f as keyof T] === undefined) {
                    const error = this.errorHandler.createDependencyError(field, f);
                    this.errorHandler.triggerError(error);
                    return { ...values, [f]: undefined };
                }
                return { ...values, [f]: this.data[f as keyof T] };
            }, {} as Record<string, any>);

            // Calculate new value
            try {
                const computedValue = reaction.computed(dependentValues);
                this.setField(field, computedValue, { reactionStack });
                if (reaction.action) {
                    reaction.action({ ...dependentValues, computed: computedValue });
                }
            } catch (error) {
                this.handleReactionError(field, error as Error);
            }
        } catch (error) {
            this.handleReactionError(field, error as Error);
        }
    }

    private handleReactionError(field: string, error: Error): void {
        const appError = this.errorHandler.createReactionError(field, error);
        this.errorHandler.triggerError(appError);

        if (!this.validationErrors['__reactions']) {
            this.validationErrors['__reactions'] = [];
        }
        this.validationErrors['__reactions'].push({
            field,
            rule: 'reaction_error',
            message: appError.message
        });
    }

    // Update: Validate all fields (async)
    async validateAll(): Promise<boolean> {
        let allValid = true;

        // Validate all fields
        const validationPromises = Object.keys(this.schema).map(async (field) => {
            const isValid = await this.validateAndUpdateField(field);
            if (!isValid) {
                allValid = false;
            }
        });

        await Promise.all(validationPromises);

        // Trigger validation complete event
        this.emit('validation:complete', { isValid: allValid });

        // Check if there are any errors
        return allValid;
    }

    // Validate and update single field
    private async validateAndUpdateField(field: string): Promise<boolean> {
        const schema = this.schema[field] as FieldSchema;
        // Prefer value from dirtyData, if not available use value from data
        const value = this.dirtyData[field] !== undefined ? this.dirtyData[field] : this.data[field];
        this.validationErrors[field] = [];
        const isValid = await validateField(schema, value, this.validationErrors, field, this.asyncValidationTimeout, this.errorHandler);
        
        if (!isValid) {
            // Validation failed, ensure value is in dirtyData
            (this.dirtyData as any)[field] = value;
        } else {
            // Validation passed, remove from dirtyData
            if (this.dirtyData[field as keyof T] !== undefined) {
                delete this.dirtyData[field as keyof T];
            }
            // Update value in data
            if (!deepEqual(this.data[field as keyof T], value)) {
                (this.data as any)[field] = value;
                this.emit('field:change', { field, value });
                this.triggerReactions(field);
            }
        }

        return isValid;
    }

    // Get validation summary
    getValidationSummary(): string {
        const errors = Object.values(this.validationErrors).flat();
        if (errors.length === 0) return 'Validation passed';

        if (this.options.errorFormatter) {
            return errors.map(this.options.errorFormatter).join('; ');
        }

        return errors.map(err => `${err.field}: ${err.message}`).join('; ');
    }

    // Get error handler - allows external error subscription
    getErrorHandler(): ErrorHandler {
        return this.errorHandler;
    }

    // Clean up resources
    dispose(): void {
        // Clear all reaction timeouts
        this.reactionTimeouts.forEach((timeoutId) => {
            clearTimeout(timeoutId);
        });
        this.reactionTimeouts.clear();
        
        // Clear all event listeners
        this.eventEmitter.clear();
        
        // Clear data and errors
        this.data = {} as T;
        this.dirtyData = {};
        this.validationErrors = {};
        this.reactionDeps.clear();
    }
}
