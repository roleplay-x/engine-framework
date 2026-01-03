/**
 * Client event types for type safety
 */

import { CameraType } from '@roleplayx/engine-sdk';
import { ScreenType } from '@roleplayx/engine-ui-sdk';

import { PlayerId } from '../server/domains/session/models/session';

export interface RPClientEvents {
  playerReady: void;
  webviewScreenReady: { screen: string };
  webviewScreenClosed: { screen: string };
}

export interface RPServerToClientEvents {
  playerSpawned: {
    data: { position: { x: number; y: number; z: number }; heading: number };
  };
  playerDied: { position: { x: number; y: number; z: number } };
  playerJoined: { ipAddress: string; sessionId: string };
  playerLeft: { reason: string };
  'health:set': number;
  'health:validate': number;
  spawnExecute: SpawnData;
  'spawn:failed': { error: string };
  'player:initialize': SpawnData;
  cameraSet: CameraData;
  cameraPedEditSet: CameraPedEditData;
  cameraRelease: void;
  characterScreenshotResponse: {
    callbackId: string;
    base64Image?: string;
    error?: string;
  };
  'server:requestScreenshot': {
    callbackId: string;
  };
  serverConfig: {
    serverName: string;
  };
  webviewConfigureShell: { shellUrl: string };
  webviewShowScreen: {
    screen: string;
    data?: Record<string, any>;
    transition?: 'fade' | 'slide' | 'none';
  };
  webviewHideScreen: { screen: string };
  webviewCloseScreen: { screen: string };
  webviewUpdateScreen: {
    screen: string;
    data: Record<string, any>;
  };
  webviewSendMessage: {
    screen: string;
    event: string;
    data: any;
  };
  webviewSetContext: {
    player: Record<string, any>;
    config: Record<string, any>;
    localization: Record<string, any>;
  };
}

export interface RPClientToServerEvents {
  playerReady: {};
  playerSpawned: { data: { position: { x: number; y: number; z: number }; heading: number } };
  playerDied: { position: { x: number; y: number; z: number } };
  playerDamage: {
    attackerId: PlayerId;
    damageAmount: number;
    weaponHash: number;
    isFatal: boolean;
    timestamp: number;
  };
  spawnRequest: { spawnPointId?: string };
  spawnFailed: { error: string };
  webviewShellReady: {};
  webviewScreenReady: { screen: string };
  webviewScreenInitialized: { screen: string };
  webviewScreenAction: {
    screen: ScreenType;
    action: string;
    payload: any;
  };
  webviewScreenError: {
    screen: string;
    error: string;
  };
  webviewScreenClosed: { screen: string };
  characterPreview: {
    characterId?: string;
    [key: string]: any;
  };
  characterRequestScreenshot: {
    callbackId: string;
  };
  characterScreenshotCapture: {
    callbackId: string;
    base64Image?: string;
    error?: string;
  };
  'spawn:requestCamera': {
    cameraId?: string;
    screenType?: string;
  };
  'spawn:execute': {
    characterId: string;
    spawnLocationId: string;
  };
}

export interface CameraData {
  id: string;
  type: CameraType;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  freezePlayer?: boolean;
  hideHud?: boolean;
  enabled?: boolean;
  screenType?: string;
}

export interface CameraPedEditData {
  id: string;
  type: CameraType;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  freezePlayer?: boolean;
  hideHud?: boolean;
  enabled?: boolean;
  screenType?: string;
}

export interface SpawnData {
  position: { x: number; y: number; z: number } | import('.').Vector3;
  heading: number;
  model?: string | number;
  skipFade?: boolean;
}
