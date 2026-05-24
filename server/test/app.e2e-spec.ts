import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

describe('App e2e', () => {
  let app: INestApplication<App>;
  let sqliteFile = '';

  beforeAll(async () => {
    sqliteFile = path.join(os.tmpdir(), `hi-image-studio-e2e-${Date.now()}.db`);
    process.env.SQLITE_FILE = sqliteFile;
    process.env.SESSION_SECRET = 'test-session-secret';

    const { AppModule } = require('../src/app.module');
    const { ApiExceptionFilter } = require('../src/filters/api-exception.filter');
    const { ApiResponseInterceptor } = require(
      '../src/interceptors/api-response.interceptor',
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
    for (const filePath of [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`]) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('returns public settings', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/settings/public')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        code: 200,
        msg: 'ok',
        data: expect.objectContaining({
          siteName: expect.any(String),
          allowRegistration: expect.any(Boolean),
        }),
      }),
    );
  });
});
