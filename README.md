# TCG Market

A comprehensive trading card game (TCG) marketplace application built with Next.js and modern technologies. This platform provides tools for tracking, analyzing, and trading TCG cards with real-time market data integration.

## Core Features

### User Management
- Secure authentication system with NextAuth.js
- Role-based access control (RBAC)
- Email verification system
- Password reset functionality
- User profile management
- Activity logging and audit trails

### Market Tracking
- Real-time market data scraping
- Price history tracking
- Product watchlist system
- Advanced filtering and search capabilities
- Price change notifications
- Waitlist management with detailed user metadata

### Analytics & Visualization
- Interactive data grids using @mui/x-data-grid
- Chart.js integration for data visualization
- Real-time market trend analysis
- User activity analytics
- Google Analytics integration

### Admin Tools
- User management dashboard
- Activity monitoring
- System configuration
- Task scheduling
- Email notifications management

### Technical Features
- Automated data scraping with Puppeteer/Playwright
- Cron job scheduling for periodic tasks
- Secure API endpoints with rate limiting
- Email notification system
- Activity logging and audit trails
- Google Analytics integration

## Development Timeline

### Completed Features
- ✅ Landing page with waitlist signup
- ✅ Mailchimp integration for newsletter subscription
- ✅ Admin page for managing waitlist entries
- ✅ Production middleware configuration

### Current Development
- ✅ Google Sheets Integration
- ✅ Email Sending System
- ✅ Waitlist Management
- 🔄 Real-time communication infrastructure (WebSocket/SSE)

### Recent Updates

#### Data Management
- 📋 Google Sheets integration with proper headers matching UI
- 📋 Waitlist management scripts for bulk operations
- 📋 Automated data synchronization between UI and Google Sheets

#### Email System
- 📋 TypeScript-based email sending system
- 📋 OAuth2 authentication with Gmail API
- 📋 Error handling and logging
- 📋 Automated token refresh

#### Waitlist Management
- 📋 TypeScript-based waitlist management
- 📋 Automated cleanup scripts
- 📋 Status update scripts
- 📋 Integration with Google Sheets

### Future Development
#### Pokémon Card Auction & Trading System

1. **Core Infrastructure Setup**
   - 📋 Real-time communication setup (WebSocket/SSE)
   - 📋 Card database integration
   - 📋 Error handling system
   - 📋 Unit testing setup

2. **Basic Card Display**
   - 📋 Card details component
   - 📋 Card condition indicators (NM, SP, LP)
   - 📋 Rarity indicators (Common, Rare, Ultra Rare)
   - 📋 Edition display

3. **Order Book Foundation**
   - 📋 Basic order book visualization
   - 📋 Price level aggregation
   - 📋 Volume display
   - 📋 Order depth visualization

4. **Order Entry System**
   - 📋 Order entry form
   - 📋 Buy/Sell selection
   - 📋 Price input with validation
   - 📋 Quantity input
   - 📋 Order type selection (Market/Limit)

5. **Trading Engine**
   - 📋 Trade execution system
   - 📋 Transaction history
   - 📋 Order status updates
   - 📋 Price validation

6. **Real-Time Integration**
   - 📋 Real-time price updates
   - 📋 Trade notifications
   - 📋 Market activity tracking
   - 📋 WebSocket optimization

7. **Advanced Features**
   - 📋 Card verification system
   - 📋 Trade validation
   - 📋 Performance optimization
   - 📋 Cache strategy
   - 📋 Security enhancements
   - 📋 Advanced analytics

## Pokémon Card Auction System

### Core Features

#### Trading Platform
- Real-time bid/ask system
- Card-specific order book
- Trade execution engine
- Transaction history
- Price history tracking

#### Card Management
- Card verification system
- Condition tracking (NM, SP, LP)
- Rarity classification (Common, Rare, Ultra Rare, etc.)
- Edition verification
- Authenticity checks

#### Real-Time Features
- WebSocket/SSE integration
- Real-time price updates
- Trade notifications
- Market activity tracking
- Price alerts

#### Security & Validation
- Trade validation
- Price manipulation prevention
- Transaction security
- User authentication
- Trade authorization

#### Performance
- Real-time updates
- Price tracking optimization
- Trade matching speed
- Database efficiency
- Cache strategy

#### UI Components
- Real-time order book display
- Card details visualization
- Condition indicators
- Price history charts
- Trade history interface

## Subscription & Monetization

### Subscription Tiers

