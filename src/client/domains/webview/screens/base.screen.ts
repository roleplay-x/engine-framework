import { RPClientService } from '../../../core/client-service';
import { ClientTypes } from '../../../core/types';

/**
 * Base class for screen handlers
 * All screen implementations should extend this class
 * Screens are services that handle UI screen-specific events
 */
export abstract class BaseScreen extends RPClientService<ClientTypes> {
  /**
   * Get the screen identifier (e.g., 'CHARACTER_SELECTION')
   */
  abstract getScreenName(): string;

  /**
   * Initialize the screen
   */
  async init(): Promise<void> {
    this.logger.info(`Initializing ${this.getScreenName()} screen handler`);
    await super.init();
  }

  /**
   * Dispose the screen
   */
  async dispose(): Promise<void> {
    this.logger.info(`Disposing ${this.getScreenName()} screen handler`);
    await super.dispose();
  }

  /**
   * Called when screen is ready to initialize
   */
  async onReadyToInitialize?(data: any): Promise<void>;

  /**
   * Called when screen is initializing
   */
  async onInitializing?(data: any): Promise<void>;

  /**
   * Called when screen is initialized
   */
  async onInitialized?(data: any): Promise<void>;

  /**
   * Called when screen is shown
   */
  async onShown?(data: any): Promise<void>;

  /**
   * Called when screen is hidden
   */
  async onHidden?(data: any): Promise<void>;

  /**
   * Called when screen is closed
   */
  async onClosed?(data: any): Promise<void>;

  /**
   * Called when screen encounters an error
   */
  async onError?(data: any): Promise<void>;

  /**
   * Handle any custom screen event
   */
  async handleEvent?(eventType: string, data: any): Promise<void>;
}

