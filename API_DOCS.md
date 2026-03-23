# GoodNews API Documentation

## Base URL
`http://localhost:3001`

## Endpoints

### Version
- `GET /api/version` - Returns API version

### RSS Feeds
- `GET /api/feeds` - Returns all news articles (optional `?filter=positive`)
- `GET /api/feeds/sources` - Returns list of RSS sources
- `GET /api/feeds/:id` - Returns single article by ID

### Authentication
- `POST /api/auth/register` - Create account (body: `{email, password, name}`)
- `POST /api/auth/login` - Authenticate (body: `{email, password}`)
- `POST /api/auth/logout` - End session (requires Bearer token)

### Users (requires auth)
- `GET /api/users/me` - Get current user info
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update preferences (body: `{theme, notifications, ...}`)

### Bookmarks (requires auth)
- `GET /api/bookmarks` - List user bookmarks
- `POST /api/bookmarks` - Create bookmark (body: `{articleId, title, link, source}`)
- `DELETE /api/bookmarks/:id` - Delete bookmark

### Comments
- `GET /api/comments` - List all comments (optional `?articleId=xxx`)
- `POST /api/comments` - Create comment (requires auth, body: `{articleId, content}`)
- `DELETE /api/comments/:id` - Delete comment (requires auth)

### File Upload (Paperclip)
- `POST /api/paperclip/upload` - Upload file (multipart form with `file` and optionally `owner`)
- `GET /api/paperclip/list` - List files (optional `?owner=xxx`)
- `GET /api/paperclip/:id` - Get file metadata
- `DELETE /api/paperclip/:id` - Delete file
- `GET /uploads/:id` - Download file

## Authentication
Protected endpoints require `Authorization: Bearer <token>` header.

## Test Status
- Server tests: 42 passing
- Webapp tests: 28 passing