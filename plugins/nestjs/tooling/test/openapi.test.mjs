import { test } from 'node:test';
import assert from 'node:assert/strict';

import { lintDocument, stagedTriggers } from '../openapi.mjs';

const ok = { description: 'ok', content: { 'application/json': { schema: { type: 'object' } } } };

test('a complete document passes', () => {
  const doc = {
    security: [{ bearer: [] }],
    paths: {
      '/orders': {
        get: { summary: 'List orders', responses: { 200: ok, 401: { description: 'x' } } },
        post: { summary: 'Create', requestBody: { content: {} }, responses: { 201: ok, 401: { description: 'x' }, 422: { description: 'x' } } },
      },
      '/orders/{id}': { delete: { summary: 'Delete', responses: { 204: { description: 'x' }, 401: { description: 'x' } } } },
      '/health': { get: { summary: 'Health', security: [], responses: { 200: ok } } },
    },
  };
  assert.deepEqual(lintDocument(doc), []);
});

test('each missing piece is reported per operation', () => {
  const doc = {
    security: [{ bearer: [] }],
    paths: {
      '/a': { get: { responses: { 200: { description: 'untyped' } } } },
      '/b': { post: { operationId: 'createB', summary: 'B', responses: { 201: ok } } },
    },
  };
  assert.deepEqual(lintDocument(doc), [
    'GET /a: missing summary, typed 2xx response body, 401 response',
    'POST /b [createB]: missing 401 response, requestBody',
  ]);
});

test('without global security, operations are public unless they declare security', () => {
  const doc = { paths: { '/p': { get: { summary: 'P', responses: { 200: ok } } }, '/s': { get: { summary: 'S', security: [{ bearer: [] }], responses: { 200: ok } } } } };
  assert.deepEqual(lintDocument(doc), ['GET /s: missing 401 response']);
});

test('regeneration triggers match staged API sources only', () => {
  const triggers = ['^apps/api/src/.*\\.(controller|dto|schema|module)\\.ts$'];
  assert.deepEqual(stagedTriggers(['apps/api/src/orders/orders.controller.ts', 'apps/api/src/orders/helpers.ts', 'README.md'], triggers), ['apps/api/src/orders/orders.controller.ts']);
});
