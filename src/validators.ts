// Validation rule implementation - independent validation rule system
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

    // Allow custom error message
    withMessage(message: string): Rule {
        return new Rule(this.type, message, this.validate);
    }
}

// Built-in validation rules - reusable validation logic
export const ValidationRules = {
    required: new Rule('required', 'This field is required',
        (v) => v !== undefined && v !== null && v !== ''
    ),
    number: new Rule('number', 'Must be a number',
        (v) => typeof v === 'number'
    ),
    min: (min: number) => new Rule('min', `Value must be greater than or equal to ${min}`,
        (v) => v >= min
    ),
    email: new Rule('email', 'Invalid email format',
        (v) => typeof v === 'string' && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)
    )
};