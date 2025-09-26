import { ApiTestServer } from '../../../../test/api-test-utils';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  describe('GET /health', () => {
    let testServer: ApiTestServer;
    let baseUrl: string;

    beforeEach(async () => {
      testServer = new ApiTestServer({
        gamemodeApiKeyHash: 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      });
      testServer.registerController(HealthController);
      await testServer.start();
      baseUrl = testServer.getUrl();
    });

    afterEach(async () => {
      await testServer.stop();
    });

    it('should return healthy status', async () => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
      });

      // Verify timestamp is valid ISO string
      expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
    });

    it('should be accessible without authentication', async () => {
      const response = await fetch(`${baseUrl}/health`);
      expect(response.status).toBe(200);
    });
  });
});
