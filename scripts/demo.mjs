import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

export async function workflow(name) {
  if (!['lead-qualification', 'email-triage', 'invoice-extraction'].includes(name)) {
    throw new Error('Choose lead-qualification, email-triage, or invoice-extraction.');
  }
  return JSON.parse(await readFile(resolve(root, 'workflows', name + '.json'), 'utf8'));
}

export async function executeCode(flow, name, json, previous = {}) {
  const code = flow.nodes.find((item) => item.name === name);
  if (!code || code.type !== 'n8n-nodes-base.code') throw new Error('Unknown Code node: ' + name);
  const input = { first: () => ({ json }), all: () => [{ json }] };
  const lookup = (nodeName) => ({ first: () => ({ json: previous[nodeName] }) });
  const result = await new AsyncFunction('$input', '$', code.parameters.jsCode)(input, lookup);
  return result[0].json;
}

export async function runDemo(name, body) {
  const flow = await workflow(name);
  let data = await executeCode(flow, 'Normalize input', { body });
  data = await executeCode(flow, 'Demo processing', data);
  if (name === 'invoice-extraction') data = await executeCode(flow, 'Validate invoice', data);
  data = await executeCode(flow, 'Prepare delivery', data);
  const { integration, prompt, ...result } = data;
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [name, filename] = process.argv.slice(2);
    if (!filename) throw new Error('Usage: node scripts/demo.mjs WORKFLOW INPUT.json');
    const body = JSON.parse(await readFile(resolve(filename), 'utf8'));
    console.log(JSON.stringify(await runDemo(name, body), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
