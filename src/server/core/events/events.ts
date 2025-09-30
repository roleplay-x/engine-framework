import { RPPlayerConnecting } from '../../natives/events/player/player-connecting';
import { RPPlayerReady } from '../../natives/events/player/player-ready';
import { RPSessionFinished } from '../../domains/session/events/session-finished';
import { RPSessionStarted } from '../../domains/session/events/session-started';
import { SocketSessionStarted } from '../../socket/events/socket-session-started';
import { SocketSessionAuthorized } from '../../socket/events/socket-session-authorized';
import { SocketSessionFinished } from '../../socket/events/socket-session-finished';
import { RPCharacterSync } from '../../domains/character/events/character-sync';
import { RPSessionAuthorized } from '../../domains/session/events/session-authorized';
import { SocketSessionCharacterLinked } from '../../socket/events/socket-session-character-linked';
import { SocketSessionUpdated } from '../../socket/events/socket-session-updated';
import { RPSessionCharacterLinked } from '../../domains/session/events/session-character-linked';
import { RPSessionUpdated } from '../../domains/session/events/session-updated';
import { SocketAccountUsernameChanged } from '../../socket/events/socket-account-username-changed';
import { RPAccountUsernameChanged } from '../../domains/account/events/account-username-changed';
import { SocketConfigurationUpdated } from '../../socket/events/socket-configuration-updated';
import { RPConfigurationUpdated } from '../../domains/configuration/events/configuration-updated';
import { SocketLocalizationUpdated } from '../../socket/events/socket-localization-updated';
import { SocketLocaleAdded } from '../../socket/events/socket-locale-added';
import { SocketLocaleEnabled } from '../../socket/events/socket-locale-enabled';
import { SocketLocaleDisabled } from '../../socket/events/socket-locale-disabled';
import { RPLocalesUpdated } from '../../domains/localization/events/locales-updated';
import { RPLocalizationUpdated } from '../../domains/localization/events/localization-updated';
import { RPPlayerDisconnected } from '../../natives/events/player/player-disconnected';
import { SocketCameraCreated } from '../../socket/events/socket-camera-created';
import { SocketCameraUpdated } from '../../socket/events/socket-camera-updated';
import { SocketCameraEnabled } from '../../socket/events/socket-camera-enabled';
import { SocketCameraDisabled } from '../../socket/events/socket-camera-disabled';
import { RPCameraCreated } from '../../domains/world/events/camera-created';
import { SocketSoundCreated } from '../../socket/events/socket-sound-created';
import { SocketSoundUpdated } from '../../socket/events/socket-sound-updated';
import { SocketSoundDisabled } from '../../socket/events/socket-sound-disabled';
import { SocketSoundEnabled } from '../../socket/events/socket-sound-enabled';
import { RPCameraUpdated } from '../../domains/world/events/camera-updated';
import { RPSoundCreated } from '../../domains/world/events/sound-created';
import { RPSoundUpdated } from '../../domains/world/events/sound-updated';
import { SocketMetricsUpdated } from '../../socket/events/socket-metrics-updated';
import { RPReferenceMetricsUpdated } from '../../domains/reference/events/reference-metrics-updated';
import { SocketSegmentDefinitionCreated } from '../../socket/events/socket-segment-definition-created';
import { SocketSegmentDefinitionUpdated } from '../../socket/events/socket-segment-definition-updated';
import { SocketSegmentDefinitionRemoved } from '../../socket/events/socket-segment-definition-removed';
import { SocketSegmentCreated } from '../../socket/events/socket-segment-created';
import { SocketSegmentRemoved } from '../../socket/events/socket-segment-removed';
import { RPSegmentCreated } from '../../domains/reference/events/segment-created';
import { RPSegmentRemoved } from '../../domains/reference/events/segment-removed';

import { RPServerEventEmitterError } from './error';

export interface RPServerEvents {
  // SYSTEM
  eventEmitterError: RPServerEventEmitterError;

  // NATIVE
  playerConnecting: RPPlayerConnecting;
  playerReady: RPPlayerReady;
  playerDisconnected: RPPlayerDisconnected;

  // SOCKET
  // SOCKET - SERVER
  socketConfigurationUpdated: SocketConfigurationUpdated;
  socketLocalizationUpdated: SocketLocalizationUpdated;
  socketLocaleAdded: SocketLocaleAdded;
  socketLocaleEnabled: SocketLocaleEnabled;
  socketLocaleDisabled: SocketLocaleDisabled;
  // SOCKET - CAMERA
  socketCameraCreated: SocketCameraCreated;
  socketCameraUpdated: SocketCameraUpdated;
  socketCameraEnabled: SocketCameraEnabled;
  socketCameraDisabled: SocketCameraDisabled;
  socketSoundCreated: SocketSoundCreated;
  socketSoundUpdated: SocketSoundUpdated;
  socketSoundEnabled: SocketSoundEnabled;
  socketSoundDisabled: SocketSoundDisabled;
  socketSessionStarted: SocketSessionStarted;
  socketSessionAuthorized: SocketSessionAuthorized;
  socketSessionCharacterLinked: SocketSessionCharacterLinked;
  socketSessionUpdated: SocketSessionUpdated;
  socketSessionFinished: SocketSessionFinished;
  // SOCKET - ACCOUNT
  socketAccountUsernameChanged: SocketAccountUsernameChanged;
  socketMetricsUpdated: SocketMetricsUpdated;
  socketSegmentDefinitionCreated: SocketSegmentDefinitionCreated;
  socketSegmentDefinitionUpdated: SocketSegmentDefinitionUpdated;
  socketSegmentDefinitionRemoved: SocketSegmentDefinitionRemoved;
  socketSegmentCreated: SocketSegmentCreated;
  socketSegmentRemoved: SocketSegmentRemoved;

  configurationUpdated: RPConfigurationUpdated;

  localesUpdated: RPLocalesUpdated;
  localizationUpdated: RPLocalizationUpdated;

  cameraCreated: RPCameraCreated;
  cameraUpdated: RPCameraUpdated;

  soundCreated: RPSoundCreated;
  soundUpdated: RPSoundUpdated;

  sessionStarted: RPSessionStarted;
  sessionFinished: RPSessionFinished;
  sessionAuthorized: RPSessionAuthorized;
  sessionCharacterLinked: RPSessionCharacterLinked;
  sessionUpdated: RPSessionUpdated;

  characterSync: RPCharacterSync;

  accountUsernameChanged: RPAccountUsernameChanged;

  referenceMetricsUpdated: RPReferenceMetricsUpdated;
  segmentCreated: RPSegmentCreated;
  segmentRemoved: RPSegmentRemoved;
}
