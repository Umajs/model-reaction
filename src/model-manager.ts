import { Model, ModelOptions, Reaction, ValidationError, FieldSchema, ErrorType } from './types';
import { validateField, deepEqual } from './utils';
import { ErrorHandler } from './error-handler';
import { EventEmitter } from './event-emitter';

// Core model class - encapsulates all model-related functionality
export class ModelManager<T extends Record<string, any> = Record<string, any>> {
    data: T = {} as T;
    validationErrors: Record<string, ValidationError[]> = {};
    dirtyData: Partial<T> = {}; // Stores fields with validation failures and their values
    private readonly schema: Model<T>;
    private readonly options: ModelOptions;
    // Optimization: Map dependency field -> List of reactions that depend on it
    private readonly reactionDeps: Map<string, Array<{ field: string; reaction: Reaction }>> = new Map();
    // Optimization: Map reaction -> timeout ID for debouncing
    // Changed to store object with timeoutId and promise resolver
    private readonly reactionTimeouts: Map<Reaction, { timeoutId: any, resolve: () => void }> = new Map();
    private readonly eventEmitter: EventEmitter;
    private readonly errorHandler: ErrorHandler;
    private asyncValidationTimeout: number;

    // Fix for race condition: track validation request IDs
    private fieldValidationRequests: Map<string, number> = new Map();
    // Track pending reactions for settled()
    private pendingReactions: Set<Promise<any>> = new Set();

