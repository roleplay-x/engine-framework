export interface RPServerHooks {
  playerConnecting: (ipAddress: string) => boolean | Promise<boolean>;
  sessionCharacterLinked: (data: {
    sessionId: string;
    accountId: string;
    characterId: string;
  }) => void | Promise<void>;
}
