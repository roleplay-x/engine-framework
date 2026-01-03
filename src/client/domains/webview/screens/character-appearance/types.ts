import { BaseBlueprintConfigValue } from '@roleplayx/engine-sdk';

/**
 * Character Appearance Screen Event Types
 * 
 * These types define the structure of events and data payloads
 * for the Character Appearance screen handler.
 */

/**
 * Screen initialization data structure
 * Sent from server when screen is opened
 */
export interface CharacterAppearanceScreenData {
  characterId?: string;
  values?: BaseBlueprintConfigValue[];
  isInitial?: boolean;
}

/**
 * Character appearance preview event payload
 * Sent from shell when appearance values change
 */
export interface CharacterAppearancePreviewPayload {
  values: BaseBlueprintConfigValue[];
  payload?: {
    values?: BaseBlueprintConfigValue[];
  };
}

/**
 * Character render requested event payload
 * Sent from shell when Save button is clicked
 */
export interface CharacterRenderRequestedPayload {
  values: BaseBlueprintConfigValue[];
  characterId?: string;
  payload?: {
    values?: BaseBlueprintConfigValue[];
    characterId?: string;
  };
}

/**
 * Character rendered event payload
 * Sent from client to shell after screenshot is captured
 */
export interface CharacterRenderedPayload {
  base64Image: string;
  characterId?: string | null;
  values?: BaseBlueprintConfigValue[];
}

/**
 * Character render failed event payload
 * Sent from client to shell when render fails
 */
export interface CharacterRenderFailedPayload {
  error: string;
}

/**
 * Section selected event payload
 * Sent from shell when a section is selected
 */
export interface SectionSelectedPayload {
  key: string;
  payload?: {
    key?: string;
  };
}

/**
 * Screen initialized event payload
 * Sent from shell when screen initialization completes
 */
export interface ScreenInitializedPayload {
  screen?: string;
  templateId?: string;
  hideLoading?: boolean;
  hiddenOnFirstLoad?: boolean;
  characterId?: string;
  values?: BaseBlueprintConfigValue[];
  payload?: {
    characterId?: string;
    values?: BaseBlueprintConfigValue[];
  };
}

/**
 * Screen closed event payload
 */
export interface ScreenClosedPayload {
  screen?: string;
  [key: string]: unknown;
}

/**
 * Notification payload for screen events
 */
export type ScreenNotificationPayload = 
  | { type: 'characterRendered'; data: CharacterRenderedPayload }
  | { type: 'characterRenderFailed'; data: CharacterRenderFailedPayload };