    constructor(schema: Model<T>, options?: ModelOptions) {
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
    async setField<K extends keyof T>(
        field: K, 
        value: T[K], 
        options: { 
            reactionStack?: string[], 
            skipReaction?: boolean,
            onFieldChange?: (field: K) => void 
        } = {}
    ): Promise<boolean> {
        const schema = this.schema[field as string];
        if (!schema) {
            const error = this.errorHandler.createFieldNotFoundError(field as string);
            this.errorHandler.triggerError(error);
            return false;
        }

        // Increment request ID for race condition handling
        const currentRequestId = (this.fieldValidationRequests.get(field as string) || 0) + 1;
        this.fieldValidationRequests.set(field as string, currentRequestId);

        // Don't clear errors immediately here, do it after validation succeeds for this request
        // But we need to pass a fresh error object to validateSingleField
        const tempErrors: Record<string, ValidationError[]> = {};

        // Apply transformation
        let transformedValue = value;
        if (schema.transform) {
            transformedValue = schema.transform(value);
        }

        // Validate the field immediately
        const isValid = await this.validateSingleField(schema, transformedValue, field as string, tempErrors);

        // Check if this request is still the latest
        if (this.fieldValidationRequests.get(field as string) !== currentRequestId) {
            // Outdated request, ignore result (return result but don't update state)
            return isValid;
        }

        // If latest, apply errors
        this.validationErrors[field as string] = tempErrors[field as string] || [];

        // Process validation result
        if (isValid) {
            this.handleValidField(field, transformedValue, options);
        } else {
            this.handleInvalidField(field as string, transformedValue);
        }

        // Return validation result
        return isValid;
    }

    // Validate single field
    private async validateSingleField(
        schema: FieldSchema, 
        value: any, 
        field: string,
        errors: Record<string, ValidationError[]> = this.validationErrors
    ): Promise<boolean> {
        return validateField(
            schema, 
            value, 
            errors, 
            field, 
            this.asyncValidationTimeout, 
            this.errorHandler,
            this.options.failFast // Pass failFast option
        );
    }

    // Handle valid field value
    private handleValidField<K extends keyof T>(
        field: K, 
        value: T[K], 
        options: { 
            reactionStack?: string[], 
            skipReaction?: boolean,
            onFieldChange?: (field: K) => void 
        } = {}
    ): void {
        // If value hasn't changed, don't trigger reactions
        const valueChanged = !deepEqual(this.data[field], value);
        if (valueChanged) {
            this.data[field] = value;
            // Remove from dirtyData if exists
            if (this.dirtyData[field] !== undefined) {
                delete this.dirtyData[field];
            }
            this.emit('field:change', { field, value });
            
            if (options.onFieldChange) {
                options.onFieldChange(field);
            }

            if (!options.skipReaction) {
                this.triggerReactions(field as string, options.reactionStack);
            }
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
        const changedFields: string[] = [];
        
        // First validate and update each field
        const validationPromises = Object.entries(fields).map(async ([field, value]) => {
            const isValid = await this.setField(field as keyof T, value as T[keyof T], { 
                skipReaction: true,
                onFieldChange: (f) => changedFields.push(f as string)
            });
            if (!isValid) {
                allValid = false;
            }
        });

        // Wait for all validations to complete
        await Promise.all(validationPromises);

        // Trigger batched reactions
        if (changedFields.length > 0) {
            this.triggerBatchReactions(changedFields);
        }

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

    private triggerBatchReactions(changedFields: string[]): void {
        const uniqueReactions = new Map<Reaction, string>(); // reaction -> outputField
        
        changedFields.forEach(changedField => {
            const deps = this.reactionDeps.get(changedField);
            if (deps) {
                deps.forEach(({ field, reaction }) => {
                    uniqueReactions.set(reaction, field);
                });
            }
        });
        
        uniqueReactions.forEach((field, reaction) => {
             // Start fresh stack for batch updates
             this.scheduleReaction(field, reaction, this.options.debounceReactions || 0);
        });
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

            const promise = this.scheduleReaction(field, reaction, debounceTime, [...reactionStack, changedField]);
            this.trackReaction(promise);
        });
    }

    private trackReaction(promise: Promise<any>): void {
        this.pendingReactions.add(promise);
        promise.then(() => {
            this.pendingReactions.delete(promise);
        }).catch(() => {
            this.pendingReactions.delete(promise);
        });
    }

    // Schedule reaction execution (considering debouncing)
    private scheduleReaction(field: string, reaction: Reaction, debounceTime: number, reactionStack: string[] = []): Promise<void> {
        if (this.reactionTimeouts.has(reaction)) {
            const entry = this.reactionTimeouts.get(reaction);
            if (entry) {
                clearTimeout(entry.timeoutId);
                // Resolve the previous promise as it was cancelled/superseded
                entry.resolve();
            }
        }

        if (debounceTime > 0) {
            return new Promise<void>((resolve) => {
                const timeoutId = setTimeout(() => {
                    this.reactionTimeouts.delete(reaction);
                    this.processReaction(field, reaction, reactionStack)
                        .then(() => resolve())
                        .catch(() => resolve()); // Resolve even on error to unblock settled()
                }, debounceTime);
                
                this.reactionTimeouts.set(reaction, { timeoutId, resolve });
            });
        } else {
            return this.processReaction(field, reaction, reactionStack);
        }
    }

    // Process single reaction
    private async processReaction(field: string, reaction: Reaction, reactionStack: string[] = []): Promise<void> {
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
                // Wait for setField to complete
                await this.setField(field, computedValue, { reactionStack });
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
        const isValid = await validateField(
            schema, 
            value, 
            this.validationErrors, 
            field, 
            this.asyncValidationTimeout, 
            this.errorHandler,
            this.options.failFast // Pass failFast option
        );
        
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
        this.reactionTimeouts.forEach((entry) => {
            clearTimeout(entry.timeoutId);
            entry.resolve();
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
    
    // Wait for all pending reactions and validations to complete
    async settled(): Promise<void> {
        // Wait until pendingReactions is empty
        // Note: New reactions might be added while we wait, so we loop
        while (this.pendingReactions.size > 0) {
            // We only track reaction promises in pendingReactions.
            
            // Wait for all currently known pending reactions
            await Promise.all(Array.from(this.pendingReactions));
            
            // Give a tick for any new microtasks or timers to register
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
}
