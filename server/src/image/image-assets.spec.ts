import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { config } from '../config';
import { persistImageAssetsSafely } from './image-assets';

describe('image asset persistence', () => {
  const originalDataDir = config.DATA_DIR;
  let dataDir = '';
  const originalFetch = global.fetch;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hi-image-assets-'));
    config.DATA_DIR = dataDir;
  });

  afterEach(() => {
    config.DATA_DIR = originalDataDir;
    global.fetch = originalFetch;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('persists upstream image responses even when the content type is octet-stream', async () => {
    const pngBytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
    ]);
    global.fetch = jest.fn().mockResolvedValue(
      new Response(pngBytes, {
        status: 200,
        headers: { 'content-type': 'application/octet-stream' },
      }),
    ) as any;

    const result = await persistImageAssetsSafely([
      'https://chatgpt.com/backend-api/estuary/content?id=file_1',
    ]);

    expect(result.degraded).toBe(false);
    expect(result.urls).toEqual([expect.stringMatching(/^\/uploads\/.+\.png$/)]);
    expect(fs.existsSync(path.join(dataDir, result.urls[0].replace(/^\//, '')))).toBe(true);
  });
});
