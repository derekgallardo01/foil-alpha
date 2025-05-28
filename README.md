# TCG Market

A comprehensive trading card game (TCG) marketplace application built with Next.js and modern technologies.

## Features

- User authentication and authorization
- Activity logging and audit trails
- Real-time market data scraping
- Advanced data visualization with charts and grids
- Email notifications
- Cron job scheduling for automated tasks
- Google Analytics integration
- Secure API endpoints
- Modern UI with Material-UI components

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

## Database Structure

The application uses MySQL with Prisma ORM. The main models include:

- **User**: Stores user information, roles, and subscription status
- **ActivityLog**: Tracks user activities and actions

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
