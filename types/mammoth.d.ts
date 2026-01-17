declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: Array<{
      type: string;
      message: string;
    }>;
  }

  interface Options {
    arrayBuffer?: ArrayBuffer;
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(options: Options): Promise<ConversionResult>;
  export function convertToHtml(options: Options): Promise<ConversionResult>;
  export function convertToMarkdown(options: Options): Promise<ConversionResult>;
}
