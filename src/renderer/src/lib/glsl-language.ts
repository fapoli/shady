import type * as Monaco from 'monaco-editor'
import {
  GLSL_CONSTANT_KEYWORDS,
  GLSL_DIRECTIVES,
  GLSL_EXTRA_KEYWORDS,
  GLSL_EXTRA_TYPES,
  GLSL_FUNCTIONS,
  GLSL_PRECISION_KEYWORDS,
  SHADY_BUILTINS,
  SHADY_UNIFORMS,
} from './glslCompletions'

const BASE_KEYWORDS = ['break','continue','do','for','while','if','else','return','discard','const','in','out','inout','uniform','layout','precision']
const BASE_TYPES = ['void','bool','int','uint','float','double','vec2','vec3','vec4','ivec2','ivec3','ivec4','uvec2','uvec3','uvec4','mat2','mat3','mat4','sampler2D','samplerCube']
const KEYWORDS = [...BASE_KEYWORDS, ...GLSL_EXTRA_KEYWORDS, ...GLSL_PRECISION_KEYWORDS]
const TYPES = [...BASE_TYPES, ...GLSL_EXTRA_TYPES]

export function registerGlslLanguage(monaco: typeof Monaco): void {
  monaco.languages.register({ id: 'glsl' })

  registerGlslCompletions(monaco)

  monaco.languages.setMonarchTokensProvider('glsl', {
    keywords: KEYWORDS,
    typeKeywords: TYPES,
    constants: GLSL_CONSTANT_KEYWORDS,
    uniforms: SHADY_UNIFORMS.map(u => u.name),
    operators: ['=','>','<','!','~','?',':','==','<=','>=','!=','&&','||','++','--','+','-','*','/','&','|','^','%','+=','-=','*=','/=','%='],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
      root: [
        [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@constants': 'number', '@uniforms': 'variable.predefined', '@default': 'identifier' } }],
        { include: '@whitespace' },
        [/#\s*[a-z]+/, 'keyword'],
        [/\d*\.\d+([eE][-+]?\d+)?[fF]?/, 'number.float'],
        [/\d+[uUlL]*/, 'number'],
        [/"([^\\"]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/[{}()[\]]/, 'delimiter.bracket'],
        [/[;,.]/, 'delimiter'],
        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }]
      ],
      whitespace: [
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        [/[ \t\r\n]+/, '']
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment']
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ]
    }
  } as Monaco.languages.IMonarchLanguage)
}

export function defineTokyoNightTheme(monaco: typeof Monaco): void {
  monaco.editor.defineTheme('tokyo-night', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '',             foreground: 'd7defc' },
      { token: 'comment',      foreground: '6f78a8' },
      { token: 'keyword',      foreground: 'bb9af7' },
      { token: 'type',         foreground: '2ac3de' },
      { token: 'variable.predefined', foreground: '7dcfff' },
      { token: 'number',       foreground: 'ff9e64' },
      { token: 'number.float', foreground: 'ff9e64' },
      { token: 'string',       foreground: '9ece6a' },
      { token: 'operator',     foreground: '89ddff' },
      { token: 'identifier',   foreground: 'd7defc' },
    ],
    colors: {
      'editor.background':                  '#1a1b26',
      'editor.foreground':                  '#d7defc',
      'editor.selectionBackground':         '#283457',
      'editor.inactiveSelectionBackground': '#1f2235',
      'editorLineNumber.foreground':        '#4b5278',
      'editorLineNumber.activeForeground':  '#8b94c6',
      'editorCursor.foreground':            '#9d7cd8',
      'editorGutter.background':            '#1a1b26',
      'editorStickyScroll.background':      '#1a1b26',
      'scrollbar.shadow':                   '#00000000',
    }
  })
}

function registerGlslCompletions(monaco: typeof Monaco): void {
  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages
  const snippetRule = CompletionItemInsertTextRule.InsertAsSnippet

  monaco.languages.registerCompletionItemProvider('glsl', {
    triggerCharacters: ['#'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const lineStart = model.getLineContent(position.lineNumber).slice(0, word.startColumn - 1)
      const hashBefore = lineStart.trimEnd().endsWith('#')
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: hashBefore ? lineStart.lastIndexOf('#') + 1 : word.startColumn,
        endColumn: word.endColumn,
      }

      const suggestions: Monaco.languages.CompletionItem[] = [
        ...SHADY_UNIFORMS.map(u => ({
          label: u.name,
          kind: CompletionItemKind.Variable,
          detail: `uniform ${u.type}${u.arraySize ? `[${u.arraySize}]` : ''}`,
          documentation: u.doc,
          insertText: u.name,
          sortText: `0_${u.name}`,
          range,
        })),
        ...SHADY_BUILTINS.map(b => ({
          label: b.label,
          kind: CompletionItemKind.Variable,
          detail: b.detail,
          documentation: b.doc,
          insertText: b.insertText,
          sortText: `0_${b.label}`,
          range,
        })),
        ...GLSL_FUNCTIONS.map(f => ({
          label: f.label,
          kind: CompletionItemKind.Function,
          detail: f.detail,
          documentation: f.doc,
          insertText: f.insertText,
          insertTextRules: snippetRule,
          sortText: `1_${f.label}`,
          range,
        })),
        ...[...KEYWORDS, ...GLSL_CONSTANT_KEYWORDS].map(k => ({
          label: k, kind: CompletionItemKind.Keyword, insertText: k, sortText: `2_${k}`, range,
        })),
        ...TYPES.map(t => ({
          label: t, kind: CompletionItemKind.TypeParameter, insertText: t, sortText: `2_${t}`, range,
        })),
        ...GLSL_DIRECTIVES.map(d => ({
          label: d, kind: CompletionItemKind.Keyword, insertText: d, sortText: `3_${d}`, range,
        })),
      ]
      return { suggestions }
    },
  })
}
