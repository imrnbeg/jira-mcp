import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetch } from "undici";

// Jira configuration from environment variables
const JIRA_URL = process.env.JIRA_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing required Jira environment variables:");
  console.error("- JIRA_URL: Your Jira instance URL (e.g., https://yourcompany.atlassian.net)");
  console.error("- JIRA_EMAIL: Your Jira email address");
  console.error("- JIRA_API_TOKEN: Your Jira API token");
  process.exit(1);
}

const mcp = new McpServer(
  {
    name: "mcp-jira-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Helper function to create Jira API headers
function getJiraHeaders(): Record<string, string> {
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// Register Jira get issue tool
mcp.registerTool(
  "get_jira_issue",
  {
    title: "Get Jira Issue",
    description: "Get detailed information about a Jira issue by its key (e.g., PROJ-123)",
    inputSchema: {
      issueKey: z.string().describe("The Jira issue key (e.g., PROJ-123, TASK-456)"),
    },
  },
  async (args: { issueKey: string }) => {
    try {
      const url = `${JIRA_URL}/rest/api/3/issue/${args.issueKey}`;
      const response = await fetch(url, {
        method: "GET",
        headers: getJiraHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch Jira issue ${args.issueKey}: ${response.status} ${response.statusText}\n${errorText}`,
            },
          ],
          isError: true,
        };
      }

      const issueData = await response.json() as any;
      
      // Extract key information from the issue
      const issue = issueData;
      const fields = issue.fields;
      
      const summary = fields.summary || 'No summary';
      const description = fields.description || 'No description';
      const status = fields.status?.name || 'Unknown status';
      const assignee = fields.assignee?.displayName || 'Unassigned';
      const reporter = fields.reporter?.displayName || 'Unknown reporter';
      const priority = fields.priority?.name || 'No priority';
      const issueType = fields.issuetype?.name || 'Unknown type';
      const created = fields.created ? new Date(fields.created).toLocaleDateString() : 'Unknown';
      const updated = fields.updated ? new Date(fields.updated).toLocaleDateString() : 'Unknown';
      
      // Format description (remove HTML tags if present)
      const cleanDescription = typeof description === 'string' 
        ? description.replace(/<[^>]*>/g, '').trim()
        : JSON.stringify(description);

      return {
        content: [
          {
            type: "text",
            text: `**${issue.key}: ${summary}**

**Status:** ${status}
**Type:** ${issueType}
**Priority:** ${priority}
**Assignee:** ${assignee}
**Reporter:** ${reporter}
**Created:** ${created}
**Updated:** ${updated}

**Description:**
${cleanDescription}

**Full Issue Data:** Available in structured content below.`,
          },
        ],
        structuredContent: {
          issueKey: issue.key,
          summary,
          description: cleanDescription,
          status,
          issueType,
          priority,
          assignee,
          reporter,
          created,
          updated,
          url: `${JIRA_URL}/browse/${issue.key}`,
          fullData: issueData,
        },
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching Jira issue ${args.issueKey}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// TODO: Future Jira tools to implement
// - search_jira_issues: Search for issues with JQL
// - create_jira_issue: Create new issues
// - update_jira_issue: Update existing issues
// - add_jira_comment: Add comments to issues
// - get_jira_projects: List available projects
// - get_jira_issue_types: Get issue types for a project
// - get_jira_priorities: Get available priorities
// - get_jira_statuses: Get available statuses
// - assign_jira_issue: Assign issues to users
// - transition_jira_issue: Move issues through workflow states

const transport = new StdioServerTransport();
mcp.connect(transport).catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
