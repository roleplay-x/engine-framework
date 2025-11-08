import { SpawnLocationId } from '../../../world/models/spawn-location';

/**
 *
 * @export
 * @interface SpawnMyCharacterApiRequest
 */
export interface SpawnMyCharacterApiRequest {
  /**
   * The id of the selected spawn location.
   * @type {SpawnLocationId}
   * @memberof SpawnMyCharacterApiRequest
   */
  spawnLocationId: SpawnLocationId;
}
