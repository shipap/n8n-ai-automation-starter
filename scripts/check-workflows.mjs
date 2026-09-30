import { readFile, writeFile } from 'node:fs/promises';
import { workflow } from './demo.mjs';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

for (const name of ['lead-qualification', 'email-triage', 'invoice-extraction']) {
  const flow = await workflow(name);
  for (const node of flow.nodes) {
    if (node.type === 'n8n-nodes-base.code') {
      try {
        new AsyncFunction('$input', '$', node.parameters.jsCode);
      } catch (error) {
        throw new Error(name + ': invalid Code node ' + node.name + ': ' + error.message);
      }
    }
  }
  const names = new Set(flow.nodes.map((node) => node.name));
  if (names.size !== flow.nodes.length) throw new Error('Duplicate node names');
  if (flow.active) throw new Error('Exports must be inactive');
  const webhook = flow.nodes.find((node) => node.type === 'n8n-nodes-base.webhook');
  if (webhook.parameters.authentication !== 'headerAuth') throw new Error('Webhook requires header authentication');
  for (const [source, outputs] of Object.entries(flow.connections)) {
    if (!names.has(source)) throw new Error('Unknown source: ' + source);
    for (const branch of outputs.main) {
      for (const edge of branch) if (!names.has(edge.node)) throw new Error('Unknown target: ' + edge.node);
    }
  }
  const filename = new URL('../workflows/' + name + '.json', import.meta.url);
  const canonical = JSON.stringify(flow, null, 2) + '\n';
  if (process.argv.includes('--write')) await writeFile(filename, canonical);
  else if (await readFile(filename, 'utf8') !== canonical) throw new Error('Format mismatch: ' + name);
  console.log('PASS ' + name + ': JSON formatting, authentication, graph references, Code syntax');
}
