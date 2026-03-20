export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Chess API',
    version: '1.0.0',
    description:
      'REST API for a browser-based chess game. All endpoints require an Auth0 JWT.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  components: {
    securitySchemes: {
      auth0: {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: `https://${process.env.AUTH0_DOMAIN}/authorize`,
            tokenUrl: `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
            scopes: { openid: 'OpenID Connect', profile: 'Profile', email: 'Email' },
          },
        },
      },
    },
    schemas: {
      GameSummary: {
        type: 'object',
        properties: {
          gameId:        { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
          status:        { type: 'string', enum: ['active', 'check', 'checkmate', 'stalemate', 'draw', 'resigned'] },
          mode:          { type: 'string', enum: ['pvp', 'vs_computer'] },
          computerLevel: { type: 'integer', nullable: true, minimum: 1, maximum: 10 },
          moveCount:     { type: 'integer' },
          createdAt:     { type: 'string', format: 'date-time' },
        },
      },
      GameState: {
        type: 'object',
        properties: {
          gameId:        { type: 'string' },
          fen:           { type: 'string', example: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
          turn:          { type: 'string', enum: ['w', 'b'] },
          status:        { type: 'string', enum: ['active', 'check', 'checkmate', 'stalemate', 'draw', 'resigned'] },
          mode:          { type: 'string', enum: ['pvp', 'vs_computer'] },
          computerLevel: { type: 'integer', nullable: true },
          moves:         { type: 'array', items: { $ref: '#/components/schemas/MoveRecord' } },
        },
      },
      MoveRecord: {
        type: 'object',
        properties: {
          from:       { type: 'string', example: 'e2' },
          to:         { type: 'string', example: 'e4' },
          san:        { type: 'string', example: 'e4' },
          fenAfter:   { type: 'string' },
          moveNumber: { type: 'integer' },
          playedAt:   { type: 'string', format: 'date-time' },
        },
      },
      MoveResult: {
        type: 'object',
        properties: {
          fen:    { type: 'string' },
          turn:   { type: 'string', enum: ['w', 'b'] },
          status: { type: 'string', enum: ['active', 'check', 'checkmate', 'stalemate', 'draw', 'resigned'] },
          move:   { $ref: '#/components/schemas/MoveRecord' },
          computerMove: {
            nullable: true,
            allOf: [{ $ref: '#/components/schemas/MoveRecord' }],
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
  security: [{ auth0: [] }],
  paths: {
    '/games': {
      get: {
        summary: 'List games',
        description: "Returns the authenticated user's games, most recent first.",
        responses: {
          '200': {
            description: 'Array of game summaries',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/GameSummary' } },
              },
            },
          },
          '401': { description: 'Missing or invalid JWT' },
        },
      },
      post: {
        summary: 'Create a new game',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['mode'],
                properties: {
                  mode:          { type: 'string', enum: ['pvp', 'vs_computer'] },
                  computerLevel: { type: 'integer', minimum: 1, maximum: 10, example: 5 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Game created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GameState' } },
            },
          },
          '401': { description: 'Missing or invalid JWT' },
        },
      },
    },
    '/games/{gameId}': {
      parameters: [
        { name: 'gameId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      get: {
        summary: 'Get game state',
        description: 'Returns current FEN, status, and full move history.',
        responses: {
          '200': {
            description: 'Game state',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GameState' } },
            },
          },
          '401': { description: 'Missing or invalid JWT' },
          '404': { description: 'Game not found or belongs to another user' },
        },
      },
      delete: {
        summary: 'Resign a game',
        description: 'Sets game status to "resigned".',
        responses: {
          '204': { description: 'Resigned successfully' },
          '401': { description: 'Missing or invalid JWT' },
          '404': { description: 'Game not found' },
        },
      },
    },
    '/games/{gameId}/moves': {
      parameters: [
        { name: 'gameId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      post: {
        summary: 'Submit a move',
        description:
          'Applies the player move. In vs_computer mode also applies the computer reply and returns both moves.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['from', 'to'],
                properties: {
                  from: { type: 'string', example: 'e2' },
                  to:   { type: 'string', example: 'e4' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Move result',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MoveResult' } },
            },
          },
          '400': { description: 'Illegal move or missing fields' },
          '401': { description: 'Missing or invalid JWT' },
          '404': { description: 'Game not found' },
        },
      },
    },
  },
};
