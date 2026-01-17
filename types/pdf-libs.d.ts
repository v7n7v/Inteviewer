declare module 'html2canvas' {
  interface Options {
    scale?: number;
    useCORS?: boolean;
    logging?: boolean;
    backgroundColor?: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    scrollX?: number;
    scrollY?: number;
    windowWidth?: number;
    windowHeight?: number;
    allowTaint?: boolean;
    foreignObjectRendering?: boolean;
    removeContainer?: boolean;
  }

  function html2canvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement>;
  export default html2canvas;
}

declare module 'jspdf' {
  interface jsPDFOptions {
    orientation?: 'p' | 'portrait' | 'l' | 'landscape';
    unit?: 'pt' | 'px' | 'in' | 'mm' | 'cm' | 'ex' | 'em' | 'pc';
    format?: string | number[];
    compress?: boolean;
    precision?: number;
    putOnlyUsedFonts?: boolean;
    hotfixes?: string[];
  }

  export default class jsPDF {
    constructor(options?: jsPDFOptions);
    constructor(orientation?: string, unit?: string, format?: string | number[]);

    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };

    addImage(
      imageData: string | HTMLImageElement | HTMLCanvasElement,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: string,
      rotation?: number
    ): jsPDF;

    save(filename?: string, options?: { returnPromise: boolean }): jsPDF | Promise<void>;
    
    addPage(format?: string | number[], orientation?: string): jsPDF;
    
    setPage(pageNumber: number): jsPDF;
    
    getNumberOfPages(): number;
    
    text(text: string, x: number, y: number, options?: any): jsPDF;
    
    setFontSize(size: number): jsPDF;
    
    setFont(fontName: string, fontStyle?: string, fontWeight?: string | number): jsPDF;
  }
}
