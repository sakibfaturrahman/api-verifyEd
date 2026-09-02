import { AppError } from './AppError';

export interface ValidationFieldError {
  field: string;
  message: string;
}

export class ValidationError extends AppError {
  public readonly errors: ValidationFieldError[];

  constructor(errors: ValidationFieldError[], message = 'Validation failed') {
    super(message, 422, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}
