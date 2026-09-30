import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executeCode, runDemo, workflow } from '../scripts/demo.mjs';

const fixture = async (name) => JSON.parse(await readFile(new URL('../examples/' + name + '.json', import.meta.url)));

test('qualified lead is routed to sales with a notification preview', async () => {
  const result = await runDemo('lead-qualification', await fixture('lead'));
  assert.equal(result.route, 'sales_queue');
  assert.equal(result.classification.priority, 'high');
  assert.equal(result.notification.channel, 'sales-urgent');
  assert.equal(result.delivery_status, 'demo_preview');
  assert.ok(!('integration' in result));
});
test('limited budget leads enter nurture', async () => {
  const body = await fixture('lead');
  body.budget = 0; body.company_size = 1; body.requested_service = '';
  assert.equal((await runDemo('lead-qualification', body)).route, 'nurture_queue');
});
test('spam enters a separate review queue', async () => {
  const body = await fixture('lead'); body.message = 'Buy followers today';
  assert.equal((await runDemo('lead-qualification', body)).route, 'review_spam');
});
test('invalid lead email is rejected', async () => {
  const body = await fixture('lead'); body.email = 'invalid';
  await assert.rejects(runDemo('lead-qualification', body), /valid email/);
});
test('negative and non-finite budgets are rejected', async () => {
  for (const budget of [-1, 'not-a-number']) {
    const body = await fixture('lead'); body.budget = budget;
    await assert.rejects(runDemo('lead-qualification', body), /numeric|non-negative/);
  }
});
test('caller cannot enable paid providers or delivery', async () => {
  const body = await fixture('lead'); body.integration = { llm_enabled: true, delivery_enabled: true };
  const flow = await workflow('lead-qualification');
  const result = await executeCode(flow, 'Normalize input', { body });
  assert.equal(result.integration.llm_enabled, false);
  assert.equal(result.integration.delivery_enabled, false);
});
for (const [message, category] of [['Need pricing', 'sales'], ['Help with a broken item', 'support'], ['Invoice refund', 'billing'], ['Buy followers', 'spam'], ['Hello', 'other']]) {
  test('email classification: ' + category, async () => {
    const result = await runDemo('email-triage', { message });
    assert.equal(result.classification.category, category);
    assert.equal(result.classification.human_review_required, true);
    assert.equal(result.send_email, false);
  });
}
test('empty email body is rejected', async () => {
  await assert.rejects(runDemo('email-triage', {}), /required/);
});
test('fictional invoice normalizes and validates', async () => {
  const result = await runDemo('invoice-extraction', await fixture('invoice'));
  assert.equal(result.invoice.total, 1100);
  assert.deepEqual(result.validation, { valid: true, warnings: [] });
});
test('invoice arithmetic discrepancy is a warning', async () => {
  const body = await fixture('invoice'); body.invoice.total = 1500;
  const result = await runDemo('invoice-extraction', body);
  assert.equal(result.validation.valid, false);
  assert.match(result.validation.warnings.join(' '), /does not match/);
});
test('invoice impossible date and negative total are rejected', async () => {
  for (const overrides of [{ date: '2026-02-30' }, { total: -1 }]) {
    const body = await fixture('invoice'); Object.assign(body.invoice, overrides);
    await assert.rejects(runDemo('invoice-extraction', body));
  }
});
test('missing invoice amounts stay unknown', async () => {
  const body = await fixture('invoice'); delete body.invoice.total;
  const result = await runDemo('invoice-extraction', body);
  assert.equal(result.invoice.total, null);
  assert.equal(result.validation.valid, false);
});
test('invalid LLM output never reaches delivery', async () => {
  const flow = await workflow('lead-qualification');
  await assert.rejects(executeCode(flow, 'Validate LLM response', { choices: [{ message: { content: 'not json' } }] }, { 'Normalize input': {} }), /invalid JSON/);
});
test('real email provider cannot bypass human review', async () => {
  const flow = await workflow('email-triage');
  const base = await executeCode(flow, 'Normalize input', { body: { message: 'Hello' } });
  const result = await executeCode(flow, 'Validate LLM response', { choices: [{ message: { content: JSON.stringify({ category: 'other', summary: 'Hello', draft_response: 'Hi', human_review_required: false }) } }] }, { 'Normalize input': base });
  assert.equal(result.classification.human_review_required, true);
});

test('invoice rejects booleans, arrays, objects and excessive amounts', async () => {
  for (const total of [true, [], {}, 1e300]) {
    const body = await fixture('invoice'); body.invoice.total = total;
    await assert.rejects(runDemo('invoice-extraction', body));
  }
});
test('malformed invoice line item has a useful error', async () => {
  const body = await fixture('invoice'); body.invoice.line_items = [null];
  await assert.rejects(runDemo('invoice-extraction', body), /line item must be an object/);
});
test('unknown line tax remains null and is marked for review', async () => {
  const body = await fixture('invoice'); delete body.invoice.line_items[0].tax;
  const result = await runDemo('invoice-extraction', body);
  assert.equal(result.invoice.line_items[0].tax, null);
  assert.match(result.validation.warnings.join(' '), /line tax is missing/);
});
test('boolean lead budget is rejected', async () => {
  const body = await fixture('lead'); body.budget = true;
  await assert.rejects(runDemo('lead-qualification', body), /must be numeric/);
});
