# Changelog

All notable changes to M3U Manager will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-04-11

### Changed

- **Frontend calls the backend via relative `/api` paths** instead of a hardcoded `REACT_APP_BACKEND_URL`. The same production bundle now works on any origin as long as the reverse proxy forwards `/api/*` to the FastAPI backend (nginx is already configured this way in the stock install). Previously the backend URL was baked into the JS bundle at build time, which meant any domain change required a rebuild — and caused the 2026-04-11 login outage when `m3u.g3h.cloud` was decommissioned but the bundle still pointed at it. Touches 11 page files; `REACT_APP_BACKEND_URL` is no longer read anywhere in `frontend/src/`.
- `frontend/.env` and `frontend/.env.example` updated to document the new pattern.

### Added

- **Failed-login logging** (`server.py:688`). The `/api/auth/login` handler now emits a `WARNING` log line for each authentication failure, including the attempted username and client IP (honoring `X-Forwarded-For` when behind a reverse proxy). Three distinct failure reasons are distinguished in the log message: unknown username, bad password, and expired tenant. Successful logins are logged at `INFO` level for symmetry, so `journalctl -u m3u-backend | grep -E 'login'` gives you the full picture.

### Removed

- **Dead code cleanup:** `frontend/src/pages/Channels_old.js` (852 lines) and `frontend/src/pages/Categories_new.js` (237 lines). Neither file was imported from anywhere in `src/`.

### Investigation

- **OOM kill on 2026-04-11 at 10:50:44** (2.2 GB peak on a ~4 GiB LXC container). Investigation did not land a fix in this release because the spike couldn't be reproduced from the logs alone — the 9-minute window of memory growth prior to OOM contained zero logged backend activity (uvicorn access logs are off and failed-login logging was only added in this release). The most likely trigger is a single request to `/api/channels/search`, `/api/categories`, or `/api/backup/*` with a broad query: each of those handlers loads every playlist's `content` field into memory and calls `parse_m3u_content` to build Python dicts for all channels on every invocation. For the current data set (17 playlists, 34 MB raw content, ~160k channels) that's ~160 MB per call — survivable in isolation, but a handful of concurrent calls plus motor driver overhead can plausibly hit 2+ GB.
  - **Recommended follow-up (not in this release):** parse channels at ingestion time into a dedicated `channels` collection with indexes on `tenant_id`, `playlist_id`, `group`, and a text index on `name`. Then the search/categories/export handlers can query the indexed collection directly rather than re-parsing the blob. This also lets `list_playlists` project out the `content` field.

## [1.1.1] - 2026-04-11

### Security

- **Path traversal in backup download** (`server.py:1881`) — the `/api/backup/files/{filename}` endpoint built the backup path from a user-controlled filename with no sanitization. A super admin could pass `../etc/passwd` (or any absolute path) and the handler would open it. Now rejects anything that is not a bare `.json` basename and re-validates the resolved path stays inside `BACKUP_DIR` (defeats symlink escapes).
- **Stored XSS via `dangerouslySetInnerHTML`** on dashboard notes (`Dashboard.js:166`, `Settings.js:1001`). Admin notes are stored as HTML by design, so the render sites now sanitize with DOMPurify using a strict tag/attribute allowlist, and the backend `PUT /api/dashboard/notes` handler sanitizes again with bleach as defense in depth — so direct API calls cannot bypass the frontend sanitizer.
- **Rotated the JWT signing secret** (`SECRET_KEY`) and restarted the backend. All pre-existing JWTs were invalidated; users had to log in again.
- **Scrubbed leaked `.env` files from git history** via `git-filter-repo`. Historical `backend/.env` and `frontend/.env` blobs contained dev placeholders and preview URLs from the project's scaffolding — the real production secret was never in public history, but the scrub removes the misleading examples regardless.

### Fixed

- **Hardcoded tenant expiration default** (`server.py:456`, `server.py:731`). The `Tenant` model's `expiration_date` `default_factory` and the `create_tenant` handler both fell back to `datetime(2025, 12, 1)`. After that date every newly created tenant was born already expired, so login was immediately blocked with HTTP 403 "Tenant subscription has expired". Both sites now use a rolling `datetime.now(timezone.utc) + timedelta(days=365)`.

### Changed

- Replaced the project `.gitignore` with a canonical version. The previous file had accumulated ten-plus duplicate `# Environment files / *.env / *.env.*` blocks and literal `-e ` strings from broken `echo -e` appends, plus a hand-enumerated `frontend/node_modules/.cache/*.pack` list that is now covered by a glob.
- Added `backend/.env.example` and `frontend/.env.example` documenting the required environment variables. The new `.gitignore` allowlists `*.env.example` while still ignoring real `.env` files.
- Started tracking `frontend/yarn.lock` (~11k lines). It was previously untracked, meaning `yarn install` produced nondeterministic dependency versions across environments.

### Dependencies

- Added `dompurify@3.3.3` (frontend)
- Added `bleach==6.3.0` (backend)

### Notes

- Version 1.1.1-beta was never released as production; its feature set (dashboard two-column layout, release notes sidebar, player API status cards, last-login tracking, UI cleanup) is rolled into this 1.1.1 production release.

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

[1.1.2]: https://github.com/wilson1442/m3-manager/releases/tag/v1.1.2
[1.1.1]: https://github.com/wilson1442/m3-manager/releases/tag/v1.1.1
[1.1.0]: https://github.com/wilson1442/m3-manager/releases/tag/v1.1.0
[1.0.0]: https://github.com/wilson1442/m3-manager/releases/tag/v1.0.0
