import { Client, APIErrorCode } from '@notionhq/client';
import { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
const { RateLimiter } = require('limiter');
import { logger } from '../utils/logger';

// Type declaration for limiter
interface RateLimiterInterface {
  removeTokens(count: number): Promise<void>;
  getTokensRemaining(): number;
}

// Types for Notion integration
export interface NotionConfig {
  apiKey: string;
  databaseId?: string;
}

export interface TranscriptPageData {
  title: string;
  content: string;
  videoId: string;
  videoFilename: string;
  duration?: number;
  confidence?: number;
  language?: string;
  uploadDate: Date;
  transcriptionDate: Date;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  pageId?: string;
  pageUrl?: string;
  error?: string;
  duplicate?: boolean;
}

export class NotionService {
  private client: Client;
  private rateLimiter: RateLimiterInterface;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = config;
    this.client = new Client({
      auth: config.apiKey,
    });

    // Notion API rate limit: 3 requests per second
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 3,
      interval: 'second'
    });

    logger.info('NotionService initialized');
  }

  /**
   * Test the connection to Notion API
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.rateLimiter.removeTokens(1);
      const response = await this.client.users.me();
      
      logger.info('Notion connection test successful', { 
        userId: response.id,
        userName: response.name 
      });
      
      return { success: true };
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Notion connection test failed', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Search for databases accessible to the integration
   */
  async searchDatabases(query?: string): Promise<NotionDatabase[]> {
    try {
      await this.rateLimiter.removeTokens(1);
      
      const response = await this.client.search({
        filter: {
          value: 'database',
          property: 'object'
        },
        query: query || undefined,
        page_size: 100
      });

      const databases = response.results
        .filter((result): result is any => result.object === 'database')
        .map((db: any) => ({
          id: db.id,
          title: this.extractDatabaseTitle(db),
          url: db.url,
          properties: db.properties
        }));

      logger.info('Found accessible databases', { count: databases.length });
      return databases;
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Failed to search databases', { error: errorMessage });
      throw new Error(`Failed to search databases: ${errorMessage}`);
    }
  }

  /**
   * Get database information by ID
   */
  async getDatabase(databaseId: string): Promise<NotionDatabase | null> {
    try {
      await this.rateLimiter.removeTokens(1);
      
      const response = await this.client.databases.retrieve({
        database_id: databaseId
      });

      return {
        id: response.id,
        title: this.extractDatabaseTitle(response),
        url: response.url,
        properties: response.properties
      };
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Failed to get database', { databaseId, error: errorMessage });
      return null;
    }
  }

  /**
   * Create a new database for transcript storage
   */
  async createTranscriptDatabase(
    parentPageId: string, 
    title: string = 'Video Transcripts'
  ): Promise<NotionDatabase> {
    try {
      await this.rateLimiter.removeTokens(1);
      
      const response = await this.client.databases.create({
        parent: {
          type: 'page_id',
          page_id: parentPageId
        },
        title: [
          {
            type: 'text',
            text: {
              content: title
            }
          }
        ],
        properties: {
          'Title': {
            title: {}
          },
          'Video File': {
            rich_text: {}
          },
          'Duration': {
            number: {
              format: 'number'
            }
          },
          'Confidence': {
            number: {
              format: 'percent'
            }
          },
          'Language': {
            select: {
              options: [
                { name: 'English', color: 'blue' },
                { name: 'Spanish', color: 'green' },
                { name: 'French', color: 'yellow' },
                { name: 'German', color: 'orange' },
                { name: 'Other', color: 'gray' }
              ]
            }
          },
          'Upload Date': {
            date: {}
          },
          'Transcription Date': {
            date: {}
          },
          'Video ID': {
            rich_text: {}
          },
          'Status': {
            select: {
              options: [
                { name: 'Synced', color: 'green' },
                { name: 'Updated', color: 'blue' },
                { name: 'Error', color: 'red' }
              ]
            }
          }
        }
      });

      const database = {
        id: response.id,
        title: this.extractDatabaseTitle(response),
        url: response.url,
        properties: response.properties
      };

      logger.info('Created transcript database', { 
        databaseId: database.id,
        title: database.title 
      });

      return database;
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Failed to create database', { error: errorMessage });
      throw new Error(`Failed to create database: ${errorMessage}`);
    }
  }

  /**
   * Check if a transcript already exists in the database
   */
  async findExistingTranscript(
    databaseId: string, 
    videoId: string
  ): Promise<{ exists: boolean; pageId?: string }> {
    try {
      await this.rateLimiter.removeTokens(1);
      
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: {
          property: 'Video ID',
          rich_text: {
            equals: videoId
          }
        }
      });

      if (response.results.length > 0) {
        return {
          exists: true,
          pageId: response.results[0].id
        };
      }

      return { exists: false };
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Failed to check existing transcript', { 
        videoId, 
        error: errorMessage 
      });
      return { exists: false };
    }
  }

  /**
   * Create a transcript page in Notion
   */
  async createTranscriptPage(
    databaseId: string,
    transcriptData: TranscriptPageData
  ): Promise<SyncResult> {
    try {
      // Check for existing transcript
      const existing = await this.findExistingTranscript(databaseId, transcriptData.videoId);
      if (existing.exists) {
        logger.info('Transcript already exists, updating instead', { 
          videoId: transcriptData.videoId,
          pageId: existing.pageId 
        });
        return this.updateTranscriptPage(existing.pageId!, transcriptData);
      }

      await this.rateLimiter.removeTokens(1);

      // Create page content
      const pageContent = this.buildPageContent(transcriptData);
      
      const createParams: CreatePageParameters = {
        parent: {
          database_id: databaseId
        },
        properties: {
          'Title': {
            title: [
              {
                text: {
                  content: transcriptData.title
                }
              }
            ]
          },
          'Video File': {
            rich_text: [
              {
                text: {
                  content: transcriptData.videoFilename
                }
              }
            ]
          },
          'Duration': transcriptData.duration ? {
            number: Math.round(transcriptData.duration)
          } : undefined,
          'Confidence': transcriptData.confidence ? {
            number: transcriptData.confidence / 100 // Convert to percentage
          } : undefined,
          'Language': transcriptData.language ? {
            select: {
              name: this.capitalizeFirst(transcriptData.language)
            }
          } : undefined,
          'Upload Date': {
            date: {
              start: transcriptData.uploadDate.toISOString().split('T')[0]
            }
          },
          'Transcription Date': {
            date: {
              start: transcriptData.transcriptionDate.toISOString().split('T')[0]
            }
          },
          'Video ID': {
            rich_text: [
              {
                text: {
                  content: transcriptData.videoId
                }
              }
            ]
          },
          'Status': {
            select: {
              name: 'Synced'
            }
          }
        },
        children: pageContent
      };

      // Remove undefined properties
      Object.keys(createParams.properties).forEach(key => {
        if (createParams.properties[key] === undefined) {
          delete createParams.properties[key];
        }
      });

      const response = await this.client.pages.create(createParams);

      logger.info('Created transcript page in Notion', { 
        pageId: response.id,
        videoId: transcriptData.videoId 
      });

      return {
        success: true,
        pageId: response.id,
        pageUrl: response.url,
        duplicate: false
      };
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Failed to create transcript page', { 
        videoId: transcriptData.videoId,
        error: errorMessage 
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Update an existing transcript page
   */
  private async updateTranscriptPage(
    pageId: string,
    transcriptData: TranscriptPageData
  ): Promise<SyncResult> {
    try {
      await this.rateLimiter.removeTokens(1);

      // Update page properties
      await this.client.pages.update({
        page_id: pageId,
        properties: {
          'Title': {
            title: [
              {
                text: {
                  content: transcriptData.title
                }
              }
            ]
          },
          'Transcription Date': {
            date: {
              start: transcriptData.transcriptionDate.toISOString().split('T')[0]
            }
          },
          'Status': {
            select: {
              name: 'Updated'
            }
          }
        }
      });

      // Replace page content with updated transcript
      await this.rateLimiter.removeTokens(1);
      const pageContent = this.buildPageContent(transcriptData);
      
      // Get existing blocks and delete them
      const blocks = await this.client.blocks.children.list({
        block_id: pageId
      });

      // Delete existing blocks in batches
      if (blocks.results.length > 0) {
        await this.rateLimiter.removeTokens(1);
        for (const block of blocks.results) {
          await this.client.blocks.delete({
            block_id: block.id
          });
        }
      }

      // Add new content
      await this.rateLimiter.removeTokens(1);
      await this.client.blocks.children.append({
        block_id: pageId,
        children: pageContent
      });

      logger.info('Updated transcript page in Notion', { 
        pageId,
        videoId: transcriptData.videoId 
      });

      return {
        success: true,
        pageId,
        duplicate: true
      };
    } catch (error) {
      const errorMessage = this.handleNotionError(error);
      logger.error('Failed to update transcript page', { 
        pageId,
        videoId: transcriptData.videoId,
        error: errorMessage 
      });
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Build the page content blocks for a transcript
   */
  private buildPageContent(transcriptData: TranscriptPageData): any[] {
    const content = [];

    // Add metadata header
    content.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Video Information'
            }
          }
        ]
      }
    });

    // Add video details
    const details = [
      `**File:** ${transcriptData.videoFilename}`,
      `**Video ID:** ${transcriptData.videoId}`,
      `**Upload Date:** ${transcriptData.uploadDate.toLocaleDateString()}`,
      `**Transcription Date:** ${transcriptData.transcriptionDate.toLocaleDateString()}`
    ];

    if (transcriptData.duration) {
      details.push(`**Duration:** ${Math.round(transcriptData.duration)} seconds`);
    }
    if (transcriptData.confidence) {
      details.push(`**Confidence:** ${(transcriptData.confidence * 100).toFixed(1)}%`);
    }
    if (transcriptData.language) {
      details.push(`**Language:** ${this.capitalizeFirst(transcriptData.language)}`);
    }

    content.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: details.join('\n')
            }
          }
        ]
      }
    });

    // Add transcript header
    content.push({
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'Transcript'
            }
          }
        ]
      }
    });

    // Split transcript into chunks (Notion has a 2000 character limit per text block)
    const transcriptChunks = this.chunkText(transcriptData.content, 1900);
    
    for (const chunk of transcriptChunks) {
      content.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: chunk
              }
            }
          ]
        }
      });
    }

    return content;
  }

  /**
   * Extract database title from Notion database object
   */
  private extractDatabaseTitle(database: any): string {
    if (database.title && database.title.length > 0) {
      return database.title[0].plain_text || database.title[0].text?.content || 'Untitled Database';
    }
    return 'Untitled Database';
  }

  /**
   * Handle Notion API errors with user-friendly messages
   */
  private handleNotionError(error: any): string {
    if (error?.code === APIErrorCode.ObjectNotFound) {
      return 'Database or page not found. Please check your permissions.';
    }
    if (error?.code === APIErrorCode.Unauthorized) {
      return 'Invalid Notion API key or insufficient permissions.';
    }
    if (error?.code === APIErrorCode.RateLimited) {
      return 'Too many requests. Please try again in a moment.';
    }
    if (error?.code === APIErrorCode.InvalidJSON) {
      return 'Invalid data format sent to Notion.';
    }
    if (error?.code === APIErrorCode.ValidationError) {
      return `Validation error: ${error.message}`;
    }
    
    return error?.message || 'Unknown Notion API error occurred';
  }

  /**
   * Split text into chunks respecting word boundaries
   */
  private chunkText(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks = [];
    let currentChunk = '';
    const words = text.split(' ');

    for (const word of words) {
      if ((currentChunk + word).length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = word + ' ';
        } else {
          // Word is longer than maxLength, split it
          chunks.push(word);
        }
      } else {
        currentChunk += word + ' ';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Get rate limiter status for monitoring
   */
  getRateLimiterStatus(): { tokensRemaining: number } {
    return {
      tokensRemaining: this.rateLimiter.getTokensRemaining()
    };
  }
}