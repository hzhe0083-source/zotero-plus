import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { buildCitationKey, buildChildNoteTemplate, ensurePdfPath } from './lib.js';
import { ZoteroPlusService } from './zotero-client.js';

const service = new ZoteroPlusService({
  mcpUrl: process.env.ZOTERO_MCP_URL || 'http://127.0.0.1:23120/mcp',
  downloadDir: process.env.ZOTERO_PLUS_DOWNLOAD_DIR || '/tmp/zotero-plus-downloads'
});

const server = new Server(
  { name: 'zotero-plus-mcp', version: '0.2.0' },
  { capabilities: { tools: {} } }
);

const tools = [
  {
    name: 'updateItemFields',
    description: 'Update full Zotero metadata fields on an existing item via the running zotero-mcp HTTP server.',
    inputSchema: {
      type: 'object',
      properties: {
        itemKey: { type: 'string' },
        fields: { type: 'object', additionalProperties: true },
        creators: { type: 'array', items: { type: 'object', additionalProperties: true } }
      },
      required: ['itemKey', 'fields']
    }
  },
  {
    name: 'createItemWithMetadata',
    description: 'Create a new Zotero item with full metadata via the running zotero-mcp HTTP server.',
    inputSchema: {
      type: 'object',
      properties: {
        itemType: { type: 'string' },
        fields: { type: 'object', additionalProperties: true },
        creators: { type: 'array', items: { type: 'object', additionalProperties: true } },
        tags: { type: 'array', items: { type: 'string' } },
        attachmentKeys: { type: 'array', items: { type: 'string' } }
      },
      required: ['itemType']
    }
  },
  {
    name: 'downloadPdf',
    description: 'Download a PDF to local disk so it can be imported into Zotero manually or by a future bridge.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        outputPath: { type: 'string' },
        overwrite: { type: 'boolean' }
      },
      required: ['url']
    }
  },
  {
    name: 'importAttachment',
    description: 'Import a local PDF into Zotero and attach it to an existing item using the local connector plus re-parent workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        parentKey: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['filePath', 'parentKey']
    }
  },
  {
    name: 'buildCitationKey',
    description: 'Generate a citation key from creators/date/title.',
    inputSchema: {
      type: 'object',
      properties: {
        creators: { type: 'array', items: { type: 'object', additionalProperties: true } },
        date: { type: 'string' },
        title: { type: 'string' }
      },
      required: ['title']
    }
  },
  {
    name: 'buildChildNoteTemplate',
    description: 'Generate a child note template for a Zotero item.',
    inputSchema: {
      type: 'object',
      properties: {
        item: { type: 'object', additionalProperties: true }
      },
      required: ['item']
    }
  },
  {
    name: 'createChildNote',
    description: 'Create a child note under an existing Zotero parent item using the generated note template.',
    inputSchema: {
      type: 'object',
      properties: {
        parentKey: { type: 'string' },
        item: { type: 'object', additionalProperties: true },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['parentKey', 'item']
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === 'updateItemFields') {
    const result = await service.updateItemFields(args.itemKey, args.fields, args.creators);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  if (name === 'createItemWithMetadata') {
    const result = await service.createItemWithMetadata({
      itemType: args.itemType,
      fields: args.fields || {},
      creators: args.creators || [],
      tags: args.tags || [],
      attachmentKeys: args.attachmentKeys || []
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  if (name === 'downloadPdf') {
    const result = await service.downloadPdf({
      url: args.url,
      outputPath: args.outputPath || '',
      overwrite: Boolean(args.overwrite)
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  if (name === 'importAttachment') {
    const filePath = ensurePdfPath(args.filePath);
    const result = await service.importAttachment({
      filePath,
      parentKey: args.parentKey,
      title: args.title || 'Full Text PDF'
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  if (name === 'buildCitationKey') {
    const key = buildCitationKey(args);
    return { content: [{ type: 'text', text: key }] };
  }

  if (name === 'buildChildNoteTemplate') {
    const note = buildChildNoteTemplate(args.item || {});
    return { content: [{ type: 'text', text: note }] };
  }

  if (name === 'createChildNote') {
    const result = await service.createChildNote({
      parentKey: args.parentKey,
      item: args.item || {},
      tags: args.tags || []
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
