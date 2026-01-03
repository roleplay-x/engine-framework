/**
 * Screenshot Adapter Interface
 * 
 * Platform-agnostic interface for capturing screenshots
 * Each platform should implement this interface with their specific screenshot mechanism
 */
export interface IScreenshotAdapter {
  /**
   * Capture a screenshot of the current game view
   * 
   * @param options - Screenshot capture options
   * @returns Promise resolving to base64-encoded image data URI (e.g., "data:image/png;base64,...")
   * @throws Error if screenshot capture fails
   */
  captureScreenshot(options?: ScreenshotOptions): Promise<string>;
}

/**
 * Screenshot capture options
 */
export interface ScreenshotOptions {
  /**
   * Image encoding format
   * @default 'png'
   */
  encoding?: 'png' | 'jpg' | 'webp';
  
  /**
   * Image quality for lossy formats (0.0 - 1.0)
   * @default 1.0
   */
  quality?: number;
}

