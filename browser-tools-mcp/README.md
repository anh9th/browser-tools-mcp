# Browser Tools MCP Server

A Model Context Protocol (MCP) server that provides AI-powered browser tools integration. This server works in conjunction with the Browser Tools Server to provide AI capabilities for browser debugging and analysis.

## Features

- MCP protocol implementation
- Browser console log access
- Network request analysis
- Screenshot capture capabilities
- Element selection and inspection
- Real-time browser state monitoring
- Configurable logs directory for storing logs and screenshots

## Installation

```bash
npx @agentdeskai/browser-tools-mcp
```

Or install globally:

```bash
npm install -g @agentdeskai/browser-tools-mcp
```

## Usage

1. First, make sure the Browser Tools Server is running:

```bash
npx @agentdeskai/browser-tools-server
```

2. Then start the MCP server:

```bash
npx @agentdeskai/browser-tools-mcp
```

3. The MCP server will connect to the Browser Tools Server and provide the following capabilities:

- Console log retrieval
- Network request monitoring
- Screenshot capture
- Element selection
- Browser state analysis

## MCP Functions

The server provides the following MCP functions:

- `mcp_getConsoleLogs` - Retrieve browser console logs
- `mcp_getConsoleErrors` - Get browser console errors
- `mcp_getNetworkErrors` - Get network error logs
- `mcp_getNetworkSuccess` - Get successful network requests
- `mcp_getNetworkLogs` - Get all network logs
- `mcp_getSelectedElement` - Get the currently selected DOM element

## Integration

This server is designed to work with AI tools and platforms that support the Model Context Protocol (MCP). It provides a standardized interface for AI models to interact with browser state and debugging information.

## Configuration

The MCP server provides configuration options through the Chrome extension interface:

### Logs Directory

You can set a custom directory for storing log files and resources. By default, logs are stored in:
- Windows: `C:\Users\<username>\Downloads\mcp-logs`
- macOS/Linux: `/home/<username>/Downloads/mcp-logs`

To change this:
1. Open the Chrome DevTools panel for the Browser Tools MCP
2. Enter your preferred directory path in the "Logs Settings" section
3. The changes will be applied immediately

### Screenshot Path

Similarly, you can configure where screenshots are saved:
1. Open the Chrome DevTools panel
2. Enter your preferred directory in the "Screenshot Settings" section

## License

MIT
