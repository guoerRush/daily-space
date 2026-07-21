# Unresolved Issues

## Mobile Feishu messages do not write to the website

Status: blocked by the current website hosting endpoint.

What works:

- The local Feishu long-connection Worker starts successfully.
- The Worker reports `ws client ready`, so it can receive Feishu events.

What is blocked:

- The Worker cannot reach `https://daily-space-six.vercel.app/api/feishu/events` from the current network; requests time out.
- As a result, messages sent from mobile Feishu cannot be forwarded to the website or stored in the user's records.

Required resolution:

1. Deploy the website to Coze Cloud and obtain its public domain.
2. Run `scripts/set-feishu-website-url.cmd` and enter the Coze Cloud website domain.
3. Restart the Feishu Worker.
4. Generate a binding code in the website settings and send `绑定 <code>` to the Feishu app bot.
5. Verify a command such as `/工作 测试同步` appears in the Work section of the website.

The Worker must remain on a service that supports persistent connections. If Coze Cloud cannot host the Worker, keep it on a separate always-on service and point it to the Coze Cloud website domain.
