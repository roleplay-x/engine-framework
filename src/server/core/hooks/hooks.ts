export interface ScreenTypeCameraHookData {
  cameraId?: string;
  screenType: string;
  playerId: string;
}

export interface RPServerHooks {
  playerConnecting: (ipAddress: string) => boolean | Promise<boolean>;
  sessionCharacterLinked: (data: {
    sessionId: string;
    accountId: string;
    characterId: string;
  }) => void | Promise<void>;
  screenTypeCamera: (data: ScreenTypeCameraHookData) => ScreenTypeCameraHookData | null | Promise<ScreenTypeCameraHookData | null>;
}
