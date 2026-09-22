/**
 * Language detection heuristics for code blocks (lowlight v3 `common` set).
 * Fast regex-based — good enough for auto-tagging newly pasted code.
 */

export const SUPPORTED_LANGUAGES: string[] = [
  'plaintext',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'json',
  'html',
  'css',
  'scss',
  'bash',
  'shell',
  'sql',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'xml',
  'yaml',
  'markdown',
  'kotlin',
  'swift',
  'php',
  'ruby',
  'lua',
  'perl',
  'r',
  'dart',
  'scala',
  'haskell',
  'elixir',
  'erlang',
  'clojure',
  'diff',
  'ini',
  'toml',
  'dockerfile',
  'makefile',
];

const LABELS: Record<string, string> = {
  plaintext: 'Plain text',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  python: 'Python',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  bash: 'Bash',
  shell: 'Shell',
  sql: 'SQL',
  rust: 'Rust',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  xml: 'XML',
  yaml: 'YAML',
  markdown: 'Markdown',
  kotlin: 'Kotlin',
  swift: 'Swift',
  php: 'PHP',
  ruby: 'Ruby',
  lua: 'Lua',
  perl: 'Perl',
  r: 'R',
  dart: 'Dart',
  scala: 'Scala',
  haskell: 'Haskell',
  elixir: 'Elixir',
  erlang: 'Erlang',
  clojure: 'Clojure',
  diff: 'Diff',
  ini: 'INI',
  toml: 'TOML',
  dockerfile: 'Dockerfile',
  makefile: 'Makefile',
};

export function languageLabel(lang: string): string {
  return LABELS[lang] ?? lang;
}

