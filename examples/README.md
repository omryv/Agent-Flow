# AgentFlow Example Traces

This directory contains example trace files in various formats supported by AgentFlow.

## Available Examples

| File | Format | Description |
|------|--------|-------------|
| `simple.agentflow.json` | Native AgentFlow | 4-node RAG pipeline with one counterfactual scenario |
| `langsmith.json` | LangSmith | Document QA chain with nested child runs and token usage |
| `langfuse.json` | LangFuse | Customer support query with observation-based trace |
| `weave.json` | W&B Weave | Multi-step sentiment analysis agent with nested children |

## Loading Examples

### Using the AgentFlow UI

1. Open AgentFlow in your browser
2. Click the Import button or press `Cmd+I` / `Ctrl+I`
3. Select any of the example JSON files from this directory
4. The trace will be parsed, validated, and rendered as an interactive graph

### Command Line Validation

You can validate that an example file passes schema validation using Node.js:

```bash
node -e "
const fs = require('fs');
const obj = JSON.parse(fs.readFileSync('examples/simple.agentflow.json', 'utf8'));
console.log('File loaded:', obj.name);
console.log('Nodes:', obj.nodes.length);
console.log('Edges:', obj.edges.length);
"
```

### Testing Adapter Imports

The LangSmith, LangFuse, and Weave examples are automatically converted to the native AgentFlow schema on import. Each adapter:

- Detects the format based on specific fields (`run_type`, `observations`, or `op_name`)
- Recursively walks the trace structure
- Infers node roles from type and name keywords
- Accumulates token counts from various usage metadata fields
- Produces a validated AgentFlow run object

## File Size Limits

AgentFlow enforces a 2 MB import limit for JSON files. All examples in this directory are well below this limit. The SafeStore persistence layer has a 4 MB cap for the entire session state.

## Schema Reference

See the main README.md for full schema documentation. Key constraints:

- Node/run/edge IDs must match `/^[A-Za-z0-9_-]{1,80}$/`
- Node names max 200 characters
- Node content max 10,000 characters
- Max 500 nodes per run
- Max 2,000 edges per run
