# Business integrations

## LLM provider

The live branch is configured by editing the trusted settings object in **Normalize input**:

- `llm_enabled`: set true only after selecting credentials and testing.
- `llm_url`: a trusted OpenAI-compatible chat-completion endpoint, including its full path.
- `llm_model`: a model available from your provider.

Select a **Header Auth** credential on **LLM extraction**. For OpenAI-compatible providers use header `Authorization` with value `Bearer YOUR_PROVIDER_TOKEN`. This is an intentional placeholder to enter in n8n's credential UI, not workflow JSON or a committed environment file. A local server may not require authentication; select no authentication only for that trusted local service. Docker containers cannot reach a host service at localhost; use a carefully restricted host gateway or another internal Compose service.

Provider URL/model are non-secret workflow settings. Docker connection settings and n8n secrets use environment variables. Provider keys stay in encrypted n8n credentials; if your deployment provisions them from environment variables, use a supported secret-management/provisioning mechanism rather than enabling global node environment access.

Requests demand JSON output. Lead output requires category, priority, bounded score, summary, and next action. Email output requires a known category, summary, and draft; human review is forced true even if the provider says otherwise. Invoice output passes through the same deterministic field/date/arithmetic validator as demo mode. A non-compatible provider needs an HTTP request/response adapter.

Do not send confidential business data to a provider without checking contractual terms, retention, region, and applicable privacy obligations. Treat prompts and messages as untrusted; model instructions alone are not a security boundary.

## Generic CRM and notifications

The lead workflow returns `crm_payload` and `notification` in demo mode. For live delivery:

1. Set administrator-controlled `crm_url` and `notification_url` in **Normalize input**. The default `.invalid` destinations cannot resolve.
2. Select independent Header Auth credentials on **CRM webhook** and **Notification webhook**. Keep least-privilege scopes.
3. Test with a sandbox system, including failures and duplicate submissions.
4. Set `delivery_enabled` true. Qualified leads route to sales; nurture and suspected spam remain explicitly marked review queues. The receiving endpoint must honor these routes rather than blindly creating sales opportunities.

For HubSpot or Pipedrive, replace **CRM webhook** with the relevant n8n node and map contact/company and classification fields. For Salesforce map a Lead plus your custom scoring fields. For Airtable map a record to the appropriate base/table. A custom CRM can consume the generic JSON directly. Receiving systems should implement idempotency and staff review of suspected spam.

Slack incoming webhooks commonly expect `{"text":"..."}`, so map `notification.message` to that body or use a Slack node with a credential. Microsoft Teams, Mattermost, or another notification endpoint may require their own envelope. Keep their URLs private and outside exported public workflows when they contain tokens.

## Email services and human review

Use a Gmail, Outlook, or IMAP trigger upstream and map sender, subject, and plain-text body to the webhook payload. Strip attachments and bound message size. For the existing Normalize node, an upstream mapping must place these fields at the root item or inside `body`.

The supplied workflow produces a draft and review queue only. Store the draft in a ticketing tool or approval inbox using a separately credentialed node. An approved email should be sent by a separate workflow whose approval state comes from an authenticated staff action, not from customer input or an LLM decision. Sending, approvals, and service OAuth are not implemented here.

## Invoice destinations

Add a conditional branch after **Validate invoice**. Route warnings to a staff review queue. Only send valid results to a generic HTTP endpoint or PostgreSQL node. Use credentialed nodes with parameterized queries; never concatenate fields into SQL. Prefer an invoice-number/vendor idempotency key and a transactional insert in the receiving service.
