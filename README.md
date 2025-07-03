# TCG Market - Pokemon Card Auction Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-13.4.12-000000?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.10.1-2D3748?logo=prisma)](https://www.prisma.io/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=node.js)](https://nodejs.org/)

A comprehensive Pokemon TCG marketplace and auction platform built with Next.js 13+, TypeScript, and modern technologies. This platform provides tools for buying, selling, and auctioning Pokemon cards with real-time market data integration and secure transactions.

> **Last Updated**: June 28, 2025

## Features

### Core Functionality
- **User Management**
  - Secure authentication with NextAuth.js, Google OAuth2, and Discord OAuth
  - Role-based access control (Admin/User)
  - Email verification & password reset
  - User activity tracking and audit logs
  - Wallet system with transaction history

- **Pokemon Card Marketplace**
  - Advanced card search with filters for sets, rarities, types, and more
  - Real-time price tracking and historical price data
  - Buy/Sell order management with secure transactions
  - Watchlist and collection tracking
  - Card condition grading (Mint, Near Mint, Played, etc.)

- **### 🎯 Auction System
  - **Real-time Bidding**: Live updates with WebSockets for instant bid notifications
  - **Buy It Now (BIN)**: Instant purchase option at a premium price
  - **Proxy Bidding**: Automatic bid increments up to your maximum
  - **Bid History**: Complete audit trail of all bids
  - **Escrow Service**: Secure payment handling for high-value transactions
  - **Scheduling**: Set future start/end times for auctions
  - **Reserve Prices**: Optional minimum price requirements
  - **Admin Tools**: Comprehensive management interface
  - **Automation**: Automatic winner selection and notifications
  - **Anti-Sniping**: Automatic extension for last-minute bids
  - **Bulk Listing**: List multiple cards in a single auction

- **Admin Dashboard**
  - User management
  - Analytics and reporting
  - System configuration
  - Waitlist management

## Technical Stack

### Frontend
- **Framework**: Next.js 13+ (App Router)
- **UI**: React 19, Material-UI (MUI) v6, Tailwind CSS
- **State Management**: React Query, Zustand
- **Animation**: Framer Motion
- **Form Handling**: React Hook Form with Zod validation
- **Charts**: Chart.js for price history visualization

### Backend
- **Runtime**: Node.js 18+, TypeScript 5.0
- **API**: Next.js API Routes
- **Database**: MySQL with Prisma ORM
- **Authentication**: NextAuth.js with multiple OAuth providers
- **Real-time**: WebSockets for live auctions and bidding
- **Payments**: Integration with Stripe for secure transactions

### DevOps
- ESLint + Prettier
- TypeScript type checking
- PM2 process management
- GitHub Actions (CI/CD)

## Getting Started

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- npm 9+ or yarn 1.22+
- Redis (for real-time features and rate limiting)
- Stripe account (for payment processing)
- Google OAuth credentials (for authentication)
- Discord OAuth credentials (for authentication)

### Installation

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/yourusername/tcg-market.git
   cd tcg-market
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Update the environment variables in .env.local
   ```
   Required environment variables:
   - `DATABASE_URL`: MySQL connection string
   - `NEXTAUTH_SECRET`: Random string for session encryption
   - `NEXTAUTH_URL`: Your application URL
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: For Google OAuth
   - `DISCORD_CLIENT_ID` & `DISCORD_CLIENT_SECRET`: For Discord OAuth
   - `STRIPE_SECRET_KEY`: For payment processing

3. Set up the database:
   ```bash
   npx prisma migrate dev
   npx prisma db seed  # Optional: Seed with initial data
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

## Deployment

### Production Build

## Database Management

### Backup Scripts
The project includes several backup scripts for managing the database:
{{ ... }}

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
---

<div align="center">
  Made with ❤️ by TCG Market Team
</div>
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

#### Auction Endpoints
- `GET /api/auctions` - List active auctions with filters
- `POST /api/auctions/bid` - Place a bid on an auction
- `GET /api/auctions/:id` - Get auction details and bid history
- `POST /api/auctions/buy-now` - Instant purchase with Buy It Now
- `GET /api/user/auctions` - Get user's auction activity

#### Admin Auction Endpoints
- `GET /api/admin/auctions` - List all auctions (admin only)
- `POST /api/admin/auctions/end` - End an auction early (admin only)
- `GET /api/admin/auction-stats` - Auction statistics and metrics

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
- Only allows the waitlist page (`/` or `/waitlist`) in production
- Redirects all other routes to the waitlist page
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



