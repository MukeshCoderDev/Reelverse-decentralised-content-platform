import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const router = Router();
const openApiSpecPath = path.resolve(__dirname, '../../../docs/api/openapi.yaml');

// Serve OpenAPI YAML file
router.get('/openapi.yaml', (req: Request, res: Response) => {
  try {
    if (fs.existsSync(openApiSpecPath)) {
      res.sendFile(openApiSpecPath);
    } else {
      logger.warn(`OpenAPI spec not found at ${openApiSpecPath}`);
      res.status(500).json({ error: 'spec_not_found', message: 'OpenAPI spec file not found on server.' });
    }
  } catch (error) {
    logger.error('Error serving OpenAPI spec:', error);
    res.status(500).json({ error: 'internal_server_error', message: 'Internal server error serving OpenAPI spec.' });
  }
});

// Serve Redoc documentation
router.get('/docs', (req: Request, res: Response) => {
  try {
    const redocHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reelverse API Documentation</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link
            href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700"
            rel="stylesheet"
          />
          <style>
            body {
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          <redoc spec-url="/api/v1/openapi.yaml"></redoc>
          <script src="https://cdn.jsdelivr.net/npm/redoc@2.0.0-rc.55/bundles/redoc.standalone.js"></script>
        </body>
      </html>
    `;
    res.send(redocHtml);
  } catch (error) {
    logger.error('Error serving Redoc documentation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;