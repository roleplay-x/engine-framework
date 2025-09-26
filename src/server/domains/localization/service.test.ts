/**
 * Tests for LocalizationService
 */
import {
  DefaultNameTranslation,
  ErrorTranslation,
  Locale,
  Localization,
  TextTranslation,
} from '@roleplayx/engine-sdk';

import { RPEventEmitter } from '../../../core/bus/event-emitter';
import { RPHookBus } from '../../../core/bus/hook-bus';
import { MockLogger } from '../../../../test/mocks';
import { RPServerContext } from '../../core/context';
import { RPServerEvents } from '../../core/events/events';
import { RPServerHooks } from '../../core/hooks/hooks';

import { LocalizationService } from './service';

describe('LocalizationService', () => {
  let mockLogger: MockLogger;
  let mockEventEmitter: RPEventEmitter<RPServerEvents>;
  let mockHookBus: RPHookBus<RPServerHooks>;
  let mockContext: RPServerContext;
  let localizationService: LocalizationService;

  // Test data
  const testLocales: Locale[] = [
    {
      code: 'en-US',
      name: 'English (US)',
      iconUrl: 'https://example.com/en.png',
      enabled: true,
      order: 1,
    },
    {
      code: 'fr-FR',
      name: 'Français',
      iconUrl: 'https://example.com/fr.png',
      enabled: true,
      order: 2,
    },
    {
      code: 'de-DE',
      name: 'Deutsch',
      iconUrl: 'https://example.com/de.png',
      enabled: false,
      order: 3,
    },
  ];

  const testLocalization: Localization = {
    'en-US': {
      locales: {
        'en-US': { name: 'English (US)' },
        'fr-FR': { name: 'French' },
        'de-DE': { name: 'German' },
      },
      errors: {
        notFound: {
          message: 'Not found',
          description: 'The requested resource was not found',
          parameters: [],
        },
        unauthorized: {
          message: 'Unauthorized',
          description: 'Access denied',
          parameters: [],
        },
      },
      texts: {
        welcome: {
          message: 'Welcome',
          description: 'Welcome message',
          parameters: [],
        },
        login: {
          message: 'Login',
          description: 'Login button text',
          parameters: [],
        },
      },
    },
    'fr-FR': {
      locales: {
        'en-US': { name: 'Anglais (US)' },
        'fr-FR': { name: 'Français' },
        'de-DE': { name: 'Allemand' },
      },
      errors: {
        notFound: {
          message: 'Non trouvé',
          description: "La ressource demandée n'a pas été trouvée",
          parameters: [],
        },
        unauthorized: {
          message: 'Non autorisé',
          description: 'Accès refusé',
          parameters: [],
        },
      },
      texts: {
        welcome: {
          message: 'Bienvenue',
          description: 'Message de bienvenue',
          parameters: [],
        },
        login: {
          message: 'Connexion',
          description: 'Texte du bouton de connexion',
          parameters: [],
        },
      },
    },
  };

  const mockLocaleApi = {
    getLocales: jest.fn(),
  };

  const mockLocalizationApi = {
    getLocalization: jest.fn(),
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    mockEventEmitter = new RPEventEmitter<RPServerEvents>();
    mockHookBus = new RPHookBus<RPServerHooks>();

    // Reset mocks before each test - only enabled locales are returned by getLocales with enabled: true
    const enabledLocales = testLocales.filter((l) => l.enabled);
    mockLocaleApi.getLocales.mockResolvedValue(enabledLocales);
    mockLocalizationApi.getLocalization.mockResolvedValue(testLocalization);

    const mockConfigurationService = {
      getConfig: jest.fn().mockReturnValue({ value: { key: 'en-US' } }),
    };

    mockContext = {
      logger: mockLogger,
      eventEmitter: mockEventEmitter,
      hookBus: mockHookBus,
      getEngineApi: jest.fn().mockImplementation((apiType) => {
        if (apiType.name === 'LocaleApi') {
          return mockLocaleApi;
        }
        if (apiType.name === 'LocalizationApi') {
          return mockLocalizationApi;
        }
        return {};
      }),
      getService: jest.fn().mockImplementation((serviceType) => {
        if (serviceType.name === 'ConfigurationService') {
          return mockConfigurationService;
        }
        return {};
      }),
    } as unknown as RPServerContext;

    localizationService = new LocalizationService(mockContext);
  });

  describe('init', () => {
    it('should initialize locales and localization', async () => {
      await localizationService.init();

      const locales = localizationService.getLocales();
      const enLocalization = localizationService.getLocalization('en-US');

      const enabledLocales = testLocales.filter((l) => l.enabled);
      expect(locales).toEqual(enabledLocales);
      expect(enLocalization).toEqual(testLocalization['en-US']);
      expect(mockContext.getEngineApi).toHaveBeenCalledTimes(2);
    });

    it('should log initialization steps', async () => {
      const infoSpy = jest.spyOn(mockLogger, 'info');

      await localizationService.init();

      expect(infoSpy).toHaveBeenCalledWith('Initializing locales...');
      expect(infoSpy).toHaveBeenCalledWith('Initializing localization...');
    });

    it('should call APIs with correct parameters', async () => {
      await localizationService.init();

      expect(mockLocaleApi.getLocales).toHaveBeenCalledWith({
        enabled: true,
        noCache: true,
      });
      expect(mockLocalizationApi.getLocalization).toHaveBeenCalledWith({
        noCache: true,
      });
    });
  });

  describe('getLocales', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should return all locales', () => {
      const result = localizationService.getLocales();

      const enabledLocales = testLocales.filter((l) => l.enabled);
      expect(result).toEqual(enabledLocales);
      expect(result).toHaveLength(2);
    });

    it('should return the same array reference', () => {
      const result1 = localizationService.getLocales();
      const result2 = localizationService.getLocales();

      expect(result1).toBe(result2);
    });

    it('should include both enabled and disabled locales', () => {
      const result = localizationService.getLocales();
      const enabledLocales = result.filter((l) => l.enabled);
      const disabledLocales = result.filter((l) => !l.enabled);

      expect(enabledLocales).toHaveLength(2);
      expect(disabledLocales).toHaveLength(0);
    });
  });

  describe('getLocale', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should return locale by code if exists', () => {
      const result = localizationService.getLocale('en-US');

      expect(result).toEqual(testLocales[0]);
    });

    it('should return undefined if locale does not exist', () => {
      const result = localizationService.getLocale('es-ES');

      expect(result).toBeUndefined();
    });

    it('should find locales with different enabled states', () => {
      const enabledLocale = localizationService.getLocale('en-US');
      const disabledLocale = localizationService.getLocale('de-DE');

      expect(enabledLocale?.enabled).toBe(true);
      expect(disabledLocale).toBeUndefined(); // disabled locales are not loaded
    });
  });

  describe('getLocalization', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should return localization bundle for existing locale', () => {
      const result = localizationService.getLocalization('en-US');

      expect(result).toEqual(testLocalization['en-US']);
    });

    it('should fallback to default locale for non-existing locale', () => {
      const result = localizationService.getLocalization('es-ES');

      // Should fallback to en-US (default locale)
      expect(result).toEqual(testLocalization['en-US']);
    });

    it('should handle different locales correctly', () => {
      const enResult = localizationService.getLocalization('en-US');
      const frResult = localizationService.getLocalization('fr-FR');

      expect(enResult?.texts?.welcome?.message).toBe('Welcome');
      expect(frResult?.texts?.welcome?.message).toBe('Bienvenue');
    });
  });

  describe('getLocalizationSection', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should return specific section for existing locale', () => {
      const textsSection = localizationService.getLocalizationSection('en-US', 'texts');
      const errorsSection = localizationService.getLocalizationSection('en-US', 'errors');

      expect(textsSection).toEqual(testLocalization['en-US'].texts);
      expect(errorsSection).toEqual(testLocalization['en-US'].errors);
    });

    it('should return undefined for non-existing locale', () => {
      const result = localizationService.getLocalizationSection('es-ES', 'texts');

      expect(result).toBeUndefined();
    });

    it('should handle different locales and sections', () => {
      const enErrors = localizationService.getLocalizationSection('en-US', 'errors');
      const frErrors = localizationService.getLocalizationSection('fr-FR', 'errors');

      expect(enErrors?.notFound?.message).toBe('Not found');
      expect(frErrors?.notFound?.message).toBe('Non trouvé');
    });
  });

  describe('socket event handlers', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    describe('onSocketLocaleAdded', () => {
      it('should add new locale and emit localesUpdated event', () => {
        const newLocale: Locale = {
          code: 'es-ES',
          name: 'Español',
          iconUrl: 'https://example.com/es.png',
          enabled: true,
          order: 4,
        };
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketLocaleAdded', { locale: newLocale, timestamp: Date.now() });

        const locales = localizationService.getLocales();
        expect(locales).toHaveLength(3);
        expect(locales.find((l) => l.code === 'es-ES')).toEqual(newLocale);
        expect(emitSpy).toHaveBeenCalledWith('localesUpdated', { locales });
      });

      it('should not add locale if it already exists', () => {
        const existingLocale = { ...testLocales[0] };
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketLocaleAdded', {
          locale: existingLocale,
          timestamp: Date.now(),
        });

        const locales = localizationService.getLocales();
        expect(locales).toHaveLength(2); // Should still be 2
        expect(emitSpy).toHaveBeenCalledTimes(1); // Only the original emit
      });
    });

    describe('onSocketLocaleEnabled', () => {
      it('should update locale enabled state and emit localesUpdated event', () => {
        const updatedLocale: Locale = { ...testLocales[2], enabled: true };
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketLocaleEnabled', {
          locale: updatedLocale,
          timestamp: Date.now(),
        });

        const locales = localizationService.getLocales();
        const deLocale = locales.find((l) => l.code === 'de-DE');

        expect(deLocale?.enabled).toBe(true);
        expect(emitSpy).toHaveBeenCalledWith('localesUpdated', { locales });
      });
    });

    describe('onSocketLocaleDisabled', () => {
      it('should update locale disabled state and emit localesUpdated event', () => {
        const updatedLocale: Locale = { ...testLocales[0], enabled: false };
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketLocaleDisabled', {
          locale: updatedLocale,
          timestamp: Date.now(),
        });

        const locales = localizationService.getLocales();
        const enLocale = locales.find((l) => l.code === 'en-US');

        expect(enLocale?.enabled).toBe(false);
        expect(emitSpy).toHaveBeenCalledWith('localesUpdated', { locales });
      });
    });

    describe('onSocketLocalizationUpdated', () => {
      it('should refresh localization and emit localizationUpdated event', async () => {
        const updatedLocalization: Localization = {
          ...testLocalization,
          'en-US': {
            ...testLocalization['en-US'],
            texts: {
              ...testLocalization['en-US'].texts,
              welcome: {
                message: 'Hello',
                description: 'Updated welcome message',
                parameters: [],
              },
            },
          },
        };

        mockLocalizationApi.getLocalization.mockResolvedValue(updatedLocalization);
        const emitSpy = jest.spyOn(mockEventEmitter, 'emit');

        mockEventEmitter.emit('socketLocalizationUpdated', { timestamp: Date.now() });

        // Wait for async handler
        await new Promise((resolve) => setTimeout(resolve, 10));

        const enLocalization = localizationService.getLocalization('en-US');
        expect(enLocalization?.texts?.welcome?.message).toBe('Hello');
        expect(emitSpy).toHaveBeenCalledWith('localizationUpdated', {
          localization: updatedLocalization,
        });
      });
    });
  });

  describe('translateExpression', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should translate expression with parameters', () => {
      const result = localizationService.translateExpression(
        'errors',
        'notFound',
        (error: ErrorTranslation) => error.message,
        { resource: 'user' },
        'en-US',
      );

      expect(result).toBe('Not found');
    });

    it('should translate expression from texts section', () => {
      const testLocalizationWithParams: Localization = {
        'en-US': {
          texts: {
            welcome: {
              message: 'Welcome ${username}!',
              description: 'Welcome message with username',
              parameters: [],
            },
          },
        },
      };

      mockLocalizationApi.getLocalization.mockResolvedValue(testLocalizationWithParams);
      localizationService['localization'] = testLocalizationWithParams;

      const result = localizationService.translateExpression(
        'texts',
        'welcome',
        (text: TextTranslation) => text.message,
        { username: 'John' },
        'en-US',
      );

      expect(result).toBe('Welcome John!');
    });

    it('should replace multiple parameters', () => {
      const testLocalizationWithMultipleParams: Localization = {
        'en-US': {
          errors: {
            userNotFound: {
              message: 'User ${username} with ID ${id} was not found',
              description: 'User not found error',
              parameters: [],
            },
          },
        },
      };

      mockLocalizationApi.getLocalization.mockResolvedValue(testLocalizationWithMultipleParams);
      localizationService['localization'] = testLocalizationWithMultipleParams;

      const result = localizationService.translateExpression(
        'errors',
        'userNotFound',
        (error: ErrorTranslation) => error.message,
        { username: 'john@example.com', id: '123' },
        'en-US',
      );

      expect(result).toBe('User john@example.com with ID 123 was not found');
    });

    it('should handle repeated placeholders', () => {
      const testLocalizationWithRepeatedParams: Localization = {
        'en-US': {
          texts: {
            repeat: {
              message: '${word} ${word} ${word}',
              description: 'Repeated word message',
              parameters: [],
            },
          },
        },
      };

      mockLocalizationApi.getLocalization.mockResolvedValue(testLocalizationWithRepeatedParams);
      localizationService['localization'] = testLocalizationWithRepeatedParams;

      const result = localizationService.translateExpression(
        'texts',
        'repeat',
        (text: TextTranslation) => text.message,
        { word: 'hello' },
        'en-US',
      );

      expect(result).toBe('hello hello hello');
    });

    it('should fallback to default locale if locale not found', () => {
      const result = localizationService.translateExpression(
        'errors',
        'notFound',
        (error: ErrorTranslation) => error.message,
        {},
        'non-existent',
      );

      // Should fallback to en-US and return the translated message
      expect(result).toBe('Not found');
    });

    it('should return key if section not found', () => {
      const result = localizationService.translateExpression(
        'blueprint' as const,
        'notFound',
        (item: { message: string }) => item.message,
        {},
        'en-US',
      );

      expect(result).toBe('notFound');
    });

    it('should return key if item not found', () => {
      const result = localizationService.translateExpression(
        'errors',
        'nonExistentKey',
        (error: ErrorTranslation) => error.message,
        {},
        'en-US',
      );

      expect(result).toBe('nonExistentKey');
    });

    it('should handle empty parameters', () => {
      const result = localizationService.translateExpression(
        'errors',
        'notFound',
        (error: ErrorTranslation) => error.message,
        {},
        'en-US',
      );

      expect(result).toBe('Not found');
    });

    it('should work with locale names section', () => {
      const result = localizationService.translateExpression(
        'locales',
        'fr-FR',
        (locale: DefaultNameTranslation) => locale.name,
        {},
        'en-US',
      );

      expect(result).toBe('French');
    });
  });

  describe('translateError', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should translate error message with parameters', () => {
      const testErrorLocalization: Localization = {
        'en-US': {
          errors: {
            SESSION_NOT_FOUND: {
              message: 'Session ${sessionId} could not be found',
              description: 'Session not found error',
              parameters: [],
            },
          },
        },
      };

      mockLocalizationApi.getLocalization.mockResolvedValue(testErrorLocalization);
      localizationService['localization'] = testErrorLocalization;

      const result = localizationService.translateError(
        'SESSION_NOT_FOUND',
        { sessionId: '12345' },
        'en-US',
      );

      expect(result).toBe('Session 12345 could not be found');
    });

    it('should translate error with multiple parameters', () => {
      const testErrorLocalization: Localization = {
        'en-US': {
          errors: {
            INVALID_CREDENTIALS: {
              message: 'Invalid credentials for user ${username} from IP ${ip}',
              description: 'Invalid credentials error',
              parameters: [],
            },
          },
        },
      };

      mockLocalizationApi.getLocalization.mockResolvedValue(testErrorLocalization);
      localizationService['localization'] = testErrorLocalization;

      const result = localizationService.translateError(
        'INVALID_CREDENTIALS',
        { username: 'john@example.com', ip: '192.168.1.1' },
        'en-US',
      );

      expect(result).toBe('Invalid credentials for user john@example.com from IP 192.168.1.1');
    });

    it('should use default locale when none specified', () => {
      const result = localizationService.translateError('notFound', { resource: 'user' });

      expect(result).toBe('Not found');
    });

    it('should return key when no localization available', () => {
      const emptyLocalization: Localization = {};

      mockLocalizationApi.getLocalization.mockResolvedValue(emptyLocalization);
      localizationService['localization'] = emptyLocalization;

      const result = localizationService.translateError(
        'notFound',
        { resource: 'utilisateur' },
        'es-ES',
      );

      // Should return key when no localization is available
      expect(result).toBe('notFound');
    });

    it('should return key when error not found', () => {
      const result = localizationService.translateError(
        'NON_EXISTENT_ERROR',
        { param: 'value' },
        'en-US',
      );

      expect(result).toBe('NON_EXISTENT_ERROR');
    });

    it('should handle empty parameter object', () => {
      const result = localizationService.translateError('unauthorized', {}, 'en-US');

      expect(result).toBe('Unauthorized');
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      await localizationService.init();
    });

    it('should maintain locales array integrity after updates', () => {
      const initialCount = localizationService.getLocales().length;

      // Add locale
      const newLocale: Locale = {
        code: 'es-ES',
        name: 'Español',
        iconUrl: 'https://example.com/es.png',
        enabled: true,
        order: 5,
      };
      mockEventEmitter.emit('socketLocaleAdded', { locale: newLocale, timestamp: Date.now() });

      expect(localizationService.getLocales()).toHaveLength(initialCount + 1);

      // Update existing locale
      const updatedLocale: Locale = { ...newLocale, enabled: false };
      mockEventEmitter.emit('socketLocaleDisabled', {
        locale: updatedLocale,
        timestamp: Date.now(),
      });

      expect(localizationService.getLocales()).toHaveLength(initialCount + 1); // Same count
      expect(localizationService.getLocale('es-ES')?.enabled).toBe(false);
    });

    it('should handle empty locales and localization correctly', async () => {
      mockLocaleApi.getLocales.mockResolvedValue([]);
      mockLocalizationApi.getLocalization.mockResolvedValue({});

      await localizationService['refreshLocales']();
      await localizationService['refreshLocalization']();

      expect(localizationService.getLocales()).toEqual([]);
      expect(localizationService.getLocalization('en-US')).toBeUndefined();
      expect(localizationService.getLocale('en-US')).toBeUndefined();
    });

    it('should handle partial localization data', async () => {
      const partialLocalization: Localization = {
        'en-US': {
          texts: {
            welcome: {
              message: 'Welcome',
              description: 'Welcome message',
              parameters: [],
            },
          },
        },
      };

      mockLocalizationApi.getLocalization.mockResolvedValue(partialLocalization);
      await localizationService['refreshLocalization']();

      const enLocalization = localizationService.getLocalization('en-US');
      expect(enLocalization?.texts?.welcome?.message).toBe('Welcome');
      expect(enLocalization?.errors).toBeUndefined();

      const textsSection = localizationService.getLocalizationSection('en-US', 'texts');
      const errorsSection = localizationService.getLocalizationSection('en-US', 'errors');

      expect(textsSection?.welcome?.message).toBe('Welcome');
      expect(errorsSection).toBeUndefined();
    });
  });
});
