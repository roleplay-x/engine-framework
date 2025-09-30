export interface WebViewOptions {
  transparent?: boolean;
  zIndex?: number;
  enableKeyboard?: boolean;
  enableMouse?: boolean;
}

export interface IWebViewAdapter {
  createWebView(id: string, url: string, options?: WebViewOptions): void;
  destroyWebView(id: string): void;
  sendMessageToWebView(event: string, data: any): void;
  registerWebViewCallback(event: string, callback: (data: any) => void): void;
  setWebViewFocus(hasFocus: boolean, enableCursor: boolean): void;
}
