import { RPServerEvents } from '../core/events/events';

export enum IncomingSocketEvents {
  // SERVER
  ConfigurationUpdated = 'server.configurationUpdated',
  LocalizationUpdated = 'server.localizationUpdated',
  LocaleAdded = 'server.localeAdded',
  LocaleEnabled = 'server.localeEnabled',
  LocaleDisabled = 'server.localeDisabled',

  // CAMERA
  CameraCreated = 'camera.created',
  CameraUpdated = 'camera.updated',
  CameraEnabled = 'camera.enabled',
  CameraDisabled = 'camera.disabled',

  // SOUND
  SoundCreated = 'sound.created',
  SoundUpdated = 'sound.updated',
  SoundEnabled = 'sound.enabled',
  SoundDisabled = 'sound.disabled',

  // SESSION
  SessionStarted = 'session.started',
  SessionFinished = 'session.finished',
  SessionAuthorized = 'session.authorized',
  SessionCharacterLinked = 'session.characterLinked',
  SessionUpdated = 'session.updated',

  // ACCOUNT
  AccountUsernameChanged = 'account.usernameChanged',

  // REFERENCE
  MetricsUpdated = 'metrics.updated',
  SegmentDefinitionCreated = 'segmentDefinition.created',
  SegmentDefinitionUpdated = 'segmentDefinition.updated',
  SegmentDefinitionRemoved = 'segmentDefinition.removed',
  SegmentCreated = 'segment.created',
  SegmentRemoved = 'segment.removed',
}

export const IncomingSocketEventsMap = {
  [IncomingSocketEvents.ConfigurationUpdated]: 'socketConfigurationUpdated',
  [IncomingSocketEvents.SessionStarted]: 'socketSessionStarted',
  [IncomingSocketEvents.SessionFinished]: 'socketSessionFinished',
  [IncomingSocketEvents.SessionAuthorized]: 'socketSessionAuthorized',
  [IncomingSocketEvents.SessionCharacterLinked]: 'socketSessionCharacterLinked',
  [IncomingSocketEvents.SessionUpdated]: 'socketSessionUpdated',
  [IncomingSocketEvents.AccountUsernameChanged]: 'socketAccountUsernameChanged',
  [IncomingSocketEvents.LocalizationUpdated]: 'socketLocalizationUpdated',
  [IncomingSocketEvents.LocaleAdded]: 'socketLocaleAdded',
  [IncomingSocketEvents.LocaleEnabled]: 'socketLocaleEnabled',
  [IncomingSocketEvents.LocaleDisabled]: 'socketLocaleDisabled',
  [IncomingSocketEvents.CameraCreated]: 'socketCameraCreated',
  [IncomingSocketEvents.CameraUpdated]: 'socketCameraUpdated',
  [IncomingSocketEvents.CameraEnabled]: 'socketCameraEnabled',
  [IncomingSocketEvents.CameraDisabled]: 'socketCameraDisabled',
  [IncomingSocketEvents.SoundCreated]: 'socketSoundCreated',
  [IncomingSocketEvents.SoundUpdated]: 'socketSoundUpdated',
  [IncomingSocketEvents.SoundEnabled]: 'socketSoundEnabled',
  [IncomingSocketEvents.SoundDisabled]: 'socketSoundDisabled',
  [IncomingSocketEvents.MetricsUpdated]: 'socketMetricsUpdated',
  [IncomingSocketEvents.SegmentDefinitionCreated]: 'socketSegmentDefinitionCreated',
  [IncomingSocketEvents.SegmentDefinitionUpdated]: 'socketSegmentDefinitionUpdated',
  [IncomingSocketEvents.SegmentDefinitionRemoved]: 'socketSegmentDefinitionRemoved',
  [IncomingSocketEvents.SegmentCreated]: 'socketSegmentCreated',
  [IncomingSocketEvents.SegmentRemoved]: 'socketSegmentRemoved',
} satisfies { [K in IncomingSocketEvents]: keyof RPServerEvents };

export enum OutgoingSocketEvents {
  Connected = 'connected',
  CharacterSync = 'character.sync',
}

export const OutgoingSocketEventsMap: {
  [K in keyof RPServerEvents]?: OutgoingSocketEvents;
} = {
  characterSync: OutgoingSocketEvents.CharacterSync,
};
