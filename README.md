# GPT Image for Activepieces

Create a GPT Image task and retrieve the **same task ID** through Ace Data Cloud. The Piece has two actions: **Create GPT Image task** and **Get GPT Image task**. Submission returns an ID; the image is ready only after the lookup reports `succeeded`.

**Distribution:** Install `@acedatacloud/piece-gpt-image@0.1.0` as a custom Piece in your Activepieces instance. A public npm package does not automatically enter the shared Activepieces catalog. [中文指南](README.zh-CN.md)

## Install and connect

In Activepieces 0.92.2+, open **Platform Admin → Catalogue → Pieces → Install Piece → NPM Registry**. Enter `@acedatacloud/piece-gpt-image` and version `0.1.0`, then install it. Search for **GPT Image by Ace Data Cloud** when adding a flow action. Confirm the Ace Data Cloud logo and both actions.

Create a connection using an Ace Data Cloud API key with access to both `/openai/images/generations` and `/openai/tasks`. Enter only the key, without `Bearer `. Keep it in the connection, never in a flow export. Check current [pricing](https://platform.acedata.cloud/models) and balance before generation.

## First flow

1. Add **Create GPT Image task**. Enter a prompt, choose `gpt-image-2`, quality `low`, size `1024x1024`, and image count `1`.
2. Run creation **once** and save its `task_id`. The action uses `callback_url` to submit asynchronously and has no HTTP retry. If a timeout or 5xx occurs, inspect request history before submitting again: the task may already exist.
3. Add **Get GPT Image task**. Map its **Task ID** from the creation output. Query this same ID until `status=succeeded` or `failed`. Pending media is never returned as final output.
4. Open a URL from `media_urls` only after `success=true`. The lookup can alternatively use a trace ID if the original request supplied a custom trace ID and its task ID was lost. This creation action does not set a custom trace ID.

The [credential-free quickstart flow](https://raw.githubusercontent.com/AceDataCloud/GPTImageActivepieces/main/examples/gpt-image-quickstart.json) imports with both connections empty and the task-ID mapping intact. Add your own connection before running it. Its creation action has automatic retries disabled.

Image count is 1–10 and each successful image can incur a charge. `size` must use `WIDTHxHEIGHT`; the GPT Image 2 public guide gives current custom-size limits. A task lookup does not create or bill another image.

An isolated Activepieces CE 0.92.2 instance accepted the build archive and ran **Get GPT Image task** against an existing completed task. The flow returned `succeeded` and one final image URL. The creation action has not been used to submit a new paid image in this validation.

## Troubleshoot

| Result | Action |
| --- | --- |
| 401 or 403 | Check the API key, GPT Image access, and Allowed APIs for both paths. |
| 400 | Check the prompt, model, `WIDTHxHEIGHT` size, and image count. |
| `pending` | Wait and query the same task ID. Do not rerun creation. |
| 429 | Reduce concurrency and wait; do not automatically retry paid creation. |
| Creation timeout or 5xx | Inspect request history before another submission. |
| `failed` or missing task | Check the task or trace ID and retention window. |

The Piece sends chosen inputs and the API key only to `https://api.acedata.cloud`. It returns final media URLs and removes internal routing fields from task results. [Source](https://github.com/AceDataCloud/GPTImageActivepieces) · [Support](https://github.com/AceDataCloud/GPTImageActivepieces/issues) · dev@acedata.cloud.
