# Bridgework

Bridgework is a mutual-aid network prototype for turning an AI-related need or offer into a practical collaboration route.

## Run with Claude

The API key stays on your machine and is never sent to the browser or saved in this project.

```sh
ANTHROPIC_API_KEY="your-key" CLAUDE_MODEL="your-enabled-sonnet-model" npm start
```

Open `http://127.0.0.1:4174`.

## Deploy to Vercel

Vercel serves the static app and uses `api/route.mjs` for the Claude Route Maker. Deploy the project, then add these encrypted environment variables in the Vercel project settings before redeploying:

```text
ANTHROPIC_API_KEY
CLAUDE_MODEL
```

The Claude Route Maker uses one bounded request to produce:

- a plain-language collaboration route;
- the kind of person the user should seek, without inventing a real match;
- a 48-hour, human-reviewed experiment;
- share copy for an invitation; and
- a machine-readable agent mission with decision rights and safety limits.

The prototype falls back to a local example route when Claude is not configured. Keep signals free of client, personal, or confidential information.
