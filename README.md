# MCP Jira Server

A Model Context Protocol (MCP) server that integrates Jira with Claude Desktop, allowing you to fetch and view Jira issue details directly through Claude.

## Features

- 🔍 **Get Jira Issue Details**: Fetch comprehensive information about any Jira issue by its key
- 🔐 **Secure Authentication**: Uses Jira API tokens for secure access
- 🎯 **Structured Data**: Returns both human-readable and structured JSON data
- 🚀 **Claude Desktop Integration**: Seamlessly works with Claude Desktop via MCP protocol

## Prerequisites

- Node.js (v18 or higher)
- Claude Desktop application
- Jira instance with API access
- Jira API token

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/imrnbeg/jira-mcp.git
   cd jira-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

## Configuration

### 1. Create Environment File

Create a `.env` file in the project root with your Jira credentials:

```bash
# .env
JIRA_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token_here
```

**How to get your Jira API token:**
1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "MCP Server")
4. Copy the generated token

### 2. Update Server Path (Important!)

**⚠️ CRITICAL:** You must update the `.env` file path in the server code to match your system.

Edit `src/server.ts` and update line 8:

```typescript
// Change this path to match your system
loadEnvFile('/Users/imranbeg/mcp-get-server/.env');
```

**For different systems:**
- **macOS/Linux**: `/full/path/to/your/jira-mcp/.env`
- **Windows**: `C:\\full\\path\\to\\your\\jira-mcp\\.env`

### 3. Rebuild After Path Update

After updating the path, rebuild the project:

```bash
npm run build
```

## Claude Desktop Setup

### 1. Locate Claude Desktop Config

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%\Claude\claude_desktop_config.json
```

### 2. Add MCP Server Configuration

Add this configuration to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "mcp-jira-server": {
      "command": "node",
      "args": ["/full/path/to/your/jira-mcp/dist/server.js"],
      "cwd": "/full/path/to/your/jira-mcp"
    }
  }
}
```

**⚠️ Update the paths** to match your system:
- Replace `/full/path/to/your/jira-mcp` with your actual project path
- Use forward slashes (`/`) even on Windows

### 3. Restart Claude Desktop

After updating the configuration, completely quit and restart Claude Desktop.

## Usage

Once configured, you can use these example prompts in Claude Desktop:

### Basic Issue Lookup

```
Get details for Jira issue PROJ-123
```

```
Show me information about ticket TASK-456
```

```
What's the status of issue BUG-789?
```

### Detailed Issue Information

```
Get comprehensive details for Jira issue PROJ-123 including description, assignee, and priority
```

```
Show me the full details for ticket TASK-456 with all available information
```

### Multiple Issues

```
Get details for these Jira issues: PROJ-123, TASK-456, BUG-789
```

### Issue Status Check

```
What's the current status and assignee for issue PROJ-123?
```

```
Check the priority and due date for ticket TASK-456
```

## Available Tools

### `get_jira_issue`

Fetches detailed information about a Jira issue.

**Parameters:**
- `issueKey` (string): The Jira issue key (e.g., PROJ-123, TASK-456)

**Returns:**
- Issue summary, description, status, assignee, reporter
- Priority, issue type, creation and update dates
- Direct link to the issue in Jira
- Structured JSON data for programmatic access

## Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Troubleshooting

### Server Not Loading Environment Variables

1. **Check the path in `src/server.ts`** - Make sure it points to your actual `.env` file location
2. **Rebuild the project** after changing the path:
   ```bash
   npm run build
   ```
3. **Verify `.env` file exists** and contains valid credentials

### Claude Desktop Not Connecting

1. **Check the config file paths** - Ensure all paths in `claude_desktop_config.json` are correct
2. **Restart Claude Desktop** completely
3. **Check Claude Desktop logs** for connection errors

### Jira API Errors

1. **Verify your API token** is valid and not expired
2. **Check your Jira URL** format (should include `https://`)
3. **Ensure your account** has access to the Jira instance

## Project Structure

```
jira-mcp/
├── src/
│   ├── server.ts          # Main MCP server implementation
│   └── load-env.ts        # Custom environment loader
├── dist/                  # Compiled JavaScript files
├── .env                   # Environment variables (create this)
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Review the [MCP documentation](https://modelcontextprotocol.io/)
3. Open an issue on GitHub

---

**Happy Jira integration with Claude! 🚀**