import { describe, it, expect, vi, afterEach } from 'vitest';
import { Client } from 'discord.js';
import http from 'http';
import { startHealthcheckServer } from '../src/index';

describe('HTTP Health Check Server (Render / Cloud Keep-Alive)', () => {
  let server: http.Server | null = null;

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
  });

  it('returns null if port is not set or invalid', () => {
    const mockClient = {} as Client;
    const result = startHealthcheckServer(mockClient, undefined);
    expect(result).toBeNull();
  });

  it('starts an HTTP server on the specified port and responds to /health', async () => {
    const mockClient = {
      isReady: vi.fn().mockReturnValue(true),
      user: { tag: 'PropGuard#1234' },
    } as unknown as Client;

    server = startHealthcheckServer(mockClient, 0); // Port 0 assigns random available port
    expect(server).not.toBeNull();

    await new Promise<void>((resolve) => {
      server?.on('listening', () => resolve());
    });

    const addr = server?.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; bot: string };
    expect(body.status).toBe('healthy');
    expect(body.bot).toBe('PropGuard#1234');
  });

  it('returns 404 for unknown endpoints', async () => {
    const mockClient = {
      isReady: vi.fn().mockReturnValue(true),
      user: null,
    } as unknown as Client;

    server = startHealthcheckServer(mockClient, 0);

    await new Promise<void>((resolve) => {
      server?.on('listening', () => resolve());
    });

    const addr = server?.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/unknown-route`);
    expect(response.status).toBe(404);
  });
});

