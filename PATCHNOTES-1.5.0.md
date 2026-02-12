# Patch Notes - Patreon Branch

## Version 1.5.0

### Major Features

#### 🔐 Patreon Integration
- Added complete Patreon OAuth2 authentication system
- Implemented tier-based access control for tools
- Created admin override system for creators/admins
- Added manual tier override system for premium and limited access users
- New authentication routes: `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`, `/api/auth/user`

#### 📊 Tier System
- **Fan Tier**: Basic access (no tools)
- **Limited Tier**: Access to Info Box Panel
- **Premium Tier**: Full access to all tools (Info Box, Bank View, Item Creator, Dialog Panel, Option Panel, Loot Calculator)
- Configurable tier system via `config/tiers.json`
- Admin ID whitelist for automatic premium access
- Manual premium/limited access lists for hardcoded overrides

#### 🛡️ Security Enhancements
- JWT token-based authentication system
- Secure cookie handling for auth tokens
- Token refresh mechanism for expired access tokens
- Middleware for tier-based access control
- Added 401 and 403 error pages for unauthorized/forbidden access

### UI/UX Improvements

#### Homepage Redesign
- Complete redesign of `index.html` with new layout and styling
- New `homepage.css` stylesheet with modern styling
- Tool showcase with example panel images
- Authentication UI integration
- Tool access status display based on user tier

#### Panel Improvements
- **Dialog Panel**: Major improvements to button styling, download functionality, and font rendering
- **Option Panel**: Refactored layout and styling
- **Bank View**: Enhanced download button functionality and tab support
- **Info Box**: Added ID display feature
- **Item Creator**: Improved UI and functionality

#### Visual Assets
- Added example panel images:
  - `examplepanels/bankpanelexample.png`
  - `examplepanels/dialogpanelexample.png`
  - `examplepanels/iconpanelexample.png`
  - `examplepanels/infoboxpanelexample.png`
  - `examplepanels/lootcalcpanelexample.png`
  - `examplepanels/optionpanelexample.png`

### Technical Changes

#### New Files
- `lib/patreon.js` - Patreon OAuth2 integration
- `lib/jwt.js` - JWT token creation and verification
- `lib/middleware.js` - Express middleware for authentication and tier checks
- `routes/auth.js` - Authentication route handlers
- `config/tiers.json` - Tier configuration and tool access mapping
- `public/401.html` - Unauthorized error page
- `public/403.html` - Forbidden error page
- `homepage.css` - Homepage styling
- `style.css` - Global styling updates

#### Modified Files
- `server.js` - Added authentication routes and middleware integration
- `package.json` - Added dependencies: `axios`, `cookie-parser`, `jsonwebtoken`
- `vercel.json` - Updated deployment configuration
- `bankview/bank.js` - Enhanced download and tab functionality
- `bankview/index.html` - Updated styling and layout
- `dialogpanel/dialogpanel.js` - Major refactor with improved button styling and download support
- `dialogpanel/dialogpanel.css` - Removed (styles moved to dialogpanel.js)
- `optionpanel/optionpanel.js` - Refactored layout and styling
- `optionpanel/index.html` - Updated to use new styling
- `itemcreator/itemcreator.js` - Enhanced functionality
- `itemcreator/index.html` - Updated layout
- `infobox/infobox.js` - Added ID display feature
- `.gitignore` - Updated to exclude environment and temporary files

#### Dependencies Added
- `axios@^1.13.5` - HTTP client for API requests
- `cookie-parser@^1.4.7` - Cookie parsing middleware
- `jsonwebtoken@^9.0.3` - JWT token handling

### Bug Fixes
- Fixed dialog panel hardcoded sizing issue that prevented proper downloading
- Fixed bank view tab downloading functionality
- Fixed download button styling across browsers
- Fixed image rendering issues in panels
- Fixed text blurriness by adjusting default scale to 3
- Fixed box centering issues in dialog panel
- Fixed button styling consistency across all panels

### Configuration
- Environment variables required:
  - `PATREON_CLIENT_ID`
  - `PATREON_CLIENT_SECRET`
  - `PATREON_REDIRECT_URI`
  - `JWT_SECRET`

### Breaking Changes
- Authentication is now required to access premium tools
- Tool access is now tier-based and controlled via Patreon integration
- Some tools are now restricted to specific tiers

### Future Improvements
- Token refresh automation
- Enhanced user profile page
- Tier upgrade prompts
- Analytics integration

---

**Summary**: This release introduces a complete Patreon integration system with tier-based access control, major UI/UX improvements across all panels, and enhanced security features. The application now supports multiple access tiers with different tool availability levels.
