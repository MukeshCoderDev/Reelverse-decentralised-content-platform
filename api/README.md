# Reelverse18 Backend API

Backend services for the Reelverse18 decentralized adult content platform.

## Features

- **SIWE Authentication**: Sign-In with Ethereum integration
- **Content Access Control**: Multi-factor access verification (age, geo, entitlement)
- **Upload Pipeline**: Orchestrated content processing workflow
- **Payment Processing**: USDC and fiat payment integration
- **Age Verification**: KYC integration with Persona
- **Audit Logging**: Comprehensive audit trails for compliance
- **Real-time Updates**: WebSocket and Redis pub/sub support

## Architecture

The API is built with:
- **Express.js** with TypeScript
- **PostgreSQL** for persistent data
- **Redis** for caching and sessions
- **Ethers.js** for blockchain interactions
- **Winston** for structured logging

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Access to Polygon network

### Installation

1. Clone the repository and navigate to the API directory:
```bash
cd api
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`

5. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/v1/auth/siwe/nonce` - Generate SIWE nonce
- `POST /api/v1/auth/siwe/verify` - Verify SIWE signature
- `GET /api/v1/auth/session` - Get current session
- `POST /api/v1/auth/logout` - Logout user

### Content Access
- `GET /api/v1/content/:contentId/access` - Check content access
- `POST /api/v1/content/playback-token` - Generate playback token

### Upload Management
- `POST /api/v1/upload/request` - Request upload processing
- `GET /api/v1/upload/:provisionalId/status` - Get upload status

### Payment Processing
- `POST /api/v1/payment/checkout/usdc` - USDC payment
- `POST /api/v1/payment/checkout/fiat` - Fiat payment
- `POST /api/v1/payment/checkout/confirm` - Confirm payment

### Age Verification
- `GET /api/v1/age-verification/status` - Get verification status
- `POST /api/v1/age-verification/start` - Start verification

### Webhooks
- `POST /api/v1/webhooks/persona` - Persona KYC webhook
- `POST /api/v1/webhooks/ccbill` - CCBill payment webhook
- `POST /api/v1/webhooks/segpay` - Segpay payment webhook
- `POST /api/v1/webhooks/livepeer` - Livepeer transcoding webhook

## Database Schema

The API uses PostgreSQL with the following main tables:

- `users` - User profiles and verification status
- `content_sessions` - Playback session audit trail
- `moderation_queue` - Content moderation workflow
- `upload_tracking` - Upload processing status
- `payment_tracking` - Payment transaction records
- `age_verification_tracking` - KYC verification records
- `feature_flags` - Dynamic feature configuration
- `audit_logs` - Security and compliance audit trail

## Redis Usage

Redis is used for:
- Session management
- SIWE nonce storage
- Rate limiting
- Caching frequently accessed data
- Upload processing queues
- Real-time notifications
- Feature flag caching

## Security Features

- **Helmet.js** for security headers
- **CORS** configuration
- **Rate limiting** per IP and user
- **Input validation** with Joi
- **JWT** session management
- **Audit logging** for all sensitive operations
- **Error handling** without information leakage

## Monitoring and Logging

- **Winston** for structured logging
- **Morgan** for HTTP request logging
- **Health check** endpoint at `/health`
- **Performance metrics** collection
- **Error tracking** and alerting

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

### Environment Variables

Key environment variables (see `.env.example` for complete list):

- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3001)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `ETHEREUM_RPC_URL` - Blockchain RPC endpoint
- Contract addresses for all deployed contracts

### Testing

The API includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Support

```bash
# Build image
docker build -t reelverse-api .

# Run container
docker run -p 3001:3001 --env-file .env reelverse-api
```

### Environment Setup

1. Set up PostgreSQL database
2. Set up Redis instance
3. Configure environment variables
4. Run database migrations
5. Deploy to your hosting platform

## Integration with Frontend

The API is designed to work seamlessly with the existing Reelverse frontend:

- **CORS** configured for frontend origin
- **Session management** compatible with existing wallet integration
- **Error responses** in consistent format
- **Real-time updates** via WebSocket connections

## Contributing

1. Follow TypeScript and ESLint configurations
2. Write tests for new features
3. Update documentation
4. Follow semantic versioning

## License

MIT License - see LICENSE file for details