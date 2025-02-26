#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: string[];
  choices: {
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta: {
      role: string;
      content: string;
    };
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

class ResearcherServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'researcher-mcp',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Check if Perplexity API key is available
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityApiKey) {
      console.error('Perplexity API key found, Perplexity search will be available');
    } else {
      console.error('No Perplexity API key found, Perplexity search will not be available');
    }

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async searchGoogle(query: string): Promise<SearchResult[]> {
    try {
      const response = await this.axiosInstance.get(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`
      );

      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.g').each((_, element) => {
        const titleElement = $(element).find('h3');
        const urlElement = $(element).find('a');
        const snippetElement = $(element).find('.VwiC3b');

        if (titleElement.length && urlElement.length) {
          results.push({
            title: titleElement.text(),
            url: urlElement.attr('href') || '',
            snippet: snippetElement.text()
          });
        }
      });

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Google search error: ${error.message}`
        );
      }
      throw error;
    }
  }

  private async fetchWebPage(url: string): Promise<string> {
    try {
      const response = await this.axiosInstance.get(url);
      const $ = cheerio.load(response.data);

      // Remove script and style elements
      $('script').remove();
      $('style').remove();

      // Get text content
      return $('body').text().trim();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Web page fetch error: ${error.message}`
        );
      }
      throw error;
    }
  }

  private async searchPerplexity(query: string): Promise<PerplexityResponse> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new McpError(
        ErrorCode.InternalError,
        'Perplexity API key is not configured'
      );
    }

    try {
      const response = await axios.post(
        'https://api.perplexity.ai/chat/completions',
        {
          model: 'sonar',
          messages: [
            {
              role: 'system',
              content: 'Be precise and concise.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: 500,
          temperature: 0.2,
          top_p: 0.9,
          return_images: false,
          return_related_questions: false,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 1
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Perplexity API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: 'search',
          description: 'Search Google for information',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'fetch_page',
          description: 'Fetch and extract text content from a web page',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL of the web page to fetch'
              }
            },
            required: ['url']
          }
        }
      ];

      // Add Perplexity search tool if API key is available
      if (process.env.PERPLEXITY_API_KEY) {
        tools.push({
          name: 'perplexity_search',
          description: 'Search using Perplexity AI',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query'
              }
            },
            required: ['query']
          }
        });
      }

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search': {
          const { query } = request.params.arguments as { query: string };
          if (!query) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Search query is required'
            );
          }

          const results = await this.searchGoogle(query);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(results, null, 2)
              }
            ]
          };
        }

        case 'fetch_page': {
          const { url } = request.params.arguments as { url: string };
          if (!url) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'URL is required'
            );
          }

          const content = await this.fetchWebPage(url);
          return {
            content: [
              {
                type: 'text',
                text: content
              }
            ]
          };
        }

        case 'perplexity_search': {
          // Check if Perplexity API key is available
          if (!process.env.PERPLEXITY_API_KEY) {
            throw new McpError(
              ErrorCode.InternalError,
              'Perplexity API key is not configured'
            );
          }

          const { query } = request.params.arguments as { query: string };
          if (!query) {
            throw new McpError(
              ErrorCode.InvalidParams,
              'Search query is required'
            );
          }

          const result = await this.searchPerplexity(query);
          
          // Format the response with content and citations
          const content = result.choices[0]?.message.content || 'No results found';
          const citations = result.citations || [];
          
          const formattedResponse = {
            content,
            citations
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedResponse, null, 2)
              }
            ]
          };
        }

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Researcher MCP server running on stdio');
  }
}

const server = new ResearcherServer();
server.run().catch(console.error);
