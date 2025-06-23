import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

interface SearchResult {
  path: string;
  line: number;
  column: number;
  snippet: string;
  context?: string;
  contextsym?: string;
  peekRange?: string;
  upsearch?: string;
  bounds?: number[];
}

interface SearchOptions {
  query: string;
  repo?: string;
  path?: string;
  case?: boolean;
  regexp?: boolean;
  limit?: number;
}

interface SearchfoxLine {
  lno: number;
  line: string;
  bounds?: number[];
  context?: string;
  contextsym?: string;
  peekRange?: string;
  upsearch?: string;
}

interface SearchfoxFile {
  path: string;
  lines: SearchfoxLine[];
}

interface SearchfoxResults {
  [key: string]: Record<string, SearchfoxFile[]> | SearchfoxFile[];
}

interface SearchfoxMeta {
  "*timedout*"?: boolean;
  "*title*"?: string;
  limits: string[];
}

type SearchfoxResponse = SearchfoxResults & SearchfoxMeta;

class SearchfoxServer {
  private server: Server;
  private baseUrl = "https://searchfox.org";

  constructor() {
    this.server = new Server(
      {
        name: "searchfox-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_code",
          description:
            "Search for code in Mozilla repositories using Searchfox. IMPORTANT: Uses exact string matching only - no search operators, no OR logic, no phrase matching with quotes. Multiple words are treated as a single literal string.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  "Search query using exact literal string matching. CRITICAL: Do NOT use multiple words expecting OR logic (e.g., 'profiler raptor' won't find files containing either word separately). Do NOT use quotes around terms (e.g., '\"profiler\" \"raptor\"' searches for literal quotes). Use single specific terms, function names, or exact code snippets. For broader searches, use separate queries or enable regexp mode.",
              },
              repo: {
                type: "string",
                description:
                  "Repository to search in (e.g., mozilla-central, comm-central)",
                default: "mozilla-central",
              },
              path: {
                type: "string",
                description:
                  "Filter results by file path using glob patterns. Path matching uses substring matching - a path matches even if only part of it matches the glob. Use ^ and $ operators to match beginning or end of path (e.g., '^tools/profiler' to match paths starting with tools/profiler, 'profiler$' to match paths ending with profiler).",
              },
              case: {
                type: "boolean",
                description:
                  "Enable case sensitive search (default: case insensitive)",
                default: false,
              },
              regexp: {
                type: "boolean",
                description: "Treat query as regular expression pattern",
                default: false,
              },
              limit: {
                type: "number",
                description: "Maximum number of results to return",
                default: 50,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "get_file",
          description:
            "Get the contents of a specific file from specified repository.",
          inputSchema: {
            type: "object",
            properties: {
              repo: {
                type: "string",
                description: "Repository name",
                default: "mozilla-central",
              },
              path: {
                type: "string",
                description: "File path within the repository",
              },
            },
            required: ["path"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      if (!args) {
        throw new McpError(ErrorCode.InvalidParams, "Missing arguments");
      }

      switch (name) {
        case "search_code": {
          const searchArgs = args as Record<string, unknown>;
          if (!searchArgs.query || typeof searchArgs.query !== "string") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Query parameter is required and must be a string"
            );
          }

          const options: SearchOptions = {
            query: searchArgs.query,
            repo:
              typeof searchArgs.repo === "string"
                ? searchArgs.repo
                : "mozilla-central",
            path:
              typeof searchArgs.path === "string" ? searchArgs.path : undefined,
            case:
              typeof searchArgs.case === "boolean" ? searchArgs.case : false,
            regexp:
              typeof searchArgs.regexp === "boolean"
                ? searchArgs.regexp
                : false,
            limit: typeof searchArgs.limit === "number" ? searchArgs.limit : 50,
          };

          return await this.searchCode(options);
        }

        case "get_file": {
          const fileArgs = args as Record<string, unknown>;
          if (!fileArgs.path || typeof fileArgs.path !== "string") {
            throw new McpError(
              ErrorCode.InvalidParams,
              "Path parameter is required and must be a string"
            );
          }

          const repo =
            typeof fileArgs.repo === "string"
              ? fileArgs.repo
              : "mozilla-central";
          return await this.getFile(repo, fileArgs.path);
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  private async searchCode(options: SearchOptions) {
    try {
      const searchParams = new URLSearchParams({
        q: options.query,
        case: options.case ? "true" : "false",
        regexp: options.regexp ? "true" : "false",
      });

      if (options.path) {
        searchParams.append("path", options.path);
      }

      const url = `${this.baseUrl}/${options.repo || "mozilla-central"}/search?${searchParams}`;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Searchfox returns JSON with a specific structure
      const data = (await response.json()) as SearchfoxResponse;
      const results: SearchResult[] = [];

      // Process all sections dynamically (normal, test, thirdparty, generated, etc.)
      for (const [sectionKey, sectionValue] of Object.entries(data)) {
        // Skip metadata fields
        if (sectionKey.startsWith("*")) {
          continue;
        }

        // Handle sections that contain categorized results (like "normal", "test", "thirdparty")
        if (typeof sectionValue === "object" && sectionValue !== null) {
          // Check if it's a direct array (like "Textual Occurrences")
          if (Array.isArray(sectionValue)) {
            const files = sectionValue as SearchfoxFile[];
            for (const file of files) {
              if (file.lines && Array.isArray(file.lines)) {
                for (const line of file.lines) {
                  if (options.limit && results.length >= options.limit) {
                    break;
                  }

                  results.push({
                    path: file.path,
                    line: line.lno,
                    column: line.bounds?.[0] || 0,
                    snippet: line.line,
                    context: sectionKey,
                    contextsym: line.contextsym,
                    peekRange: line.peekRange,
                    upsearch: line.upsearch,
                    bounds: line.bounds,
                  });
                }
              }
            }
          } else {
            // Handle sections with categorized results (Record<string, Array<...>>)
            const categoryMap = sectionValue as Record<string, SearchfoxFile[]>;
            for (const [category, categoryResults] of Object.entries(
              categoryMap
            )) {
              if (Array.isArray(categoryResults)) {
                for (const file of categoryResults) {
                  if (file.lines && Array.isArray(file.lines)) {
                    for (const line of file.lines) {
                      if (options.limit && results.length >= options.limit) {
                        break;
                      }

                      results.push({
                        path: file.path,
                        line: line.lno,
                        column: line.bounds?.[0] || 0,
                        snippet: line.line,
                        context: line.context || `${sectionKey}: ${category}`,
                        contextsym: line.contextsym,
                        peekRange: line.peekRange,
                        upsearch: line.upsearch,
                        bounds: line.bounds,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Break if we've reached the limit
        if (options.limit && results.length >= options.limit) {
          break;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: options.query,
                repo: options.repo || "mozilla-central",
                count: results.length,
                title: data["*title*"],
                timedout: data["*timedout*"],
                limits: data["*limits*"],
                total_available: data["*timedout*"]
                  ? "Search timed out - more results may be available"
                  : undefined,
                results,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async getFile(repo: string, path: string) {
    try {
      // All Firefox repos now use the unified repository
      const firefoxGithubRepo = "mozilla/firefox";

      // Map Searchfox repo names to GitHub branches
      const branchMapping: Record<string, string> = {
        "mozilla-central": "main",
        autoland: "autoland",
        "mozilla-beta": "beta",
        "mozilla-release": "release",
        "mozilla-esr115": "esr115",
        "mozilla-esr128": "esr128",
        "mozilla-esr140": "esr140",
        // comm-central is still in mercurial, but there is an experimental
        // repository in https://github.com/mozilla/releases-comm-central/
        "comm-central": "main",
      };

      const branch = branchMapping[repo] || "main";

      // comm-central is still in mercurial, but there is an experimental
      // repository in https://github.com/mozilla/releases-comm-central/
      const repoToUse =
        repo === "comm-central"
          ? "mozilla/releases-comm-central"
          : firefoxGithubRepo;

      // Construct GitHub raw URL
      const githubRawUrl = `https://raw.githubusercontent.com/${repoToUse}/${branch}/${path}`;

      try {
        // Try to fetch from GitHub
        const response = await fetch(githubRawUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const content = await response.text();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  repo,
                  path,
                  content: content,
                  source: "github",
                  url: githubRawUrl,
                  searchfoxUrl: `${this.baseUrl}/${repo}/source/${path}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (githubError) {
        console.error("GitHub fetch failed.", githubError);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  repo,
                  path,
                  content: "",
                  note: "Error: GitHub fetch failed",
                },
                null,
                2
              ),
            },
          ],
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error("Searchfox MCP Server started");
  }
}

// Start the server
const server = new SearchfoxServer();
server.start().catch(console.error);
