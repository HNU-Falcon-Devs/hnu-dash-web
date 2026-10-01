import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('joins truthy strings', () => {
    expect(cn('px-4', 'py-2', 'bg-blue-600')).toBe('px-4 py-2 bg-blue-600');
  });

  it('filters out falsy and nullish values', () => {
    expect(cn('base', false && 'hidden', null, undefined, '', 'visible')).toBe(
      'base visible'
    );
  });

  it('handles object-based conditional classes', () => {
    expect(
      cn('btn', {
        'btn-primary': true,
        'btn-disabled': false,
      })
    ).toBe('btn btn-primary');
  });

  it('handles nested arrays', () => {
    expect(cn(['text-sm', ['font-bold', false && 'italic']])).toBe(
      'text-sm font-bold'
    );
  });
});
