# ChargeBD - EV Charger Locator & Reservation Portal

A comprehensive Electric Vehicle (EV) charging station locator and reservation portal for Bangladesh, built with the MERN stack and modern technologies.

## 🚀 Features

### Core Features
- **Interactive Map**: Real-time EV charging station locations with clustering and filters
- **Station Search**: Find stations by location, connector type, power rating, and availability
- **Reservation System**: Book charging slots with QR/OTP verification
- **Live Session Monitoring**: Real-time charging session tracking and cost calculation
- **Multiple Payment Gateways**: SSLCOMMERZ and bKash integration with webhook handling
- **Route Planning**: Multi-stop route optimization with charging waypoints
- **User Management**: Role-based access (User, Operator, Admin)
- **Review System**: Station ratings and photo reviews

### Technical Features
- **Real-time Updates**: Socket.IO for live station status and session monitoring
- **Geospatial Search**: MongoDB 2dsphere indexes for location-based queries
- **Background Jobs**: BullMQ with Redis for async processing
- **File Upload**: AWS S3 integration for station photos
- **Rate Limiting**: API protection with express-rate-limit
- **Comprehensive Testing**: Unit, integration, and E2E tests
- **Docker Support**: Full containerization for development and production

## 🏗️ Architecture

### Monorepo Structure
```
AmarEV/
├── Client/                 # React frontend
├── Server/                 # Express API backend
├── packages/
│   └── shared/            # Shared types and utilities
├── docker-compose.yml     # Development environment
└── README.md
```

### Tech Stack

#### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **TailwindCSS** for styling
- **React Query** for server state management
- **Redux Toolkit** for client state
- **React Leaflet** for interactive maps
- **Socket.IO Client** for real-time features

#### Backend
- **Node.js 20** with TypeScript
- **Express.js** web framework
- **MongoDB** with Mongoose ODM
- **Redis** for caching and sessions
- **Socket.IO** for real-time communication
- **JWT** authentication
- **Zod** for validation
- **Winston** for logging
- **BullMQ** for background jobs

#### External Services
- **MongoDB Atlas** for database hosting
- **OpenRouteService** for route planning
- **SSLCOMMERZ** payment gateway
- **bKash** mobile payment
- **AWS S3** for file storage

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 20+
- npm 9+
- MongoDB (local or Atlas)
- Redis
- Docker & Docker Compose (optional)

### Environment Variables
Copy the example environment files and configure them:

```bash
# Root level
cp .env.example .env

# Server
cp Server/.env.example Server/.env

# Client
cp Client/.env.example Client/.env
```

### Option 1: Docker Development Environment

```bash
# Clone the repository
git clone <repository-url>
cd AmarEV

# Start all services
docker-compose up -d

# Install dependencies
npm install

# Build shared package
npm run build --workspace=packages/shared

# Start development servers
npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: mongodb://localhost:27017
- Redis: redis://localhost:6379

### Option 2: Manual Setup

1. **Install dependencies**
```bash
npm install
```

2. **Build shared package**
```bash
npm run build --workspace=packages/shared
```

3. **Setup MongoDB**
   - Local: Install MongoDB and start the service
   - Atlas: Create cluster and get connection string

4. **Setup Redis**
   - Local: Install Redis and start the service
   - Cloud: Use Redis Cloud or AWS ElastiCache

5. **Configure environment variables**
   Update the `.env` files with your database URLs and API keys

6. **Start development servers**
```bash
npm run dev
```

## 📋 API Documentation

### Authentication Endpoints
```http
POST /api/auth/register       # User registration
POST /api/auth/login          # User login
POST /api/auth/refresh        # Refresh access token
POST /api/auth/logout         # User logout
GET  /api/auth/profile        # Get user profile
```

### Station Endpoints
```http
GET    /api/stations          # Search stations with filters
GET    /api/stations/:id      # Get station details
POST   /api/stations          # Create station (operator/admin)
PATCH  /api/stations/:id      # Update station (operator/admin)
GET    /api/stations/:id/status # Get real-time station status
```

### Reservation Endpoints
```http
GET    /api/reservations      # Get user reservations
POST   /api/reservations      # Create reservation
PATCH  /api/reservations/:id/cancel # Cancel reservation
POST   /api/reservations/:id/checkin # Check in to station
```

### Payment Endpoints
```http
POST /api/payments/intent     # Create payment intent
POST /api/payments/confirm    # Confirm payment
POST /api/payments/ipn/sslcommerz # SSLCOMMERZ webhook
POST /api/payments/ipn/bkash  # bKash webhook
```

### Route Planning
```http
POST /api/routes/plan         # Plan route with charging stops
```

## 🔌 WebSocket Events

### Client to Server
- `join_station:{stationId}` - Subscribe to station updates
- `subscribe_user` - Subscribe to user-specific updates

### Server to Client
- `station.status` - Real-time station availability
- `reservation.updated` - Reservation status changes
- `session.updated` - Charging session updates

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Backend tests
```bash
npm run test --workspace=Server
```

### Frontend tests
```bash
npm run test --workspace=Client
```

### E2E tests
```bash
npm run test:e2e --workspace=Client
```

## 🐳 Production Deployment

### Docker Production Build
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy with production settings
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Variables for Production
Make sure to update these for production:
- `JWT_SECRET` and `JWT_REFRESH_SECRET`
- `MONGO_URI` (Atlas production cluster)
- `REDIS_URL` (production Redis instance)
- `SSLZ_SANDBOX=false` and `BKASH_SANDBOX=false`
- Update payment gateway credentials
- Configure proper CORS origins

## 📊 Database Schema

### Key Collections
- **users**: User accounts and profiles
- **stations**: Charging station information
- **connectors**: Individual charging points
- **reservations**: Booking records
- **sessions**: Charging session data
- **payments**: Payment transactions
- **reviews**: Station reviews and ratings

### Indexes
- Geospatial: `stations.location` (2dsphere)
- User queries: Compound indexes on frequently searched fields
- Performance: Strategic indexes for common query patterns

## 🔐 Security Features

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Rate limiting on API endpoints
- CORS protection
- Helmet.js security headers
- Input validation with Zod
- Password hashing with bcrypt
- HTTPS enforcement in production

## 🌍 Localization

The application supports:
- **English** (en) - Default
- **Bengali** (bn) - বাংলা

Language can be selected during registration or updated in user profile.

## 📱 Mobile Responsiveness

The application is fully responsive and optimized for:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🚀 Performance Optimizations

- Code splitting with Vite
- Image optimization and lazy loading
- React Query caching
- Redis caching for API responses
- Database query optimization
- CDN integration for static assets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow conventional commit messages
- Ensure code passes linting and formatting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@chargebd.com or join our community Discord.

## 🙏 Acknowledgments

- OpenRouteService for routing API
- React Leaflet community
- Bangladesh EV community
- All contributors and testers

---

**ChargeBD** - Making EV charging accessible and convenient across Bangladesh! 🇧🇩⚡🚗