#### Free Tier ($0/month)
- Basic card trading
- Limited order book depth (5 levels)
- Basic market data access (15-minute delay)
- Standard trade execution (queue-based)
- Basic analytics (daily price history)
- 1 active order limit
- Basic support (email only)
- 1% transaction fee
- No card verification
- Basic alerts

#### Premium Tier ($9.99/month)
- Advanced order book access (10 levels)
- Real-time market data (1-minute delay)
- Priority trade execution (priority queue)
- Advanced analytics (hourly price history)
- Card verification service (basic)
- Priority support (24-hour response)
- 3 active order limit
- 0.75% transaction fee
- Basic market alerts
- Basic price alerts
- Basic trading tools
- Basic portfolio tracking
- Basic market research
- Basic trading history

#### Professional Tier ($29.99/month)
- Full order book access (20 levels)
- Premium market data (real-time)
- Instant trade execution (priority)
- Professional analytics (real-time)
- Advanced verification (full)
- Dedicated support (24/7)
- 5 active order limit
- 0.5% transaction fee
- Custom alerts
- Advanced trading tools
- Advanced portfolio tracking
- Advanced market research
- Advanced trading history
- Custom trading strategies
- Professional market data
- White-label solutions
- Custom analytics
- Verified seller badges
- Premium listings
- Custom alerts
- Real-time notifications

### Monetization Features

#### Trading Fees
- Transaction-based fees (0.5% - 1%)
- Volume-based discounts (up to 50%)
- Market maker incentives (0.1% rebate)
- Trade execution fees (0.01%)
- Premium listing fees ($5/order)
- Verified seller badge ($10/month)
- Custom analytics ($50/month)
- White-label solutions (custom pricing)
- Priority support ($100/month)

#### Subscription Benefits
- Priority access to new features
- Advanced trading tools
- Enhanced market data
- Professional support
- Custom alerts
- Real-time notifications
- Advanced analytics
- Portfolio management
- Trading history
- Market research
- Trading strategies
- White-label solutions

#### Additional Revenue Streams
- Premium listings (featured trades)
- Verified seller badges
- Custom analytics packages
- White-label solutions
- Priority support services
- Custom trading strategies
- Market research reports
- Professional consulting
- Custom integration services
- Enterprise solutions

### Security & Compliance
- Secure payment processing (PCI-DSS)
- Regulatory compliance (SEC, FINRA)
- Data privacy (GDPR, CCPA)
- Fraud prevention (AI-based)
- Transaction monitoring
- KYC/AML compliance
- Secure authentication
- Two-factor authentication
- Encrypted data storage
- Regular security audits
- Compliance certifications

### Payment Processing
- Multiple payment methods
- Secure payment gateway
- Recurring subscription management
- Automated billing
- Tax calculation
- Refund processing
- Chargeback prevention
- Payment dispute handling
- Multi-currency support
- International payments

### Analytics & Reporting
- Real-time trading analytics
- Portfolio performance tracking
- Market trend analysis
- Custom trading metrics
- Risk management tools
- Performance benchmarks
- Trading strategy analysis
- Market impact analysis
- Transaction cost analysis
- Historical performance reports

### Support & Documentation
- 24/7 support (Professional tier)
- 24-hour support (Premium tier)
- Email support (Free tier)
- Knowledge base
- API documentation
- Integration guides
- Best practices
- Trading guides
- Market analysis
- Educational resources

### Integration & API
- REST API access
- WebSocket API
- API rate limiting
- API documentation
- Integration guides
- Custom API solutions
- API monitoring
- API analytics
- API security
- API usage reports

## Application Components

### Pages
- **Authentication**
  - Login
  - Register
  - Forgot Password
  - Reset Password
  - Email Verification

- **User Interface**
  - Dashboard
  - Settings
  - Activation Success
  - Protected Routes

- **Admin Panel**
  - User Management
  - Activity Logs
  - System Configuration

- **Market Features**
  - Product Search
  - Price History
  - Watchlist Management
  - Task Management
  - Chat System

### API Endpoints

