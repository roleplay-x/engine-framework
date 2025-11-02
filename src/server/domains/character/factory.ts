import {
  BlueprintConfigCategory,
  Character,
  generateCategoryReferenceId,
  ReferenceCategory,
} from '@roleplayx/engine-sdk';

import { RPServerService } from '../../core/server-service';
import { BlueprintService } from '../blueprint/service';
import { ReferenceService } from '../reference/service';
import { SegmentDefinitionId } from '../reference/models/segment';

import { RPCharacter, RPCharacterAppearance } from './models/character';

/**
 * Factory service for transforming character data from the Engine API to the server representation.
 *
 * This service handles the conversion of character appearance data from raw key-value pairs
 * to structured blueprint configuration values. It also validates whether required appearance
 * fields are present.
 *
 * @example
 * ```typescript
 * const characterFactory = context.getService(CharacterFactory);
 * const apiCharacter = await characterApi.getCharacterById('char_123');
 * const rpCharacter = characterFactory.create(apiCharacter);
 *
 * if (rpCharacter.appearance?.isUpdateRequired) {
 *   console.log('Character appearance needs to be updated');
 * }
 * ```
 */
export class CharacterFactory extends RPServerService {
  /**
   * Transforms an Engine API character into the server's character representation.
   *
   * Processes the character's appearance data by:
   * - Converting raw appearance data into structured blueprint configuration values
   * - Checking if any required appearance fields are missing
   * - Preserving image URL and version information
   *
   * If the character has no appearance data, returns a character with an empty appearance
   * that requires an update.
   *
   * @param character - The character data from the Engine API
   * @param existingCharacter The existing character info
   * @param accountSegmentDefinitionIds
   * @returns The transformed character with processed appearance data
   *
   * @example
   * ```typescript
   * const apiCharacter = {
   *   id: 'char_123',
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   appearance: {
   *     data: { hairColor: 'brown', eyeColor: 'blue' },
   *     version: 1,
   *     imageUrl: 'https://example.com/image.png'
   *   }
   * };
   *
   * const rpCharacter = characterFactory.create(apiCharacter);
   * console.log(rpCharacter.appearance?.values); // Structured blueprint values
   * console.log(rpCharacter.appearance?.isUpdateRequired); // false if all required fields present
   * ```
   */
  public async create({
    character,
    existingCharacter,
    accountSegmentDefinitionIds,
  }: {
    character: Character;
    existingCharacter?: RPCharacter;
    accountSegmentDefinitionIds?: ReadonlyArray<SegmentDefinitionId>;
  }): Promise<RPCharacter> {
    return {
      ...character,
      appearance: await this.getAppearance(character, accountSegmentDefinitionIds),
      spawned: existingCharacter?.spawned ?? false,
    };
  }

  private async getAppearance(
    character: Character,
    accountSegmentDefinitionIds?: ReadonlyArray<SegmentDefinitionId>,
  ): Promise<RPCharacterAppearance> {
    if (!character.appearance) {
      return { values: [], version: 0, isUpdateRequired: true };
    }

    const segmentDefinitionIds = await this.getSegmentDefinitionIds(
      character,
      accountSegmentDefinitionIds,
    );

    return {
      values: this.getService(BlueprintService).getValues(
        BlueprintConfigCategory.CharacterAppearance,
        character.appearance.data,
      ),
      isUpdateRequired: this.getService(BlueprintService).isRequiredValuesMissing(
        BlueprintConfigCategory.CharacterAppearance,
        character.appearance.data,
        (constraints) => {
          if (!constraints.appearance) {
            return true;
          }

          if (
            constraints.appearance.genders?.length &&
            !constraints.appearance.genders.includes(character.gender)
          ) {
            return false;
          }

          if (
            constraints.segmentDefinitionIds?.length &&
            !constraints.segmentDefinitionIds.some((segmentDefinitionId) =>
              segmentDefinitionIds.has(segmentDefinitionId),
            )
          ) {
            return false;
          }

          return true;
        },
      ),
      imageUrl: character.appearance.imageUrl,
      version: character.appearance.version,
    };
  }

  private async getSegmentDefinitionIds(
    character: Character,
    accountSegmentDefinitionIds?: ReadonlyArray<SegmentDefinitionId>,
  ): Promise<Set<SegmentDefinitionId>> {
    const referenceService = this.getService(ReferenceService);
    const promises = [
      referenceService.fetchReferenceSegmentDefinitionIds(
        generateCategoryReferenceId(ReferenceCategory.Character, character.id),
      ),
    ];

    if (!accountSegmentDefinitionIds) {
      promises.push(
        referenceService.fetchReferenceSegmentDefinitionIds(
          generateCategoryReferenceId(ReferenceCategory.Account, character.accountId),
        ),
      );
    }

    const segmentDefinitionIds = (await Promise.all(promises)).flatMap((p) => p);
    return new Set<SegmentDefinitionId>([
      ...segmentDefinitionIds,
      ...(accountSegmentDefinitionIds ?? []),
    ]);
  }
}
