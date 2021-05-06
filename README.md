README

# Good Day Bot

## Development

1. Install ngrok and authenticate

2. Create a .env file with:

```
GH_API_KEY=
SLACK_SIGNING_SECRET=
SLACK_BOT_TOKEN=
PG_CONN_STRING=
```

3. Start the server and ngrok

`yarn install`

`yarn dev`

In a new tab: `ngrok http 3000 --hostname octo-devex.ngrok.io`