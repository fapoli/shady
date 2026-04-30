import type * as Monaco from 'monaco-editor'

export function registerGlslLanguage(monaco: typeof Monaco): void {
  monaco.languages.register({ id: 'glsl' })

  monaco.languages.setMonarchTokensProvider('glsl', {
    keywords: ['break','continue','do','for','while','if','else','return','discard','const','in','out','inout','uniform','layout','precision'],
    typeKeywords: ['void','bool','int','uint','float','double','vec2','vec3','vec4','ivec2','ivec3','ivec4','uvec2','uvec3','uvec4','mat2','mat3','mat4','sampler2D','samplerCube'],
    operators: ['=','>','<','!','~','?',':','==','<=','>=','!=','&&','||','++','--','+','-','*','/','&','|','^','%','+=','-=','*=','/=','%='],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    tokenizer: {
      root: [
        [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@typeKeywords': 'type', '@default': 'identifier' } }],
        { include: '@whitespace' },
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