#### Authentication
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`

#### Market Data
- `/api/products`
- `/api/fetchProduct`
- `/api/price-history`
- `/api/scrapeTarget`

#### User Management
- `/api/users`
- `/api/watchlist`
- `/api/visitor-count`

#### Waitlist Management
- `/api/subscribe`: Handles waitlist signups with:
  - Input validation (name and email required)
  - Server-side email validation
  - IP address tracking
  - Timezone detection
  - Detailed metadata collection (browser, OS, device info)
  - Email notifications for new signups
  - Duplicate entry handling
  - Comprehensive logging
  - Mailchimp integration for automatic newsletter subscription
  - Success/failure status tracking for newsletter subscriptions

#### Admin Features
- `/api/admin/*`: Protected routes for admin functionality
- `/api/admin/waitlist`: API endpoint for managing waitlist entries
- `/api/tasks/*`: Task management endpoints
- `/api/discord/*`: Discord integration endpoints

#### System
- `/api/protected/*`: Protected API endpoints
- `/api/test/*`: Test endpoints

## Production Configuration

### Middleware Configuration
The application includes middleware for production environment that:
- Only allows the landing page (`/` or `/landing`) in production
- Redirects all other routes to the landing page
- Maintains API access for waitlist functionality
- Allows admin routes in development mode only
- Maintains NextAuth authentication for admin routes in development

## Development Setup

### Database Setup
1. For local development:
```bash
mysql -u dev -p
USE visitorDB;
```

2. For remote access:
```bash
mysql -h 157.230.211.144 -u dev -p
USE visitorDB;
```

### Environment Variables
Create a `.env` file with the following variables:
```
# Database
DATABASE_URL="mysql://dev:[password]@localhost:3306/visitorDB"

# Authentication
NEXTAUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email
EMAIL_USER="your-email"
EMAIL_PASSWORD="your-email-password"

# API Keys
DISCORD_TOKEN="your-discord-token"
```

### Development Server
```bash
npm run dev
# or
yarn dev
```

### Production Build
```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Security

The application implements several security measures:

- Password hashing with bcrypt
- Secure session management with NextAuth.js
- Rate limiting on API endpoints
- Input validation and sanitization
- Secure database connections
- HTTPS proxy agent for API calls
- Environment variable protection

## Monitoring & Analytics

- Google Analytics integration for user tracking
- Activity logging system
- Cron job monitoring
- Error tracking and logging
- Performance monitoring

## Best Practices

1. Always use environment variables for sensitive data
2. Never commit database passwords or API keys
3. Use HTTPS for all external API calls
4. Regularly update dependencies
5. Follow the project's coding standards

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Framework**: Material-UI (@mui/material)
- **Database**: MySQL (via Prisma ORM)
- **Authentication**: NextAuth.js
- **Data Visualization**: Chart.js, @mui/x-data-grid
- **API**: Axios
- **Security**: bcrypt, bcryptjs
- **Cron Jobs**: node-cron
- **Email**: Nodemailer
- **Scraping**: Puppeteer, Playwright
- **Analytics**: Google Analytics

## Database Details

The application uses MySQL database with the following connection details:

### Local Development
- **Host**: localhost
- **Database**: visitorDB
- **Username**: dev
- **Password**: [contact admin]
- **Port**: 3306

### Remote Production
- **Host**: 157.230.211.144
- **Database**: visitorDB
- **Username**: dev
- **Password**: [contact admin]
- **Port**: 3306

> **Note**: For security reasons, please contact me for the actual database password.

## Database Structure

The application uses MySQL with Prisma ORM. The main models include:

- **User**: Stores user information, roles, and subscription status
- **ActivityLog**: Tracks user activities and actions
- **Waitlist**: Manages waitlist entries with:
  - User information (name, email)
  - Status tracking (PENDING)
  - Source information (WEBSITE)
  - Metadata including:
    - Signup timestamp
    - IP address
    - Timezone
    - Browser details (name, version)
    - OS details (name, version)
    - Device information (type, model)

## Getting Started

### Prerequisites

- Node.js (latest LTS version)
- MySQL Server
- Git
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/derekgallardo01/tcg-market.git
cd tcg-market
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
DATABASE_URL="mysql://user:password@localhost:3306/tcg_market"
NEXTAUTH_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Development Server

Run the development server with Turbopack:
```bash
npm run dev
# or
yarn dev
```

The development server will start at `http://localhost:3000`

### Production Build

1. Build the application:
```bash
npm run build
# or
yarn build
```

2. Start the production server:
```bash
npm run start
# or
yarn start
```

The production server will run on `http://localhost:3000` by default

## Project Structure

```
tcg-market/
├── src/
│   └── app/          # Next.js app directory
├── prisma/           # Database schema and migrations
├── public/           # Static assets
└── scrape_target.py  # Market data scraping script
```

## Security

- Uses bcrypt for password hashing
- Implements NextAuth.js for secure authentication
- Includes rate limiting and input validation
- Uses HTTPS proxy agent for secure API calls

## Monitoring

- Google Analytics integration for user tracking
- Activity logging system
- Regular cron jobs for maintenance tasks

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
