#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "path";
import fs from "fs";
import os from "os";

// Create the MCP server with resources capability
const server = new McpServer({
  name: "Browser Tools MCP",
  version: "1.1.0",
}, {
  capabilities: {
    resources: {}
  }
});

// Function to get the port from the .port file
// function getPort(): number {
//   try {
//     const port = parseInt(fs.readFileSync(".port", "utf8"));
//     return port;
//   } catch (err) {
//     console.error("Could not read port file, defaulting to 3000");
//     return 3025;
//   }
// }

// const PORT = getPort();

const PORT = 3025;

// Function to get the logs directory from browser connector settings
async function getLogsDirectory(): Promise<string> {
  // Try multiple times with a delay between attempts
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Try to get the settings from the browser connector
      console.log(`Attempt ${retryCount + 1}/${maxRetries} to fetch settings from browser connector`);
      const response = await fetch(`http://127.0.0.1:${PORT}/settings`, {
        method: "GET",
      });

      if (response.ok) {
        const settings = await response.json();
        console.log("Retrieved settings from browser connector:", settings);
        if (settings && settings.logsDirectory && settings.logsDirectory.trim() !== '') {
          console.log(`Using logs directory from settings: ${settings.logsDirectory}`);
          return settings.logsDirectory;
        } else {
          console.log("Logs directory setting is empty or not set");
        }
      } else {
        console.log(`Failed to get settings, status: ${response.status}`);
      }
    } catch (error) {
      console.error(`Attempt ${retryCount + 1}/${maxRetries} failed:`, error);
    }

    // Wait before retrying
    if (retryCount < maxRetries - 1) {
      console.log("Waiting 2 seconds before retrying...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    retryCount++;
  }

  // Fallback options in order:
  // 1. Default platform-specific location
  const homeDir = os.homedir();
  const defaultLogsPath = path.join(homeDir, "Downloads", "mcp-logs");

  // 2. Use the hardcoded path as last resort
  const hardcodedPath = "D:\\hps-deploy\\mcp-logs";

  // Check if default path exists/is writable
  try {
    await fs.promises.access(defaultLogsPath, fs.constants.W_OK);
    console.log(`Using default logs path: ${defaultLogsPath}`);
    return defaultLogsPath;
  } catch (err) {
    console.log(`Default logs path ${defaultLogsPath} not accessible, using hardcoded path.`);
    return hardcodedPath;
  }
}

// Function to periodically check for settings updates
function startSettingsSync() {
  // Initial settings check
  syncSettings();

  // Check for settings updates every 30 seconds
  setInterval(syncSettings, 30000);
}

// Function to sync settings from the browser connector
async function syncSettings() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/settings`, {
      method: "GET",
    });

    if (response.ok) {
      const settings = await response.json();
      if (settings && settings.logsDirectory && settings.logsDirectory.trim() !== '') {
        // Only update if the directory has changed
        if (settings.logsDirectory !== logsDir) {
          console.log(`Updating logs directory from ${logsDir} to ${settings.logsDirectory}`);
          logsDir = settings.logsDirectory;

          // Create the directory if it doesn't exist
          if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
            console.log(`Created logs directory: ${logsDir}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error syncing settings:", error);
  }
}

// Initialize with a default path that will be overwritten
let logsDir = path.join(os.homedir(), "Downloads", "mcp-logs");
// Create the directory initially to ensure it exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Update to the configured path asynchronously
getLogsDirectory().then(dir => {
  logsDir = dir;
  console.log(`Using logs directory: ${logsDir}`);

  // Create the directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Start periodic settings synchronization
  startSettingsSync();
}).catch(err => {
  console.error("Error setting up logs directory:", err);
  // Fallback to hardcoded path in case of error
  logsDir = "D:\\hps-deploy\\mcp-logs";
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Start periodic settings synchronization even after error
  startSettingsSync();
});

// Helper function to create proper file:// URIs
function pathToFileUri(filePath: string): string {
  // Ensure path has correct forward slashes
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Windows paths need an extra slash at the beginning
  if (normalizedPath.startsWith('/')) {
    return `file://${normalizedPath}`;
  } else {
    return `file:///${normalizedPath}`;
  }
}

