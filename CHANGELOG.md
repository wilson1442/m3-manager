# Changelog

All notable changes to M3U Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-10-28

### Added

#### Dashboard Notes System
- Super admin dashboard notes with HTML support
- Rich text announcements visible to all users
- HTML textarea editor with live preview
- Support for headings, lists, bold, italic, links, and more
- Update tracking (username and timestamp)
- Persistent storage in MongoDB

#### Enhanced Search & Filtering
- Free-form text search on Categories page
- Dual filtering system (playlist dropdown + text search)
- Real-time category filtering as you type
- Result counter showing filtered items
- Same filtering system added to Events page

#### UI/UX Improvements
- Collapsible category groups (collapsed by default)
- Channel results grouped by source playlist
- Improved logo display sizing (120x80px max)
- Removed problematic embedded HLS player
- Tenant expiration date management with visual status indicators
- Edit functionality for tenant expiration dates

#### Tenant Management
- Tenant expiration date field in tenant creation
- Expiration date display in tenant list with status badges
- Edit tenant dialog for updating expiration dates
- Visual indicators (Active/Expired status)
- Login blocking for expired tenants

### Changed
- Version updated from 1.0.1-beta to 1.1.0 (Production)
- Stream playback removed (direct play button disabled)
- Categories now support source grouping
- Events page results collapsed by default
- Improved error handling for channel search

### Fixed
- Channel search parameter mismatch (query → q)
- React rendering error with FastAPI validation errors
- Search results only showing single playlist
- Collapsed state initialization for filtered results
- Super admin access to categories without tenant
- Backend syntax errors in restore_tenant function
- MongoDB ObjectId serialization in dashboard notes
- ReactQuill compatibility issues (replaced with HTML textarea)

### Security
- Tenant expiration check added to login endpoint
- Prevents expired tenants from obtaining new access tokens
- 403 error with clear message for expired accounts

## [1.0.0] - 2025-01-27

### Added

#### Core Features
- Multi-tenant architecture with three user roles (Super Admin, Tenant Owner, User)
- M3U playlist management with automatic hourly refresh
- Manual playlist refresh capability
- Channel search across all playlists
- FFmpeg-based stream probing with detailed metadata
- HLS video player for in-browser streaming
- Category management and monitoring
- Event tracking for monitored categories
- Export channels to M3U format

#### User Management
- User creation with role assignment
- Tenant creation and management
- Create user + tenant in single action
- Profile image upload (PNG, 2MB max)
- Dark/Light theme toggle
- Version display in sidebar (v1.0.0)

#### Backup & Administration
- Full database backup and restore
- Per-tenant backup and restore
- Scheduled backups (daily/weekly)
- Configurable retention policies
- Automatic backup cleanup
- System update management via GitHub
- Pull updates from production/beta branches
- Deploy updates with automatic rebuild

#### Player API Integration
- Monitor account connections
- Display expiration dates
- Track active/max connections
- Automatic refresh of API data

#### Infrastructure
- Cloudflare Tunnel support in installation script
- Automatic CORS configuration for Cloudflare
- Virtual environment for Python dependencies
- Systemd service integration
- Nginx reverse proxy configuration
- MongoDB 7.0 with proper datetime serialization

### Fixed
- Dropdown transparent backgrounds (CSS variables)
- MongoDB service name in systemd (mongodb → mongod)
- CORS configuration for Cloudflare domains
- HLS player initialization and error handling
- CSS variable interpretation (HSL vs RGB)
- Nested JSON parsing for Player API data
- Unix timestamp conversion for expiration dates
- Profile image storage and display

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- CORS protection
- Environment variable configuration
- Secure session management

### Documentation
- Comprehensive README with version history
- Installation guide with Cloudflare support
- Quick start guide
- Troubleshooting section
- Update procedures
- API documentation

---

## Version Numbering

- **Major version** (X.0.0): Breaking changes, major feature overhauls
- **Minor version** (1.X.0): New features, UI changes, non-breaking updates
- **Patch version** (1.0.X): Bug fixes, security patches, minor tweaks

---

## Upcoming in Future Versions

### Planned Features
- EPG (Electronic Program Guide) support
- Advanced playlist editor
- Advanced analytics and usage statistics
- API key management for external access
- Webhook notifications
- Custom branding per tenant

---

[1.1.0]: https://github.com/wilson1442/m3-manager/releases/tag/v1.1.0
[1.0.0]: https://github.com/wilson1442/m3-manager/releases/tag/v1.0.0
