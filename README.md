# GoodNews Server

API backend for the GoodNews web application. This server aggregates RSS feeds, filters positive news stories, and provides a RESTful API for user authentication, bookmarks, comments, and file uploads.

## Features

- **RSS Feed Aggregation**: Fetches news from multiple RSS sources and filters for positive stories using sentiment analysis.
- **User Authentication**: User registration and login with session tokens (UUID-based).
- **Bookmarks**: Save and manage favorite articles.
- **Comments**: Discuss articles with other users.
- **File Uploads (Paperclip)**: Upload and manage attachments.
- **Configurable**: Environment-based configuration for ports and API URLs.

## API Endpoints

### Version
- `GET /api/version` - Returns the current API version

**Updating the API version**: Edit `API_VERSION` in `src/index.ts` (line 10). The version can also be set via the `API_VERSION` environment variable for deployment flexibility.

### Feeds
- `GET /api/feeds` - Retrieve all news articles (supports `?filter=positive` query param)
- `GET /api/feeds/sources` - List RSS sources
- `GET /api/feeds/:id` - Get a single article by ID

### Authentication
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Authenticate and receive a JWT token
- `POST /api/auth/logout` - Invalidate the current token

### Users
- `GET /api/users/me` - Get current user profile (requires auth)
- `GET /api/users/preferences` - Get user preferences (requires auth)
- `PUT /api/users/preferences` - Update user preferences (requires auth)

### Bookmarks
- `GET /api/bookmarks` - List user's bookmarks (requires auth)
- `POST /api/bookmarks` - Add a bookmark (requires auth)
- `DELETE /api/bookmarks/:id` - Remove a bookmark (requires auth)

### Comments
- `GET /api/comments` - List all comments (optional `?articleId` filter)
- `POST /api/comments` - Add a comment (requires auth)
- `DELETE /api/comments/:id` - Remove a comment (requires auth)

### Paperclip (File Uploads)
- `POST /api/paperclip/upload` - Upload a file (multipart/form-data)
- `GET /api/paperclip/list` - List uploaded files (optional `?owner` filter)
- `GET /api/paperclip/:id` - Get file metadata
- `DELETE /api/paperclip/:id` - Delete a file

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
cd projects/server
npm install
```

### Configuration
Create a `.env` file in the server root (optional) or set the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATA_DIR` | `./data` | Directory for persistent storage (relative to cwd) |

### Running
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Architecture

- **Express**: Web framework
- **Multer**: File upload handling
- **wink-nlp**: Sentiment analysis for positive news detection
- **rss-parser**: RSS feed parsing
- **UUID Tokens**: Session-based authentication (sessions stored in memory)
- **Sentiment Analysis**: Uses wink-nlp to score article positivity

## Project Structure

```
src/
├── index.ts        # Main server entry point
├── auth.ts         # Authentication logic
├── feeds.ts        # RSS feed fetching and parsing
├── store.ts        # Data persistence layer
└── paperclip.ts    # File upload service
```

## License

MIT