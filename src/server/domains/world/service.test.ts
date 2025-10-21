/**
 * Tests for WorldService
 */
import { CameraType, SoundType } from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';

import { WorldService } from './service';
import { CameraId, RPCamera } from './models/camera';
import { RPSound, SoundId } from './models/sound';

describe('WorldService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let worldService: WorldService;

  // Test data
  const testCameraId: CameraId = 'cam_test123';
  const testCamera: RPCamera = {
    id: testCameraId,
    type: CameraType.Static,
    description: 'Test camera description',
    static: {
      blindfold: false,
      position: { x: 100, y: 200, z: 30 },
      rotation: { x: 0, y: 0, z: 180 },
      pointAt: { x: 0, y: 0, z: 0 },
      fov: 75,
      duration: 1000,
      easeInOut: false,
    },
    freezePlayer: false,
    hideHud: false,
    enabled: true,
    createdDate: Date.now(),
    lastModifiedDate: Date.now(),
  };

  const testSoundId: SoundId = 'sound_test123';
  const testSound: RPSound = {
    id: testSoundId,
    name: 'Test Sound',
    type: SoundType.External,
    description: 'Test sound description',
    attributes: { volume: '0.5', range: '100', loop: 'false' },
    externalUrl: 'https://example.com/test.mp3',
    enabled: true,
    createdDate: Date.now(),
    lastModifiedDate: Date.now(),
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockImplementation((apiType) => {
        if (apiType.name === 'CameraApi') {
          return {
            getCameras: jest.fn().mockResolvedValue([testCamera]),
            createCamera: jest.fn().mockResolvedValue(testCamera),
          };
        }
        if (apiType.name === 'SoundApi') {
          return {
            getSounds: jest.fn().mockResolvedValue([testSound]),
            createSound: jest.fn().mockResolvedValue(testSound),
          };
        }
        return {};
      }),
      getService: jest.fn(),
    } as unknown as RPServerContext;

    worldService = new WorldService(mockContext);
  });

  describe('init', () => {
    it('should initialize cameras and sounds', async () => {
      await worldService.init();

      expect(worldService.getCamera(testCameraId)).toEqual(testCamera);
      expect(worldService.getSound(testSoundId)).toEqual(testSound);
      expect(mockContext.getEngineApi).toHaveBeenCalledTimes(2);
    });

    it('should log initialization steps', async () => {
      const infoSpy = jest.spyOn(mockLogger, 'info');

      await worldService.init();

      expect(infoSpy).toHaveBeenCalledWith('Initializing cameras...');
      expect(infoSpy).toHaveBeenCalledWith('Initializing sounds...');
    });
  });

  describe('getCamera', () => {
    beforeEach(async () => {
      await worldService.init();
    });

    it('should return camera if exists in cache', () => {
      const result = worldService.getCamera(testCameraId);

      expect(result).toBe(testCamera);
    });

    it('should return undefined if camera does not exist', () => {
      const result = worldService.getCamera('nonexistent_camera');

      expect(result).toBeUndefined();
    });
  });

  describe('getSound', () => {
    beforeEach(async () => {
      await worldService.init();
    });

    it('should return sound if exists in cache', () => {
      const result = worldService.getSound(testSoundId);

      expect(result).toBe(testSound);
    });

    it('should return undefined if sound does not exist', () => {
      const result = worldService.getSound('nonexistent_sound');

      expect(result).toBeUndefined();
    });
  });

  describe('createCamera', () => {
    it('should create camera via API and add to cache', async () => {
      const request = {
        id: 'cam_new',
        name: 'New Camera',
        defaultName: 'New Camera',
        type: CameraType.Static,
        freezePlayer: false,
        hideHud: false,
        enabled: true,
        static: {
          blindfold: false,
          position: { x: 50, y: 100, z: 15 },
          rotation: { x: 0, y: 0, z: 90 },
          pointAt: { x: 0, y: 0, z: 0 },
          fov: 75,
          duration: 1000,
          easeInOut: false,
        },
      };

      const result = await worldService.createCamera(request);

      expect(result).toEqual(testCamera);
      expect(mockContext.getEngineApi).toHaveBeenCalled();
      expect(worldService.getCamera(testCameraId)).toEqual(testCamera);
    });
  });

  describe('createSound', () => {
    it('should create sound via API and add to cache', async () => {
      const request = {
        id: 'sound_new',
        name: 'New Sound',
        defaultName: 'New Sound',
        type: SoundType.External,
        attributes: { volume: '0.8', range: '50' },
        enabled: true,
      };

      const result = await worldService.createSound(request);

      expect(result).toEqual(testSound);
      expect(mockContext.getEngineApi).toHaveBeenCalled();
      expect(worldService.getSound(testSoundId)).toEqual(testSound);
    });
  });

  describe('socket event handlers', () => {
    beforeEach(async () => {
      await worldService.init();
    });

    describe('camera events', () => {
      describe('onSocketCameraCreated', () => {
        it('should refresh cameras and emit cameraCreated event if camera does not exist', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
          const newCameraId = 'cam_new123';

          mockEventEmitter.emit('socketCameraCreated', {
            id: newCameraId,
            type: CameraType.Static,
            description: 'New camera',
            freezePlayer: false,
            hideHud: false,
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('cameraCreated', { cameraId: newCameraId });
        });

        it('should do nothing if camera already exists', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketCameraCreated', {
            id: testCameraId,
            type: CameraType.Static,
            description: 'Test camera',
            freezePlayer: false,
            hideHud: false,
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit
        });
      });

      describe('onSocketCameraUpdated', () => {
        it('should refresh cameras and emit cameraUpdated event', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketCameraUpdated', {
            id: testCameraId,
            type: CameraType.Static,
            description: 'Test camera',
            freezePlayer: false,
            hideHud: false,
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('cameraUpdated', { cameraId: testCameraId });
        });
      });

      describe('onSocketCameraEnabled', () => {
        it('should refresh cameras and emit cameraUpdated event', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketCameraEnabled', {
            id: testCameraId,
            type: CameraType.Static,
            description: 'Test camera',
            freezePlayer: false,
            hideHud: false,
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('cameraUpdated', { cameraId: testCameraId });
        });
      });

      describe('onSocketCameraDisabled', () => {
        it('should refresh cameras and emit cameraUpdated event', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketCameraDisabled', {
            id: testCameraId,
            type: CameraType.Static,
            description: 'Test camera',
            freezePlayer: false,
            hideHud: false,
            enabled: false,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('cameraUpdated', { cameraId: testCameraId });
        });
      });
    });

    describe('sound events', () => {
      describe('onSocketSoundCreated', () => {
        it('should refresh sounds and emit soundCreated event if sound does not exist', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');
          const newSoundId = 'sound_new123';

          mockEventEmitter.emit('socketSoundCreated', {
            id: newSoundId,
            name: 'New Sound',
            type: SoundType.External,
            description: 'New sound',
            attributes: {},
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('soundCreated', { soundId: newSoundId });
        });

        it('should do nothing if sound already exists', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketSoundCreated', {
            id: testSoundId,
            name: 'Test Sound',
            type: SoundType.External,
            description: 'Test sound',
            attributes: {},
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit
        });
      });

      describe('onSocketSoundUpdated', () => {
        it('should refresh sounds and emit soundUpdated event', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketSoundUpdated', {
            id: testSoundId,
            name: 'Test Sound',
            type: SoundType.External,
            description: 'Test sound',
            attributes: {},
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('soundUpdated', { soundId: testSoundId });
        });
      });

      describe('onSocketSoundEnabled', () => {
        it('should refresh sounds and emit soundUpdated event', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketSoundEnabled', {
            id: testSoundId,
            name: 'Test Sound',
            type: SoundType.External,
            description: 'Test sound',
            attributes: {},
            enabled: true,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('soundUpdated', { soundId: testSoundId });
        });
      });

      describe('onSocketSoundDisabled', () => {
        it('should refresh sounds and emit soundUpdated event', async () => {
          const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

          mockEventEmitter.emit('socketSoundDisabled', {
            id: testSoundId,
            name: 'Test Sound',
            type: SoundType.External,
            description: 'Test sound',
            attributes: {},
            enabled: false,
            timestamp: Date.now(),
          });

          // Wait for async handler
          await new Promise((resolve) => setTimeout(resolve, 10));

          expect(emitSpy).toHaveBeenCalledWith('soundUpdated', { soundId: testSoundId });
        });
      });
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await worldService.init();
    });

    it('should maintain separate cameras in cache', () => {
      worldService['cameras'].clear(); // Clear cache from init

      const camera1: RPCamera = { ...testCamera, id: 'cam_1' };
      const camera2: RPCamera = { ...testCamera, id: 'cam_2', description: 'Camera 2' };

      worldService['cameras'].set('cam_1', camera1);
      worldService['cameras'].set('cam_2', camera2);

      expect(worldService['cameras'].get('cam_1')).toEqual(camera1);
      expect(worldService['cameras'].get('cam_2')).toEqual(camera2);
      expect(worldService['cameras'].size).toBe(2);
    });

    it('should maintain separate sounds in cache', () => {
      worldService['sounds'].clear(); // Clear cache from init

      const sound1: RPSound = { ...testSound, id: 'sound_1' };
      const sound2: RPSound = { ...testSound, id: 'sound_2', name: 'Sound 2' };

      worldService['sounds'].set('sound_1', sound1);
      worldService['sounds'].set('sound_2', sound2);

      expect(worldService['sounds'].get('sound_1')).toEqual(sound1);
      expect(worldService['sounds'].get('sound_2')).toEqual(sound2);
      expect(worldService['sounds'].size).toBe(2);
    });

    it('should refresh camera cache correctly', async () => {
      const newCamera: RPCamera = {
        ...testCamera,
        id: 'cam_updated',
        description: 'Updated Camera',
      };
      (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
        if (apiType.name === 'CameraApi') {
          return {
            getCameras: jest.fn().mockResolvedValue([newCamera]),
          };
        }
        return {};
      });

      await worldService['refreshCameras']();

      expect(worldService.getCamera('cam_updated')).toEqual(newCamera);
      expect(worldService.getCamera(testCameraId)).toBeUndefined();
    });

    it('should refresh sound cache correctly', async () => {
      const newSound: RPSound = { ...testSound, id: 'sound_updated', name: 'Updated Sound' };
      (mockContext.getEngineApi as jest.Mock).mockImplementation((apiType) => {
        if (apiType.name === 'SoundApi') {
          return {
            getSounds: jest.fn().mockResolvedValue([newSound]),
          };
        }
        return {};
      });

      await worldService['refreshSounds']();

      expect(worldService.getSound('sound_updated')).toEqual(newSound);
      expect(worldService.getSound(testSoundId)).toBeUndefined();
    });
  });
});
