import { RPClientService } from '../../core/client-service';
import { ClientTypes } from '../../core/types';

/**
 * Service for managing character-related webview callbacks and functionality.
 *
 * This service provides functionality for:
 * - Character selection UI interactions
 * - Character preview management
 * - Character creation/customization callbacks
 *
 * @example
 * ```typescript
 * const characterService = context.getService(CharacterService);
 * ```
 */
export class CharacterService extends RPClientService<ClientTypes> {
  public async init(): Promise<void> {
    this.logger.info('Initializing character service...');
    await super.init();
  }

  public async dispose(): Promise<void> {
    await super.dispose();
  }
}

