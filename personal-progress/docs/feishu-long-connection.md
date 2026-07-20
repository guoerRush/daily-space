# Feishu long-connection worker

The website remains on Vercel. This separate worker maintains the outgoing long connection to Feishu, so Feishu never needs to reach a Vercel callback URL.

## Required variables

Configure these values in both places where noted. Do not put them in browser-visible variables beginning with `NEXT_PUBLIC_`.

| Variable | Vercel website | Long-connection worker |
| --- | --- | --- |
| `FEISHU_APP_ID` | Yes | Yes |
| `FEISHU_APP_SECRET` | Yes | Yes |
| `FEISHU_VERIFICATION_TOKEN` | Yes | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | No |
| `FEISHU_INGEST_SECRET` | Yes | Yes |
| `DAILY_SPACE_INGEST_URL` | No | Yes: `https://daily-space-six.vercel.app/api/feishu/events` |

`FEISHU_INGEST_SECRET` must be a newly generated, high-entropy secret. The two values must be identical.

## Feishu developer console

1. Open the application, then go to Event Subscriptions.
2. Select **Use long connection to receive callbacks**. Do not enter a request URL.
3. Subscribe to `im.message.receive_v1`.
4. Enable the bot capability, publish the application, then add the bot to the chat or send it a direct message.

## Railway deployment

1. Create a Railway project and select **Deploy from GitHub repository** for this project.
2. In the service variables, add all six worker variables shown in the table.
3. Keep exactly one replica. Feishu distributes each event to one connected client and multiple replicas make troubleshooting harder.
4. Railway reads `railway.toml`, builds `Dockerfile.feishu-worker`, and checks `/health`.
5. Confirm the deploy log contains `Feishu long-connection worker health endpoint listening` and no connection error.

After it is connected, generate a binding code in Daily Space settings and send `绑定 XXXXXXXX` to the Feishu bot. Then send `/ai 一条测试随记` to verify that it is written to the AI category.
