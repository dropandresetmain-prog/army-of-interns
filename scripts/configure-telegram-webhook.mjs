import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!deploymentUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is required.");
}

const client = new ConvexHttpClient(deploymentUrl);
const configureWebhook = makeFunctionReference("telegram:configureWebhook");
const result = await client.action(configureWebhook, {});
console.log(
  JSON.stringify(
    {
      ok: result.ok,
      webhookUrl: result.webhookUrl,
      botUsername: result.botUsername ?? null,
    },
    null,
    2,
  ),
);
