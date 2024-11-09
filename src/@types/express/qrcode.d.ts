declare module 'qrcode' {
    interface QRCodeToFileOptions {
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      margin?: number;
      scale?: number;
      width?: number;
      color?: {
        dark?: string;
        light?: string;
      };
    }
  
    export function toFile(
      path: string,
      text: string,
      options?: QRCodeToFileOptions
    ): Promise<void>;
  }
  