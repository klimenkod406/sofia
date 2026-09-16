import { describe, it, expect } from 'vitest';
import {
  cn,
  truncate,
  getFileExtension,
  formatFileSize,
  isValidUrl,
  getInitials,
  generateId,
} from './cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('deduplicates conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
  });
});

describe('getFileExtension', () => {
  it('extracts extension', () => {
    expect(getFileExtension('note.md')).toBe('md');
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('returns empty string when there is no extension', () => {
    expect(getFileExtension('README')).toBe('');
  });
});

describe('formatFileSize', () => {
  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  it('formats kilobytes and megabytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
  });
});

describe('isValidUrl', () => {
  it('accepts valid urls', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('rejects invalid urls', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });
});

describe('getInitials', () => {
  it('returns uppercase initials', () => {
    expect(getInitials('Sofia App')).toBe('SA');
  });

  it('limits to two characters', () => {
    expect(getInitials('one two three')).toBe('OT');
  });
});

describe('generateId', () => {
  it('generates non-empty unique ids', () => {
    const a = generateId();
    const b = generateId();
    expect(a.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });
});
