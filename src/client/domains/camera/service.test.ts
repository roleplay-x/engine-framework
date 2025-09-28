import { CameraService } from './service';
import { MockLogger } from '../../../../test/mocks';
import { ClientPlatformAdapter } from '../../natives/adapters';
import { RPClientContext } from '../../core/context';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { RPClientHooks } from '../../core/hooks/hooks';
import { EventService } from '../event/service';
import { Vector3 } from '../../../shared';
import { CameraData } from '../../core/events/types';

// Mock platform adapter
const mockPlatformAdapter = {
  player: {
    getPlayerPed: jest.fn().mockReturnValue(1),
    getPlayerHealth: jest.fn().mockReturnValue(100),
    setPlayerHealth: jest.fn(),
    isPlayerDead: jest.fn().mockReturnValue(false),
  },
  network: {
    onServerEvent: jest.fn(),
    emitToServer: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    emit: jest.fn(),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
    onGameEvent: jest.fn(),
    offGameEvent: jest.fn(),
    mapPlatformEvent: jest.fn(),
    unmapPlatformEvent: jest.fn(),
    getMappedGameEvent: jest.fn().mockReturnValue(null),
  },
  core: {
    wait: jest.fn().mockResolvedValue(undefined),
    getGameTimer: jest.fn().mockReturnValue(1000),
    getHashKey: jest.fn().mockReturnValue(12345),
    displayHud: jest.fn(),
    displayRadar: jest.fn(),
    isHudHidden: jest.fn().mockReturnValue(false),
  },
  camera: {
    createCamera: jest.fn().mockReturnValue(123),
    destroyCamera: jest.fn(),
    setCameraActive: jest.fn(),
    renderScriptCameras: jest.fn(),
    setCameraCoord: jest.fn(),
    setCameraRotation: jest.fn(),
    setCameraFov: jest.fn(),
    pointCameraAtCoord: jest.fn(),
    pointCameraAtEntity: jest.fn(),
    attachCameraToEntity: jest.fn(),
    detachCamera: jest.fn(),
    isCameraActive: jest.fn().mockReturnValue(true),
    getCameraCoord: jest.fn().mockReturnValue(new Vector3(0, 0, 0)),
    getCameraRotation: jest.fn().mockReturnValue(new Vector3(0, 0, 0)),
    getCameraFov: jest.fn().mockReturnValue(75),
  },
} as unknown as jest.Mocked<ClientPlatformAdapter>;

// Mock event service
const mockEventService = {
  onServerEvent: jest.fn(),
  offServerEvent: jest.fn(),
  emitToServer: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  once: jest.fn(),
  emit: jest.fn(),
  removeAllListeners: jest.fn(),
  listenerCount: jest.fn().mockReturnValue(0),
  onGameEvent: jest.fn(),
  offGameEvent: jest.fn(),
  mapPlatformEvent: jest.fn(),
  unmapPlatformEvent: jest.fn(),
  getMappedGameEvent: jest.fn().mockReturnValue(null),
} as unknown as jest.Mocked<EventService>;

// Mock logger
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock context
const mockContext = {
  getPlatformAdapter: jest.fn().mockReturnValue(mockPlatformAdapter),
  getService: jest.fn().mockReturnValue(mockEventService),
  getLogger: jest.fn().mockReturnValue(mockLogger),
  getHookBus: jest.fn().mockReturnValue(new RPHookBus<RPClientHooks>()),
  addService: jest.fn(),
  removeService: jest.fn(),
  hasService: jest.fn().mockReturnValue(true),
  getServices: jest.fn().mockReturnValue([]),
  clear: jest.fn(),
  logger: mockLogger,
  platformAdapter: mockPlatformAdapter,
} as unknown as jest.Mocked<RPClientContext<any, RPClientHooks>>;

