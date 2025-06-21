# Searchfox MCP Server

A Model Context Protocol (MCP) server that provides access to Mozilla's Searchfox code search service. This server enables AI assistants to search through Mozilla's codebases and retrieve file contents directly.

## Features

- **Code Search**: Search across Mozilla repositories using Searchfox's powerful indexing
- **File Retrieval**: Get file contents from Mozilla repositories via GitHub integration
- **Multiple Repositories**: Support for mozilla-central, autoland, mozilla-beta, and ESR branches

## Available Tools

### `search_code`
Search for code patterns across Mozilla repositories.

**Parameters:**
- `query` (string): Search query (code, functions, variables, etc.)
- `repo` (string, optional): Repository to search in (defaults to "mozilla-central")
- `limit` (number, optional): Maximum number of results (defaults to 20, max 50)

**Supported Repositories:**
- `mozilla-central` (default)
- `autoland`
- `mozilla-beta`
- `mozilla-esr128`, `mozilla-esr115`, etc.

### `get_file`
Retrieve the contents of a specific file from a Mozilla repository.

**Parameters:**
- `path` (string): File path within the repository
- `repo` (string, optional): Repository name (defaults to "mozilla-central")

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### As an MCP Server

Run the server in stdio mode for MCP client integration:

```bash
npm start
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Run linting
npm run lint

# Run formatting
npm run format
```

## Configuration

The server runs via stdio transport and communicates using the MCP protocol. Configure your MCP client to connect to this server using the built executable.
