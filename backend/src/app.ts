import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import gameRouter from './routes/game';
import { jwtCheck } from './middleware/auth';
import { openApiSpec } from './openapi';

export const app = express();

app.use(cors());
app.use(express.json());

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  swaggerOptions: {
    oauth2RedirectUrl: 'http://localhost:3000/api-docs/oauth2-redirect.html',
    oauth: {
      clientId: process.env.AUTH0_CLIENT_ID,
      additionalQueryStringParams: { audience: process.env.AUTH0_AUDIENCE },
      usePkceWithAuthorizationCodeGrant: true,
    },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
app.use('/games', jwtCheck, gameRouter);
