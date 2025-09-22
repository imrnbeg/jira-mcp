import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fetch } from "undici";
import { loadEnvFile } from "./load-env.js";

// Load environment variables from .env file silently
loadEnvFile('/Users/imranbeg/mcp-get-server/.env');

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

// List Jira projects
mcp.registerTool(
  "list_jira_projects",
  {
    title: "List Jira Projects",
    description: "List accessible Jira projects with pagination and optional query.",
    inputSchema: {
      query: z.string().optional().describe("Optional search query for project key/name"),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
    },
  },
  async (args: { query?: string; startAt?: number; maxResults?: number }) => {
    try {
      const params = new URLSearchParams();
      if (args.query) params.set("query", args.query);
      if (typeof args.startAt === "number") params.set("startAt", String(args.startAt));
      if (typeof args.maxResults === "number") params.set("maxResults", String(args.maxResults));
      const url = `${JIRA_URL}/rest/api/3/project/search${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to list projects: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const data = await response.json() as any;
      const projects = (data.values || []).map((p: any) => ({ id: p.id, key: p.key, name: p.name, lead: p.lead?.displayName, projectType: p.projectTypeKey }));
      return {
        content: [{ type: "text", text: `Found ${data.total ?? projects.length} projects (showing ${projects.length}).` }],
        structuredContent: { total: data.total ?? projects.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? projects.length, projects },
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error listing projects: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Get Jira project details
mcp.registerTool(
  "get_jira_project",
  {
    title: "Get Jira Project Details",
    description: "Get full metadata for a Jira project by key or ID.",
    inputSchema: {
      projectIdOrKey: z.string().describe("Project key or ID (e.g., PROJ or 10001)"),
    },
  },
  async (args: { projectIdOrKey: string }) => {
    try {
      const url = `${JIRA_URL}/rest/api/3/project/${encodeURIComponent(args.projectIdOrKey)}`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to get project ${args.projectIdOrKey}: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const project = await response.json() as any;
      return {
        content: [{ type: "text", text: `Project ${project.key}: ${project.name}` }],
        structuredContent: { id: project.id, key: project.key, name: project.name, url: `${JIRA_URL}/jira/software/c/projects/${project.key}`, lead: project.lead, components: project.components, issueTypes: project.issueTypes, raw: project },
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting project ${args.projectIdOrKey}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Get project issue types and statuses
mcp.registerTool(
  "get_project_statuses",
  {
    title: "Get Project Issue Types and Statuses",
    description: "Get available statuses for each issue type in a project.",
    inputSchema: {
      projectIdOrKey: z.string().describe("Project key or ID (e.g., PROJ or 10001)"),
    },
  },
  async (args: { projectIdOrKey: string }) => {
    try {
      const url = `${JIRA_URL}/rest/api/3/project/${encodeURIComponent(args.projectIdOrKey)}/statuses`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to get statuses for ${args.projectIdOrKey}: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const arr = await response.json() as any[];
      const summary = arr.map((t: any) => ({ issueType: t.name, statuses: (t.statuses || []).map((s: any) => s.name) }));
      return { content: [{ type: "text", text: `Found ${summary.length} issue types with statuses.` }], structuredContent: { projectIdOrKey: args.projectIdOrKey, types: summary, raw: arr } };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting project statuses for ${args.projectIdOrKey}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// Search Jira issues using JQL
mcp.registerTool(
  "search_jira_issues",
  {
    title: "Search Jira Issues (JQL)",
    description: "Search issues using JQL with pagination and field selection.",
    inputSchema: {
      jql: z.string().describe("JQL query (e.g., project=PROJ AND status=\"In Progress\")"),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
      fields: z.string().optional().describe("Comma-separated fields to return (default: key,summary,status,assignee,priority,issuetype,updated)")
    },
  },
  async (args: { jql: string; startAt?: number; maxResults?: number; fields?: string }) => {
    try {
      const body: any = {
        jql: args.jql,
        startAt: args.startAt ?? 0,
        maxResults: args.maxResults ?? 50,
        fields: (args.fields ? args.fields.split(",").map(s => s.trim()) : ["key","summary","status","assignee","priority","issuetype","updated"]).filter(Boolean)
      };
      const url = `${JIRA_URL}/rest/api/3/search`;
      const response = await fetch(url, { method: "POST", headers: getJiraHeaders(), body: JSON.stringify(body) });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to search issues: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const data = await response.json() as any;
      const items = (data.issues || []).map((it: any) => ({ key: it.key, summary: it.fields?.summary, status: it.fields?.status?.name, assignee: it.fields?.assignee?.displayName, priority: it.fields?.priority?.name, type: it.fields?.issuetype?.name, updated: it.fields?.updated, url: `${JIRA_URL}/browse/${it.key}` }));
      return { content: [{ type: "text", text: `Found ${data.total ?? items.length} issues (showing ${items.length}).` }], structuredContent: { total: data.total ?? items.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? items.length, issues: items, raw: data } };
    } catch (error) {
      return { content: [{ type: "text", text: `Error searching issues: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// List issues in a project (JQL helper)
mcp.registerTool(
  "list_project_issues",
  {
    title: "List Issues in Project",
    description: "List issues for a project with optional JQL tail filters.",
    inputSchema: {
      projectKey: z.string().describe("Project key (e.g., PROJ)"),
      jqlTail: z.string().optional().describe("Optional extra JQL, e.g., AND status=\"In Progress\""),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
    },
  },
  async (args: { projectKey: string; jqlTail?: string; startAt?: number; maxResults?: number }) => {
    const jql = `project=${args.projectKey}${args.jqlTail ? " " + args.jqlTail : ""}`;
    return await (async () => {
      try {
        const body: any = { jql, startAt: args.startAt ?? 0, maxResults: args.maxResults ?? 50, fields: ["key","summary","status","assignee","priority","issuetype","updated"] };
        const response = await fetch(`${JIRA_URL}/rest/api/3/search`, { method: "POST", headers: getJiraHeaders(), body: JSON.stringify(body) });
        if (!response.ok) {
          const errorText = await response.text();
          return { content: [{ type: "text", text: `Failed to list project issues: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
        }
        const data = await response.json() as any;
        const items = (data.issues || []).map((it: any) => ({ key: it.key, summary: it.fields?.summary, status: it.fields?.status?.name, assignee: it.fields?.assignee?.displayName, priority: it.fields?.priority?.name, type: it.fields?.issuetype?.name, updated: it.fields?.updated, url: `${JIRA_URL}/browse/${it.key}` }));
        return { content: [{ type: "text", text: `Found ${data.total ?? items.length} issues in ${args.projectKey} (showing ${items.length}).` }], structuredContent: { total: data.total ?? items.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? items.length, issues: items, projectKey: args.projectKey, raw: data } };
      } catch (error) {
        return { content: [{ type: "text", text: `Error listing issues for ${args.projectKey}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    })();
  }
);

// Get issue comments
mcp.registerTool(
  "get_jira_issue_comments",
  {
    title: "Get Jira Issue Comments",
    description: "Retrieve comments for a Jira issue with pagination.",
    inputSchema: {
      issueIdOrKey: z.string().describe("Issue key or ID (e.g., PROJ-123)"),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
    },
  },
  async (args: { issueIdOrKey: string; startAt?: number; maxResults?: number }) => {
    try {
      const params = new URLSearchParams();
      if (typeof args.startAt === "number") params.set("startAt", String(args.startAt));
      if (typeof args.maxResults === "number") params.set("maxResults", String(args.maxResults));
      const url = `${JIRA_URL}/rest/api/3/issue/${encodeURIComponent(args.issueIdOrKey)}/comment${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to get comments for ${args.issueIdOrKey}: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const data = await response.json() as any;
      const comments = (data.comments || []).map((c: any) => ({ id: c.id, author: c.author?.displayName, created: c.created, updated: c.updated, body: typeof c.body === 'string' ? c.body : JSON.stringify(c.body) }));
      return { content: [{ type: "text", text: `Found ${data.total ?? comments.length} comments (showing ${comments.length}).` }], structuredContent: { issueIdOrKey: args.issueIdOrKey, total: data.total ?? comments.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? comments.length, comments, raw: data } };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting comments for ${args.issueIdOrKey}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// List boards
mcp.registerTool(
  "list_boards",
  {
    title: "List Boards",
    description: "List Jira boards with optional type and project filter.",
    inputSchema: {
      type: z.enum(["scrum","kanban"]).optional().describe("Board type filter"),
      projectKeyOrId: z.string().optional().describe("Filter boards by project key or ID"),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
    },
  },
  async (args: { type?: "scrum"|"kanban"; projectKeyOrId?: string; startAt?: number; maxResults?: number }) => {
    try {
      const params = new URLSearchParams();
      if (args.type) params.set("type", args.type);
      if (args.projectKeyOrId) params.set("projectKeyOrId", args.projectKeyOrId);
      if (typeof args.startAt === "number") params.set("startAt", String(args.startAt));
      if (typeof args.maxResults === "number") params.set("maxResults", String(args.maxResults));
      const url = `${JIRA_URL}/rest/agile/1.0/board${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to list boards: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const data = await response.json() as any;
      const boards = (data.values || []).map((b: any) => ({ id: b.id, name: b.name, type: b.type, location: b.location }));
      return { content: [{ type: "text", text: `Found ${data.total ?? boards.length} boards (showing ${boards.length}).` }], structuredContent: { total: data.total ?? boards.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? boards.length, boards, raw: data } };
    } catch (error) {
      return { content: [{ type: "text", text: `Error listing boards: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// List sprints on a board
mcp.registerTool(
  "list_board_sprints",
  {
    title: "List Board Sprints",
    description: "List sprints for a given board with optional state filter.",
    inputSchema: {
      boardId: z.number().int().describe("Board ID"),
      state: z.enum(["active","future","closed"]).optional().describe("Sprint state filter"),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
    },
  },
  async (args: { boardId: number; state?: "active"|"future"|"closed"; startAt?: number; maxResults?: number }) => {
    try {
      const params = new URLSearchParams();
      if (args.state) params.set("state", args.state);
      if (typeof args.startAt === "number") params.set("startAt", String(args.startAt));
      if (typeof args.maxResults === "number") params.set("maxResults", String(args.maxResults));
      const url = `${JIRA_URL}/rest/agile/1.0/board/${args.boardId}/sprint${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to list sprints for board ${args.boardId}: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const data = await response.json() as any;
      const sprints = (data.values || []).map((s: any) => ({ id: s.id, name: s.name, state: s.state, startDate: s.startDate, endDate: s.endDate, completeDate: s.completeDate }));
      return { content: [{ type: "text", text: `Found ${data.total ?? sprints.length} sprints (showing ${sprints.length}).` }], structuredContent: { total: data.total ?? sprints.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? sprints.length, boardId: args.boardId, sprints, raw: data } };
    } catch (error) {
      return { content: [{ type: "text", text: `Error listing sprints for board ${args.boardId}: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  }
);

// List issues in a sprint
mcp.registerTool(
  "list_sprint_issues",
  {
    title: "List Sprint Issues",
    description: "List issues in a given sprint with pagination.",
    inputSchema: {
      sprintId: z.number().int().describe("Sprint ID"),
      startAt: z.number().int().min(0).optional().describe("Pagination start index (default 0)"),
      maxResults: z.number().int().min(1).max(100).optional().describe("Page size (1-100, default 50)"),
      jql: z.string().optional().describe("Optional additional JQL to filter sprint issues"),
    },
  },
  async (args: { sprintId: number; startAt?: number; maxResults?: number; jql?: string }) => {
    try {
      const params = new URLSearchParams();
      if (typeof args.startAt === "number") params.set("startAt", String(args.startAt));
      if (typeof args.maxResults === "number") params.set("maxResults", String(args.maxResults));
      if (args.jql) params.set("jql", args.jql);
      const url = `${JIRA_URL}/rest/agile/1.0/sprint/${args.sprintId}/issue${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { method: "GET", headers: getJiraHeaders() });
      if (!response.ok) {
        const errorText = await response.text();
        return { content: [{ type: "text", text: `Failed to list sprint issues: ${response.status} ${response.statusText}\n${errorText}` }], isError: true };
      }
      const data = await response.json() as any;
      const items = (data.issues || []).map((it: any) => ({ key: it.key, summary: it.fields?.summary, status: it.fields?.status?.name, assignee: it.fields?.assignee?.displayName, priority: it.fields?.priority?.name, type: it.fields?.issuetype?.name, updated: it.fields?.updated, url: `${JIRA_URL}/browse/${it.key}` }));
      return { content: [{ type: "text", text: `Found ${data.total ?? items.length} issues in sprint ${args.sprintId} (showing ${items.length}).` }], structuredContent: { sprintId: args.sprintId, total: data.total ?? items.length, startAt: data.startAt ?? 0, maxResults: data.maxResults ?? items.length, issues: items, raw: data } };
    } catch (error) {
      return { content: [{ type: "text", text: `Error listing sprint issues: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
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