/** Cheap structural checks, ordered from most-specific to least. */
export function detectLanguage(code: string): string {
  const s = code.trim();
  if (!s) return 'plaintext';
  // First line only — many snippets have a shebang / doctype / pragma.
  const first = (s.split('\n', 1)[0] ?? '').trim();
  const firstLower = first.toLowerCase();

  // Shebangs
  if (first.startsWith('#!')) {
    if (firstLower.includes('python')) return 'python';
    if (firstLower.includes('bash') || firstLower.includes('sh') || firstLower.includes('zsh'))
      return 'bash';
    if (firstLower.includes('node')) return 'javascript';
    if (firstLower.includes('ruby')) return 'ruby';
    if (firstLower.includes('perl')) return 'perl';
    if (firstLower.includes('php')) return 'php';
    if (firstLower.includes('lua')) return 'lua';
    if (firstLower.includes('rscript')) return 'r';
  }

  // Markup / documents
  if (
    /<!doctype\s+html/i.test(first) ||
    /<(html|head|body|div|span|p|a|ul|ol|li|table|section|article|main|nav|header|footer|h[1-6])\b/i.test(
      s
    )
  )
    return 'html';
  if (
    /<\?xml[\s?]/.test(first) ||
    (/<([A-Za-z_][\w.-]*)\b[^>]*\/>/.test(s) && /^<\?xml/.test(first))
  )
    return 'xml';
  if (first.startsWith('<?xml')) return 'xml';
  if (/^\{\s*$/.test(first) || (/^\{$/.test(first) && /"[^"]+"\s*:/.test(s))) return 'json';
  if (/^\s*[\{\[]/.test(s) && /"[^"]+"\s*:\s*(["\{\[]|true|false|null|-?\d)/.test(s)) return 'json';
  if (/^---\s*$/.test(first) && /^[\w.-]+\s*:/m.test(s)) return 'yaml';
  if (/^#\s+\S/.test(first) && /^#{1,6}\s+/m.test(s) && !/;\s*$/.test(first)) return 'markdown';
  if (/^diff --git\s/m.test(s) || /^@@\s+-\d/.test(s) || /^[-+]{3}\s/.test(s)) return 'diff';
  if (/^\[\w+\]\s*$/m.test(s) && /^[;#]/.test(first)) return 'ini';

  // C family
  if (/#include\s*[<"]/.test(s)) {
    if (/\bstd::|cout\s*<<|template\s*</.test(s)) return 'cpp';
    if (
      /\b(class|interface|public|private|protected|extends|implements)\b.*\{/.test(s) &&
      /\bSystem\.out|public\s+(static|class|void)\b/.test(s)
    )
      return 'java';
    return 'c';
  }
  if (/\bnamespace\s+[\w:]+\s*\{/.test(s) || /\bstd::|\bcout\s*<<|\bvector\s*</.test(s))
    return 'cpp';
  if (
    /\busing\s+System\b|\bnamespace\s+[\w.]+\s*\{?\s*$/.test(s) &&
    /\bConsole\.(Write|Read)|public\s+(static\s+)?(void|class|string)\b/.test(s)
  )
    return 'csharp';
  if (
    /\bpublic\s+(static\s+)?(final\s+)?(class|void|int|String|boolean)\b/.test(s) &&
    /System\.(out|in)|import\s+java/.test(s)
  )
    return 'java';

  // Rust / Go
  if (
    /\bfn\s+\w+\s*\([^)]*\)\s*(->\s*[\w<&'"]+\s*)?\{/.test(s) &&
    /\b(let\s+mut|impl\s|&'?\w+\s|use\s+[\w:]+::)/.test(s)
  )
    return 'rust';
  if (
    /^\s*package\s+\w+/m.test(s) &&
    /\bfunc\s+\w+\s*\([^)]*\)\s*(\([\w\s,*]+\)|[\w*]+)?\s*\{/.test(s)
  )
    return 'go';
  if (/\bfunc\s+\w+\s*\([^)]*\)\s*\{/.test(s) && /^\s*(package|import\s+\()/m.test(s)) return 'go';

  // Scripting
  if (
    /^\s*(def|class)\s+\w+\s*(\(|:)/m.test(s) &&
    /^\s*(import|from)\s+\w+/m.test(s) &&
    !/;\s*$/.test(s)
  )
    return 'python';
  if (/^\s*(import|from)\s+[\w.]+\s+(import|as)\s+/m.test(s)) return 'python';
  if (/^\s*def\s+\w+\s*\([^)]*\)\s*:/m.test(s) && /^\s{4}\S/m.test(s)) return 'python';
  if (/\bprint\s*\(|raise\s+\w+Error|except\b|elif\b/.test(s) && !/;\s*$/.test(s)) return 'python';
  if (/<\?php/.test(s)) return 'php';
  if (/^\s*<\?php/m.test(s)) return 'php';
  if (
    /^\s*(require|puts)\s*['"]|\bdef\s+\w+(\(|$)/m.test(s) &&
    /\b(end|do\s*\|)/.test(s) &&
    !/;\s*$/.test(s)
  )
    return 'ruby';
  if (/^\s*(local\s+)?function\s+\w+\s*\(/.test(s) && /\bend\b/.test(s) && !/;\s*$/.test(s))
    return 'lua';
  if (/^\s*#!/m.test(s) === false && /\bmy\s+[$@%]|use\s+strict\s*;/.test(s)) return 'perl';

  // Shell / SQL
  if (
    /\b(echo|export|source|cd|ls|pwd|grep|sed|awk|curl|sudo|apt|yum|brew|chmod|chown)\b/.test(s) &&
    /^\s*[$#>]\s/m.test(s) === false &&
    !/;\s*$/.test(first)
  )
    return 'bash';
  if (/^\s*(\$\s|#\s|\/bin\/|set\s+-e)/m.test(s)) return 'bash';
  if (
    /\b(select|insert|update|delete|create|alter|drop)\s+(into|from|table|database|index)?\s*\w+/i.test(
      s
    ) &&
    /;/.test(s)
  )
    return 'sql';
  if (/\bSELECT\s+[\w*]+\s+FROM\s+\w+/i.test(s)) return 'sql';

  // JS / TS
  if (
    /\binterface\s+\w+\s*\{|\btype\s+\w+\s*=|\bimplements\s+|\bas\s+const\b|:\s*(string|number|boolean|unknown|never|void)\b/.test(
      s
    )
  )
    return 'typescript';
  if (/\bimport\s+type\b|\bsatisfies\b|\breadonly\b/.test(s)) return 'typescript';
  if (/\b(const|let|var)\s+\w+\s*(:[^=]+)=\s*</.test(s)) return 'tsx';
  if (
    /\b(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/.test(s) ||
    /\bfunction\s*\w*\s*\(/.test(s) ||
    /\b(require|module\.exports)\b/.test(s) ||
    /\bconsole\.log\b/.test(s)
  )
    return 'javascript';
  if (
    /^\s*import\s+.*\s+from\s+['"]/.test(s) ||
    /^\s*export\s+(default\s+)?(const|function|class|\{)/m.test(s)
  )
    return 'javascript';
  if (/\bReact\.|useState|useEffect|jsx/.test(s)) return 'jsx';

  // Misc
  if (/\$[\w]+\s*[:\{]/.test(s) && /^\s*\$[\w-]+:/m.test(s)) return 'scss';
  if (/@[\w-]+\s*[:{]/.test(s) && /^\s*\.[\w-]+\s*\{/m.test(s)) return 'css';
  if (
    /\{\s*[\w-]+\s*:\s*[^;]+\}/.test(s) &&
    /^\s*(\.|#|@)[\w-]*/m.test(s) &&
    !/[;{]\s*$/.test(s) === false
  )
    return 'css';
  if (
    /\bfun\s+\w+\s*\(|val\s+\w+\s*[:=]|var\s+\w+\s*[:=]/.test(s) &&
    /\b(data\s+class|object\s+\w+|sealed\s+class)\b/.test(s)
  )
    return 'kotlin';
  if (
    /^\s*(func|let|var|import|struct|class|enum|extension)\b/m.test(s) &&
    /\b(var|let)\s+\w+\s*:\s*\w+/.test(s) &&
    /(UIKit|SwiftUI|Foundation|guard\s+let)/.test(s)
  )
    return 'swift';
  if (/\bmodule\s+[\w.]+\s*;/m.test(s)) return 'dart';
  if (/^\s*(defmodule|defp?)\s+/.test(s) && /\bend\b/m.test(s)) return 'elixir';
  if (/\b-module\s*\(/.test(s) || /-\s*(export|spec|record)\s*\(/.test(s)) return 'erlang';
  if (/\(defn?|\(ns\s+[\w.-]+/.test(s)) return 'clojure';
  if (/\bmodule\s+Main\s+where\b|\bdata\s+\w+\s*=|\b::\s*[A-Z]\w*\s*->/.test(s)) return 'haskell';
  if (/^\s*\[\w+\]/m.test(s) && /^\s*FROM\s+\w+/im.test(s)) return 'dockerfile';
  if (/^\s*(all:|clean:|install:|build:)/m.test(s) && /^\t/m.test(s)) return 'makefile';
  if (/^\s*\[\w+\]\s*$/m.test(s) && /=/.test(s)) return 'toml';
  if (/^\s*#include|^\s*#define/.test(s)) return 'c';

  return 'plaintext';
}
