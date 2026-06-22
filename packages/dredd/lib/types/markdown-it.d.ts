// Ambient declaration for the `markdown-it` package (v14), which ships no
// bundled types and has no `@types/markdown-it` installed. Dredd only uses the
// default factory and `render`, to turn the HTML reporter's Markdown buffer
// into HTML.
declare module 'markdown-it' {
  interface MarkdownIt {
    render(src: string, env?: any): string;
  }
  function markdownit(): MarkdownIt;
  export = markdownit;
}
