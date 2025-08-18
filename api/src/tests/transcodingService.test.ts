/**
 * Transcoding Service Tests
 * Tests for Livepeer integration and webhook handling
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { transcodingService } from '../services/transcodingService';
import { eventBus } from '../core/eventBus';
import { metrics } from '../core/metrics';

// Mock external dependencies
jest.mock('axios');
jest.mock('../core/eventBus');
jest.mock('../core/metrics');
jest.mock('../core/observability');

describe('TranscodingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createJob', () => {
    it('should create a transcoding job successfully', async () => {
      const mockPublish = jest.fn().mockResolvedValue(undefined);
      (eventBus.publish as jest.Mock) = mockPublish;

      const mockStartTimer = jest.fn().mockReturnValue('timer-id');
      const mockEndTimer = jest.fn();
      const mockCounter = jest.fn();
      (metrics.startTimer as jest.Mock) = mockStartTimer;
      (metrics.endTimer as jest.Mock) = mockEndTimer;
      (metrics.counter as jest.Mock) = mockCounter;

      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100, // 100MB
        'org-123',
        'creator-123'
      );

      expect(jobId).toBeDefined();
      expect(jobId).toMatch(/^transcode_\d+_/);
      expect(mockStartTimer).toHaveBeenCalledWith('transcoding_job_creation', {
        organizationId: 'org-123',
        contentId: 'content-1'
      });
      expect(mockEndTimer).toHaveBeenCalledWith('timer-id', true);
      expect(mockCounter).toHaveBeenCalledWith('transcoding_jobs_created_total', 1, {
        organizationId: 'org-123',
        profileCount: expect.any(String)
      });
      expect(mockPublish).toHaveBeenCalledWith({
        type: 'transcode.started',
        version: '1.0',
        correlationId: expect.stringMatching(/^transcode-/),
        payload: expect.objectContaining({
          jobId,
          contentId: 'content-123',
          organizationId: 'org-123',
          creatorId: 'creator-123'
        }),
        metadata: expect.objectContaining({
          source: 'transcoding-service',
          userId: 'creator-123',
          organizationId: 'org-123',
          contentId: 'content-123'
        })
      });
    });

    it('should throw error for missing required parameters', async () => {
      await expect(
        transcodingService.createJob('', 'url', 1000, 'org', 'creator')
      ).rejects.toThrow('Missing required parameters for transcoding job');
    });
  });

  describe('getJobStatus', () => {
    it('should return null for non-existent job', () => {
      const status = transcodingService.getJobStatus('non-existent-job');
      expect(status).toBeNull();
    });

    it('should return job status for existing job', async () => {
      // First create a job
      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100,
        'org-123',
        'creator-123'
      );

      const status = transcodingService.getJobStatus(jobId);
      expect(status).toEqual({
        jobId,
        status: 'processing',
        progress: 50,
        renditions: [],
        error: undefined,
        estimatedCompletion: undefined
      });
    });
  });

  describe('handleWebhook', () => {
    it('should handle asset.ready webhook successfully', async () => {
      // Create a job first
      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100,
        'org-123',
        'creator-123'
      );

      const mockWebhook = {
        id: 'webhook-123',
        type: 'asset.ready' as const,
        timestamp: Math.floor(Date.now() / 1000),
        payload: {
          asset: {
            id: 'asset-123',
            name: 'content-123',
            status: {
              phase: 'ready' as const,
              updatedAt: Date.now()
            },
            playbackUrl: 'https://livepeer.studio/hls/asset-123/index.m3u8',
            videoSpec: {
              format: 'mp4',
              duration: 120,
              bitrate: 2000000,
              width: 1920,
              height: 1080,
              fps: 30
            }
          }
        }
      };

      const mockSignature = 'valid-signature';
      
      // Mock signature verification to return true
      const originalVerify = (transcodingService as any).verifyWebhookSignature;
      (transcodingService as any).verifyWebhookSignature = jest.fn().mockReturnValue(true);

      await expect(
        transcodingService.handleWebhook(mockWebhook, mockSignature, jobId)
      ).resolves.not.toThrow();

      // Restore original method
      (transcodingService as any).verifyWebhookSignature = originalVerify;
    });

    it('should reject webhook with invalid signature', async () => {
      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100,
        'org-123',
        'creator-123'
      );

      const mockWebhook = {
        id: 'webhook-123',
        type: 'asset.ready' as const,
        timestamp: Math.floor(Date.now() / 1000),
        payload: {
          asset: {
            id: 'asset-123',
            name: 'content-123',
            status: {
              phase: 'ready' as const,
              updatedAt: Date.now()
            }
          }
        }
      };

      const invalidSignature = 'invalid-signature';

      await expect(
        transcodingService.handleWebhook(mockWebhook, invalidSignature, jobId)
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should reject old webhook timestamps', async () => {
      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100,
        'org-123',
        'creator-123'
      );

      const oldTimestamp = Math.floor((Date.now() - 600000) / 1000); // 10 minutes ago
      const mockWebhook = {
        id: 'webhook-123',
        type: 'asset.ready' as const,
        timestamp: oldTimestamp,
        payload: {
          asset: {
            id: 'asset-123',
            name: 'content-123',
            status: {
              phase: 'ready' as const,
              updatedAt: Date.now()
            }
          }
        }
      };

      const mockSignature = 'valid-signature';
      
      // Mock signature verification to return true
      (transcodingService as any).verifyWebhookSignature = jest.fn().mockReturnValue(true);

      await expect(
        transcodingService.handleWebhook(mockWebhook, mockSignature, jobId)
      ).rejects.toThrow('Webhook timestamp too old, possible replay attack');
    });
  });

  describe('retryJob', () => {
    it('should throw error for non-existent job', async () => {
      await expect(
        transcodingService.retryJob('non-existent-job')
      ).rejects.toThrow('Job non-existent-job not found');
    });

    it('should throw error for job not in failed state', async () => {
      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100,
        'org-123',
        'creator-123'
      );

      await expect(
        transcodingService.retryJob(jobId)
      ).rejects.toThrow(`Job ${jobId} is not in failed state`);
    });
  });

  describe('cancelJob', () => {
    it('should cancel job successfully', async () => {
      const jobId = await transcodingService.createJob(
        'content-123',
        'https://example.com/video.mp4',
        1024 * 1024 * 100,
        'org-123',
        'creator-123'
      );

      await expect(
        transcodingService.cancelJob(jobId, 'Test cancellation')
      ).resolves.not.toThrow();

      const status = transcodingService.getJobStatus(jobId);
      expect(status?.status).toBe('cancelled');
      expect(status?.error).toBe('Test cancellation');
    });

    it('should handle cancellation of non-existent job gracefully', async () => {
      await expect(
        transcodingService.cancelJob('non-existent-job', 'Test')
      ).resolves.not.toThrow();
    });
  });
});