# Searchfox MCP Server

A Model Context Protocol (MCP) server that provides access to Mozilla's Searchfox code search service. This server enables AI assistants to search through Mozilla's codebases and retrieve file contents directly.

## Features

- **Code Search**: Search across Mozilla repositories using Searchfox's powerful indexing
- **File Retrieval**: Get file contents from Mozilla repositories via GitHub raw content API
- **Multiple Repositories**: Support for mozilla-central, autoland, mozilla-beta, ESR branches, and comm-central
- **Flexible Search Options**: Case sensitivity, regular expressions, and path filtering

## Available Tools

### `search_code`
Search for code patterns across Mozilla repositories using Searchfox.

**Parameters:**
- `query` (string): Search query using exact literal string matching (no OR logic, no phrase matching)
- `repo` (string, optional): Repository to search in (defaults to "mozilla-central")
- `path` (string, optional): Filter results by file path using glob patterns with ^ and $ operators
- `case` (boolean, optional): Enable case sensitive search (default: false)
- `regexp` (boolean, optional): Treat query as regular expression pattern (default: false)
- `limit` (number, optional): Maximum number of results (default: 50)

**Important Search Notes:**
- Uses exact string matching only - multiple words are treated as a single literal string
- No search operators, OR logic, or phrase matching with quotes
- For broader searches, use separate queries or enable regexp mode

**Supported Repositories:**
- `mozilla-central` (default) → GitHub main branch
- `autoland` → GitHub autoland branch
- `mozilla-beta` → GitHub beta branch
- `mozilla-release` → GitHub release branch
- `mozilla-esr115`, `mozilla-esr128`, `mozilla-esr140` → Corresponding ESR branches
- `comm-central` → GitHub mozilla/releases-comm-central main branch

### `get_file`
Retrieve the contents of a specific file from a Mozilla repository. Files are retrieved from GitHub raw content API (https://raw.githubusercontent.com/)

**Parameters:**
- `path` (string): File path within the repository
- `repo` (string, optional): Repository name (defaults to "mozilla-central")

## Usage

First clone the repository and run:

```
# Install dependencies and build the project
npm install
npm run build
```

Then add the MCP server to your client.

### Claude Desktop Configuration

Your `claude_desktop_config.json` file should look like this:
```json
{
  "mcpServers": {
    "searchfox": {
      "command": "node",
      "args": [
        "/path/to/searchfox-mcp/dist/index.js"
      ]
    },
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode with hot reload
npm run dev

# Type checking without emitting files
npm run tsc

# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Configuration

The server runs via stdio transport and communicates using the MCP protocol. Configure your MCP client to connect to this server using the built executable.
