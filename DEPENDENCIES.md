# TCG Market - Complete Dependencies Guide

## Node.js Dependencies (package.json)

### ✅ Currently Installed
All Node.js dependencies are managed via `package.json` and installed with `npm install`.

**Key Dependencies:**
- **Next.js 14+** - React framework
- **React 18+** - UI library  
- **TypeScript** - Type safety
- **Prisma** - Database ORM
- **NextAuth.js** - Authentication
- **Material-UI (MUI)** - UI components
- **Chart.js + React-ChartJS-2** - Charts and graphs
- **MySQL2** - Database driver
- **bcryptjs** - Password hashing
- **Framer Motion** - Animations

## Python Dependencies (requirements.txt)

### ✅ Required for Web Scraping
Install with: `pip install -r requirements.txt`

```bash
undetected-chromedriver>=3.5.0  # Bypass anti-bot detection
selenium>=4.15.0                # Web automation
beautifulsoup4>=4.12.0          # HTML parsing
webdriver-manager>=4.0.0        # Chrome driver management
requests>=2.31.0                # HTTP requests
mysql-connector-python>=8.2.0   # Database connectivity
pandas>=2.1.0                   # Data processing
```

## System Dependencies

### ✅ Required Software
- **Node.js 18+** - JavaScript runtime
- **MySQL 8.0+** - Database server
- **Python 3.8+** - For scraping scripts
- **Chrome/Chromium** - For web scraping

### ⚠️ Optional (for full features)
- **Redis** - Caching and real-time features
- **PM2** - Process management (production)

## Environment Variables

### ✅ Required
```bash
DATABASE_URL="mysql://user:password@localhost:3306/database"
NEXTAUTH_SECRET="random-secret-string"
NEXTAUTH_URL="http://localhost:3000"
```

### ⚠️ Optional (for production features)
```bash
GOOGLE_CLIENT_ID="oauth-client-id"
GOOGLE_CLIENT_SECRET="oauth-client-secret"
DISCORD_CLIENT_ID="discord-app-id"
DISCORD_CLIENT_SECRET="discord-app-secret"
STRIPE_SECRET_KEY="stripe-api-key"
```

## Installation Verification

### Check Node.js Setup
```bash
node --version          # Should be 18+
npm --version           # Should be 9+
npm list --depth=0      # List installed packages
```

### Check Python Setup
```bash
python --version        # Should be 3.8+
pip list               # List installed packages
pip check              # Check for dependency conflicts
```

### Check Database
```bash
mysql --version        # Should be 8.0+
mysql -u root -p       # Test connection
```

## Common Issues & Solutions

### Node.js Issues
- **Chart.js errors**: Fixed with proper component registration
- **Prisma errors**: Run `npx prisma generate` after schema changes
- **TypeScript errors**: Run `npm run typecheck`

### Python Issues
- **ModuleNotFoundError**: Run `pip install -r requirements.txt`
- **Chrome driver issues**: Ensure Chrome browser is installed
- **Permission errors**: Run with appropriate user privileges

### Database Issues
- **Connection refused**: Check MySQL service is running
- **Access denied**: Verify user credentials and privileges
- **Table doesn't exist**: Run `npx prisma migrate dev`

## Development vs Production

### Development
- All dependencies installed locally
- Test data via seeding
- Hot reload enabled
- Debug logging active

### Production
- Optimized builds
- Production database
- Environment-specific configs
- PM2 process management
- SSL certificates
- Redis caching

## Update Maintenance

### Regular Updates
```bash
# Check outdated Node.js packages
npm outdated

# Update packages
npm update

# Check outdated Python packages  
pip list --outdated

# Update Python packages
pip install --upgrade -r requirements.txt
```

### Security Updates
```bash
# Audit Node.js dependencies
npm audit
npm audit fix

# Check Python security issues
pip-audit  # (requires: pip install pip-audit)
```