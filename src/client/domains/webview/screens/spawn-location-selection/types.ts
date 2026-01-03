/**
 * Spawn Location Selection Screen Event Types
 * 
 * These types define the structure of events and data payloads
 * for the Spawn Location Selection screen handler.
 */

/**
 * Screen initialization data structure
 * Sent from server when screen is opened
 */
export interface SpawnLocationSelectionScreenData {
  characterId?: string;
}

/**
 * Spawn location preview event payload
 * Sent from shell when a spawn location is selected
 */
export interface SpawnLocationPreviewPayload {
  cameraId?: string;
  payload?: {
    cameraId?: string;
  };
}

/**
 * Spawn request event payload
 * Sent from shell when Play button is clicked
 */
export interface SpawnRequestPayload {
  spawnLocationId: string;
  payload?: {
    spawnLocationId?: string;
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
  payload?: {
    characterId?: string;
  };
}

/**
 * Screen closed event payload
 */
export interface ScreenClosedPayload {
  screen?: string;
  [key: string]: unknown;
}