// Helper function to save data to a file and return resource info
async function saveDataToResource(data: any, prefix: string): Promise<{ uri: string, path: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${prefix}-${timestamp}.json`;
  const filePath = path.join(logsDir, filename);

  // Save the data to file
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');

  // Create a file URI that MCP can understand
  const uri = pathToFileUri(filePath);

  console.log(`=====================================`);
  console.log(`RESOURCE SAVED:`);
  console.log(`- File path: ${filePath}`);
  console.log(`- URI: ${uri}`);
  console.log(`- Size: ${Buffer.byteLength(JSON.stringify(data))} bytes`);
  console.log(`- Type: ${prefix}`);
  console.log(`=====================================`);

  return { uri, path: filePath };
}

// Implementation of file resources - use proper URI format
server.resource(
  "logs-directory",
  pathToFileUri(logsDir) + "/",
  async (uri: URL) => {
    try {
      console.log(`Resource requested: logs-directory`);
      console.log(`Directory URI: ${pathToFileUri(logsDir)}/`);
      console.log(`Physical path: ${logsDir}`);

      const files = await fs.promises.readdir(logsDir);
      console.log(`Found ${files.length} files in logs directory`);

      // Return a list of all log files as contents
      const contents = files
        .filter(file => file.endsWith('.json') || file.endsWith('.png'))
        .map(file => {
          const filePath = path.join(logsDir, file);
          const isJson = file.endsWith('.json');
          const fileUri = pathToFileUri(filePath);

          console.log(`Resource file: ${file} -> ${fileUri}`);

          return {
            uri: fileUri,
            mimeType: isJson ? 'application/json' : 'image/png',
            text: isJson ? fs.readFileSync(filePath, 'utf8') : `Image file at ${filePath}`,
          };
        });

      console.log(`Returning ${contents.length} resources`);
      return { contents };
    } catch (error) {
      console.error("Error listing resource directory:", error);
      throw new Error(`Failed to list resources: ${error}`);
    }
  }
);

// Direct file resource access with a more specific URI pattern
server.resource(
  "log-file",
  new ResourceTemplate(pathToFileUri(logsDir) + "/{filename}", { list: undefined }),
  async (uri: URL, variables: any) => {
    try {
      const filename = variables.filename;
      console.log(`Accessing log file: ${filename}`);
      const filePath = path.join(logsDir, filename);
      console.log(`Full file path: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.error(`Resource not found: ${filePath}`);
        throw new Error(`Resource not found: ${filePath}`);
      }

      const isJson = filename.endsWith('.json');
      const isPng = filename.endsWith('.png');

      if (!isJson && !isPng) {
        console.error(`Unsupported file type: ${filename}`);
        throw new Error(`Unsupported file type: ${filename}`);
      }

      if (isJson) {
        const content = fs.readFileSync(filePath, 'utf8');
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: content
          }]
        };
      } else {
        // For image files, we're not handling binary content reading here
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'image/png',
            text: `Image file at ${filePath}`
          }]
        };
      }
    } catch (error) {
      console.error("Error reading resource:", error);
      throw new Error(`Failed to read resource: ${error}`);
    }
  }
);

// Modified tools to save data as resources instead of returning directly

