declare module "@citation-js/core" {
  class Cite {
    constructor(data: unknown);
    format(type: string, options: { format: string; template: string; lang: string }): string;
  }
  export default Cite;
}

declare module "@citation-js/plugin-csl" {}