describe('CameraService', () => {
  let cameraService: CameraService;

  beforeEach(() => {
    cameraService = new CameraService(mockContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize successfully', async () => {
      await cameraService.init();
      expect(cameraService).toBeDefined();
    });
  });

  describe('onCameraSet', () => {
    it('should set camera with all properties', () => {
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 90,
        freezePlayer: true,
        hideHud: true,
      };

      cameraService.onCameraSet(cameraData);

      expect(mockPlatformAdapter.camera.createCamera).toHaveBeenCalledWith('static');
      expect(mockPlatformAdapter.camera.setCameraCoord).toHaveBeenCalledWith(
        123,
        new Vector3(100, 200, 300),
      );
      expect(mockPlatformAdapter.camera.setCameraRotation).toHaveBeenCalledWith(
        123,
        new Vector3(0, 0, 0),
      );
      expect(mockPlatformAdapter.camera.setCameraFov).toHaveBeenCalledWith(123, 90);
      expect(mockPlatformAdapter.camera.setCameraActive).toHaveBeenCalledWith(123, true);
      expect(mockPlatformAdapter.core.displayHud).toHaveBeenCalledWith(false);
      expect(mockPlatformAdapter.core.displayRadar).toHaveBeenCalledWith(false);
      expect(cameraService.getActiveCamera()).toBe('test-camera');
    });

    it('should set camera without hiding HUD when hideHud is false', () => {
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 90,
        freezePlayer: true,
        hideHud: false,
      };

      cameraService.onCameraSet(cameraData);

      expect(mockPlatformAdapter.core.displayHud).not.toHaveBeenCalled();
      expect(mockPlatformAdapter.core.displayRadar).not.toHaveBeenCalled();
    });
  });

  describe('onCameraRelease', () => {
    it('should release camera and restore HUD', () => {
      // First set a camera
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 90,
        freezePlayer: true,
        hideHud: true,
      };
      cameraService.onCameraSet(cameraData);

      // Then release it
      cameraService.onCameraRelease();

      expect(mockPlatformAdapter.camera.setCameraActive).toHaveBeenCalledWith(123, false);
      expect(mockPlatformAdapter.camera.destroyCamera).toHaveBeenCalledWith(123, true);
      expect(mockPlatformAdapter.camera.renderScriptCameras).toHaveBeenCalledWith(
        false,
        true,
        1000,
        true,
        true,
      );
      expect(mockPlatformAdapter.core.displayHud).toHaveBeenCalledWith(true);
      expect(mockPlatformAdapter.core.displayRadar).toHaveBeenCalledWith(true);
      expect(cameraService.getActiveCamera()).toBeNull();
    });

    it('should handle release when no camera is active', () => {
      cameraService.onCameraRelease();

      expect(mockPlatformAdapter.camera.setCameraActive).not.toHaveBeenCalled();
      expect(mockPlatformAdapter.camera.destroyCamera).not.toHaveBeenCalled();
      expect(mockPlatformAdapter.camera.renderScriptCameras).toHaveBeenCalledWith(
        false,
        true,
        1000,
        true,
        true,
      );
      expect(mockPlatformAdapter.core.displayHud).toHaveBeenCalledWith(true);
      expect(mockPlatformAdapter.core.displayRadar).toHaveBeenCalledWith(true);
    });
  });

  describe('getActiveCamera', () => {
    it('should return null when no camera is active', () => {
      expect(cameraService.getActiveCamera()).toBeNull();
    });

    it('should return active camera ID when camera is set', () => {
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 90,
        freezePlayer: true,
        hideHud: false,
      };

      cameraService.onCameraSet(cameraData);
      expect(cameraService.getActiveCamera()).toBe('test-camera');
    });
  });

  describe('isCameraActive', () => {
    it('should return false when no camera is active', () => {
      expect(cameraService.isCameraActive()).toBe(false);
    });

    it('should return true when camera is active', () => {
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 90,
        freezePlayer: true,
        hideHud: false,
      };

      cameraService.onCameraSet(cameraData);
      expect(cameraService.isCameraActive()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up resources when disposing', async () => {
      // First set a camera
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 100, y: 200, z: 300 },
        rotation: { x: 0, y: 0, z: 0 },
        fov: 90,
        freezePlayer: true,
        hideHud: false,
      };
      cameraService.onCameraSet(cameraData);

      // Then dispose
      await cameraService.dispose();

      expect(mockPlatformAdapter.camera.setCameraActive).toHaveBeenCalledWith(123, false);
      expect(mockPlatformAdapter.camera.destroyCamera).toHaveBeenCalledWith(123, true);
      expect(cameraService.getActiveCamera()).toBeNull();
    });

    it('should handle dispose when no camera is active', async () => {
      await cameraService.dispose();

      expect(mockPlatformAdapter.camera.setCameraActive).not.toHaveBeenCalled();
      expect(mockPlatformAdapter.camera.destroyCamera).not.toHaveBeenCalled();
      expect(cameraService.getActiveCamera()).toBeNull();
    });
  });

  describe('Vector3 conversion', () => {
    it('should properly convert position and rotation to Vector3', () => {
      const cameraData: CameraData = {
        id: 'test-camera',
        type: 'static',
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 4, y: 5, z: 6 },
        fov: 90,
        freezePlayer: true,
        hideHud: false,
      };

      cameraService.onCameraSet(cameraData);

      expect(mockPlatformAdapter.camera.setCameraCoord).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          x: 1,
          y: 2,
          z: 3,
        }),
      );

      expect(mockPlatformAdapter.camera.setCameraRotation).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          x: 4,
          y: 5,
          z: 6,
        }),
      );
    });
  });
});