server.tool("getConsoleLogs", "Check our browser logs", async () => {
  try {
    console.log(`Fetching console logs from http://127.0.0.1:${PORT}/console-logs`);
    const response = await fetch(`http://127.0.0.1:${PORT}/console-logs`);
    const json = await response.json();

    // Save logs to file and get resource URI
    const resource = await saveDataToResource(json, "console-logs");
    console.log(`Console logs saved to ${resource.path}`);

    return {
      content: [
        {
          type: "text",
          text: `Console logs saved as resource.

RESOURCE INFO:
- File path: ${resource.path}
- URI: ${resource.uri}
- Type: console logs

To access as MCP resource, use the URI above.`
        }
      ]
    };
  } catch (error) {
    console.error(`Error fetching console logs: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: `Error fetching console logs: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

server.tool(
  "getConsoleErrors",
  "Check our browsers console errors",
  async () => {
    try {
      console.log(`Fetching console errors from http://127.0.0.1:${PORT}/console-errors`);
      const response = await fetch(`http://127.0.0.1:${PORT}/console-errors`);
      const json = await response.json();

      // Save logs to file and get resource URI
      const resource = await saveDataToResource(json, "console-errors");
      console.log(`Console errors saved to ${resource.path}`);

      return {
        content: [
          {
            type: "text",
            text: `Console errors saved as resource. Access at: ${resource.uri}`
          }
        ]
      };
    } catch (error) {
      console.error(`Error fetching console errors: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error fetching console errors: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Return all HTTP errors (4xx/5xx)
server.tool("getNetworkErrors", "Check our network ERROR logs", async () => {
  try {
    console.log(`Fetching network errors from http://127.0.0.1:${PORT}/network-errors`);
    const response = await fetch(`http://127.0.0.1:${PORT}/network-errors`);
    const json = await response.json();

    // Save logs to file and get resource URI
    const resource = await saveDataToResource(json, "network-errors");
    console.log(`Network errors saved to ${resource.path}`);

    return {
      content: [
        {
          type: "text",
          text: `Network errors saved as resource. Access at: ${resource.uri}`
        }
      ]
    };
  } catch (error) {
    console.error(`Error fetching network errors: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: `Error fetching network errors: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Return all XHR/fetch requests
server.tool("getNetworkLogs", "Check ALL our network logs", async () => {
  try {
    console.log(`Fetching network logs from http://127.0.0.1:${PORT}/all-xhr`);
    const response = await fetch(`http://127.0.0.1:${PORT}/all-xhr`);
    const json = await response.json();

    // Save logs to file and get resource URI
    const resource = await saveDataToResource(json, "network-logs");
    console.log(`Network logs saved to ${resource.path}`);

    return {
      content: [
        {
          type: "text",
          text: `Network logs saved as resource. Access at: ${resource.uri}`
        }
      ]
    };
  } catch (error) {
    console.error(`Error fetching network logs: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: `Error fetching network logs: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Modify the takeScreenshot tool to support both direct return and resource access
server.tool(
  "takeScreenshot",
  "Take a screenshot of the current browser tab",
  async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:${PORT}/capture-screenshot`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok && result.path) {
        // Copy the screenshot to our resources directory for MCP access
        const filename = path.basename(result.path);
        const destPath = path.join(logsDir, filename);

        try {
          // Read the original screenshot
          const imageData = await fs.promises.readFile(result.path);
          // Write it to our resources directory
          await fs.promises.writeFile(destPath, imageData);

          const uri = `file://${destPath}`;

          return {
            content: [
              {
                type: "text",
                text: `Screenshot saved as resource. Use Resources panel to view at: ${uri}`
              }
            ]
          };
        } catch (copyError) {
          console.error("Error copying screenshot to resources:", copyError);
          return {
            content: [
              {
                type: "text",
                text: `Screenshot saved to: ${result.path} (could not copy to resources)`
              }
            ]
          };
        }
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Error taking screenshot: ${result.error || "Unknown error"}`
            }
          ]
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to take screenshot: ${errorMessage}`
          }
        ]
      };
    }
  }
);

// Add new tool for getting selected element
server.tool(
  "getSelectedElement",
  "Get the selected element from the browser",
  async () => {
    const response = await fetch(`http://127.0.0.1:${PORT}/selected-element`);
    const json = await response.json();

    // Save selected element to file and get resource URI
    const resource = await saveDataToResource(json, "selected-element");

    return {
      content: [
        {
          type: "text",
          text: `Selected element saved as resource. Use Resources panel to view at: ${resource.uri}`
        }
      ]
    };
  }
);

// Add new tool for wiping logs
server.tool("wipeLogs", "Wipe all browser logs from memory", async () => {
  // First wipe the server logs
  const response = await fetch(`http://127.0.0.1:${PORT}/wipelogs`, {
    method: "POST",
  });
  const json = await response.json();

  // Also clean up resource files older than 1 hour
  try {
    const files = await fs.promises.readdir(logsDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    let deletedCount = 0;
    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.promises.stat(filePath);

      if (stats.mtime.getTime() < oneHourAgo) {
        await fs.promises.unlink(filePath);
        deletedCount++;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `${json.message} and ${deletedCount} resource files older than 1 hour were deleted.`
        }
      ]
    };
  } catch (error) {
    console.error("Error cleaning resource files:", error);
    return {
      content: [
        {
          type: "text",
          text: `${json.message} (but error cleaning resource files: ${error})`
        }
      ]
    };
  }
});

// Add a tool to check logs directory and debug resource access
server.tool("debugLogAccess", "Debug log file access", async () => {
  try {
    // List all files in the directory
    const files = await fs.promises.readdir(logsDir);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(logsDir, file);
        const stats = await fs.promises.stat(filePath);
        return {
          name: file,
          path: filePath,
          uri: pathToFileUri(filePath),
          size: stats.size,
          modifiedTime: stats.mtime.toISOString()
        };
      })
    );

    // Save this diagnostic info as a resource
    const diagnosticInfo = {
      logDirectory: logsDir,
      logDirectoryUri: pathToFileUri(logsDir),
      files: fileDetails,
      platform: process.platform,
      os: {
        type: os.type(),
        platform: os.platform(),
        release: os.release()
      },
      env: {
        APPDATA: process.env.APPDATA || 'not set',
        HOME: process.env.HOME || 'not set',
        cwd: process.cwd()
      }
    };

    // Save diagnostic info to file
    const resource = await saveDataToResource(diagnosticInfo, "mcp-diagnostics");

    return {
      content: [
        {
          type: "text",
          text: `MCP Diagnostics:
Log directory: ${logsDir}
Log directory URI: ${pathToFileUri(logsDir)}
Number of files: ${files.length}
Platform: ${process.platform}

Diagnostic details saved as resource. Access at: ${resource.uri}`
        }
      ]
    };
  } catch (error) {
    console.error(`Error in debug log access: ${error}`);
    return {
      content: [
        {
          type: "text",
          text: `Error debugging log access: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Start receiving messages on stdio
(async () => {
  try {
    const transport = new StdioServerTransport();

    // Ensure stdout is only used for JSON messages
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: any, encoding?: any, callback?: any) => {
      // Only allow JSON messages to pass through
      if (typeof chunk === "string" && !chunk.startsWith("{")) {
        return true; // Silently skip non-JSON messages
      }
      return originalStdoutWrite(chunk, encoding, callback);
    };

    await server.connect(transport);
  } catch (error) {
    console.error("Failed to initialize MCP server:", error);
    process.exit(1);
  }
})();
