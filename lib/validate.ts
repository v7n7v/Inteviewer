/**
 * Reusable Request Validation Helper
 * Wraps Zod parsing with proper error responses.
 */

import { NextResponse } from 'next/server';
import type { ZodSchema } from 'zod';

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; error: NextResponse };
type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate a JSON request body against a Zod schema.
 * Returns typed data on success, or a 400 NextResponse on failure.
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            issues: result.error.issues.map(i => ({
              field: i.path.join('.'),
              message: i.message,
            })),
          },
          { status: 400 }
        ),
      };
    }

    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
}
