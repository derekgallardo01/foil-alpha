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
