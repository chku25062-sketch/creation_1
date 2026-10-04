import { describe, it, expect } from 'vitest';
import { greeting, add } from './index';

describe('Initial Smoke Tests', () => {
  it('greeting変数が正しく定義されていること', () => {
    expect(greeting).toBe('Hello, TypeScript!');
  });

  it('add関数が正しく数値を加算すること', () => {
    expect(add(2, 3)).toBe(5);
  });
});
