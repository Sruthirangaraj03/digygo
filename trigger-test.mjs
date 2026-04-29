// Automation trigger test — tests every trigger type end-to-end via API
// Usage: node trigger-test.mjs

const BASE = 'http://localhost:4000';
const TOKEN_KEY = 'token';
const TENANT_ID = '87789a9e-7002-4ccd-9318-05a530fcb50f';
const DELAY = 1800; // ms to wait after firing trigger before checking

let token = '';
let pipelineId = '';
let stageId = '';
let stage2Id = '';
let leadId = '';
let contactId = '';
let calEventId = '';
let customFormSlug = '';

const results = [];

function log(msg) { process.stdout.write(msg + '\n'); }

async function api(method, path, body, raw = false) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${BASE}${path}`, opts);
  if (raw) return r;
  return r.json().catch(() => ({ _status: r.status }));
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// Create a workflow with a single trigger + add_tag action, return its id
async function createWorkflow(triggerKey, extraConfig = {}) {
  const name = `__TEST_${triggerKey}_${Date.now()}`;
  const nodes = [
    { id: 'trig', type: 'trigger', actionType: triggerKey, label: 'Trigger', config: extraConfig },
    { id: 'act1', type: 'action', actionType: 'add_tag', label: 'Add Tag',
      config: { tags: [`wf-fired-${triggerKey}`] } },
  ];
  const r = await api('POST', '/api/workflows', { name, nodes, status: 'active' });
  return r.id ?? null;
}

// Check if a workflow has any completed executions
async function checkFired(wfId) {
  const r = await api('GET', `/api/workflows/${wfId}`);
  return {
    completed: r.completed ?? 0,
    failed: r.failed ?? 0,
    skipped: r.skipped ?? 0,
    total: r.total_contacts ?? 0,
  };
}

async function deleteWorkflow(wfId) {
  await api('DELETE', `/api/workflows/${wfId}`).catch(() => null);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
async function setup() {
  // Login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'apple@gmail.com', password: 'Test@123' }),
  }).then(r => r.json());
  token = loginRes[TOKEN_KEY];
  if (!token) throw new Error('Login failed: ' + JSON.stringify(loginRes));
  log('✓ Logged in');

  // Get pipeline
  const pipelines = await api('GET', '/api/pipelines');
  const pipeline = pipelines[0];
  pipelineId = pipeline.id;
  stageId = pipeline.stages[0]?.id;
  stage2Id = pipeline.stages[1]?.id ?? stageId;
  log(`✓ Pipeline: ${pipeline.name} — stages: ${pipeline.stages.map(s => s.name).join(', ')}`);

  // Create test lead
  const leadRes = await api('POST', '/api/leads', {
    name: `Trigger Test Lead ${Date.now()}`,
    phone: `9${Math.floor(Math.random()*900000000+100000000)}`,
    email: `trigtest${Date.now()}@test.com`,
    pipeline_id: pipelineId,
    stage_id: stageId,
  });
  leadId = leadRes.id;
  log(`✓ Test lead created: ${leadId}`);

  // Create test contact
  const contactRes = await api('POST', '/api/contacts', {
    name: 'Trigger Test Contact',
    phone: `8${Math.floor(Math.random()*900000000+100000000)}`,
    email: `trigcontact${Date.now()}@test.com`,
    lead_id: leadId,
  });
  contactId = contactRes.id;
  log(`✓ Test contact created: ${contactId}`);

  // Get or create a custom form slug
  const forms = await api('GET', '/api/forms');
  if (forms.length > 0) {
    customFormSlug = forms[0].slug;
    log(`✓ Using custom form: ${customFormSlug}`);
  } else {
    const formRes = await api('POST', '/api/forms', {
      name: 'Trigger Test Form',
      fields: [
        { label: 'Full Name', type: 'text', mapTo: 'name', required: true },
        { label: 'Phone', type: 'tel', mapTo: 'phone', required: false },
      ],
      pipeline_id: pipelineId,
      stage_id: stageId,
    });
    customFormSlug = formRes.slug;
    log(`✓ Custom form created: ${customFormSlug}`);
  }

  // Create a calendar event for appointment triggers
  const now = new Date();
  const start = new Date(now.getTime() + 3600000).toISOString();
  const end   = new Date(now.getTime() + 7200000).toISOString();
  const eventRes = await api('POST', '/api/calendar', {
    title: 'Trigger Test Appointment',
    start_time: start,
    end_time: end,
    type: 'appointment',
    lead_id: leadId,
  });
  calEventId = eventRes.id;
  log(`✓ Test calendar event created: ${calEventId}`);
}

// ── Test each trigger ─────────────────────────────────────────────────────────

async function testTrigger(key, label, fireFn, config = {}) {
  process.stdout.write(`\nTesting [${key}] "${label}" ... `);
  let wfId;
  try {
    wfId = await createWorkflow(key, config);
    if (!wfId) { results.push({ key, label, status: '❌ FAIL', reason: 'Could not create workflow' }); log('workflow creation failed'); return; }

    await fireFn();
    await wait(DELAY);

    const stats = await checkFired(wfId);
    if (stats.completed > 0) {
      results.push({ key, label, status: '✅ FIRED', reason: `${stats.completed} execution(s) completed` });
      log(`✅ FIRED (${stats.completed} completed)`);
    } else if (stats.skipped > 0) {
      results.push({ key, label, status: '⚠️  SKIPPED', reason: `${stats.skipped} execution(s) skipped` });
      log(`⚠️  SKIPPED (${stats.skipped} skipped — check condition filtering)`);
    } else if (stats.failed > 0) {
      results.push({ key, label, status: '❌ ERRORED', reason: `${stats.failed} execution(s) failed` });
      log(`❌ ERRORED (${stats.failed} failed)`);
    } else {
      results.push({ key, label, status: '❌ NOT FIRED', reason: 'No executions recorded after trigger' });
      log('❌ NOT FIRED');
    }
  } catch (err) {
    results.push({ key, label, status: '❌ EXCEPTION', reason: err.message });
    log(`❌ EXCEPTION: ${err.message}`);
  } finally {
    if (wfId) await deleteWorkflow(wfId);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await setup();
    log('\n─── Running trigger tests ───────────────────────────────────────────');

    // 1. opt_in_form — submit via public form endpoint
    await testTrigger('opt_in_form', 'Custom Form Submitted', async () => {
      await fetch(`${BASE}/api/public/forms/${customFormSlug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { 'Full Name': `Form Test ${Date.now()}`, Phone: '9123456789' } }),
      });
    });

    // 2. meta_form — direct workflow trigger using test endpoint if available, or just check it's not dead
    await testTrigger('meta_form', 'Meta Form Submitted', async () => {
      // Simulate via triggerWorkflows test endpoint if present
      await api('POST', '/api/workflows/fire-test', { trigger: 'meta_form', lead_id: leadId }).catch(() => null);
    });

    // 3. product_enquired — no backend implementation, just test
    await testTrigger('product_enquired', 'Product Enquired', async () => {
      await api('POST', '/api/workflows/fire-test', { trigger: 'product_enquired', lead_id: leadId }).catch(() => null);
    });

    // 4. lead_created — create a new lead
    await testTrigger('lead_created', 'Added to Pipeline', async () => {
      await api('POST', '/api/leads', {
        name: `New Lead Trigger ${Date.now()}`,
        phone: `7${Math.floor(Math.random()*900000000+100000000)}`,
        pipeline_id: pipelineId,
        stage_id: stageId,
      });
    });

    // 5. stage_changed — patch lead to a different stage
    await testTrigger('stage_changed', 'Stage Changed', async () => {
      await api('PATCH', `/api/leads/${leadId}`, { stage_id: stage2Id });
    });

    // 6. notes_added — add a note
    await testTrigger('notes_added', 'Notes Added', async () => {
      await api('POST', `/api/leads/${leadId}/notes`, { title: 'Test Note', content: 'Trigger test note' });
    });

    // 7. follow_up — create a follow-up
    await testTrigger('follow_up', 'Follow Up Created', async () => {
      await api('POST', `/api/leads/${leadId}/followups`, {
        title: 'Test Follow-up',
        due_at: new Date(Date.now() + 86400000).toISOString(),
      });
    });

    // 8. contact_created — create another contact
    await testTrigger('contact_created', 'Contact Created', async () => {
      await api('POST', '/api/contacts', {
        name: 'New Contact Trigger Test',
        phone: `6${Math.floor(Math.random()*900000000+100000000)}`,
        email: `newcontact${Date.now()}@test.com`,
      });
    });

    // 9. contact_updated — update existing contact
    await testTrigger('contact_updated', 'Contact Updated', async () => {
      await api('PATCH', `/api/contacts/${contactId}`, { name: 'Updated Contact Name' });
    });

    // 10. contact_tagged — add a tag to contact
    await testTrigger('contact_tagged', 'Contact Tagged', async () => {
      await api('PATCH', `/api/contacts/${contactId}`, { tags: ['trigger-test-tag'] });
    });

    // 11. appointment_booked — create a new calendar event with lead_id
    await testTrigger('appointment_booked', 'Appointment Booked', async () => {
      const start = new Date(Date.now() + 7200000).toISOString();
      const end   = new Date(Date.now() + 10800000).toISOString();
      await api('POST', '/api/calendar', {
        title: 'Booked Appointment Test',
        start_time: start, end_time: end,
        type: 'appointment', lead_id: leadId,
      });
    });

    // 12. appointment_cancelled — update event status to cancelled
    await testTrigger('appointment_cancelled', 'Appointment Cancelled', async () => {
      await api('PATCH', `/api/calendar/${calEventId}`, { status: 'cancelled' });
    });

    // Re-create event for next tests (it was cancelled)
    const start2 = new Date(Date.now() + 3600000).toISOString();
    const end2   = new Date(Date.now() + 7200000).toISOString();
    const newEvt = await api('POST', '/api/calendar', {
      title: 'Re-created Appointment', start_time: start2, end_time: end2,
      type: 'appointment', lead_id: leadId,
    });
    calEventId = newEvt.id ?? calEventId;

    // 13. appointment_noshow
    await testTrigger('appointment_noshow', 'No-Show Appointment', async () => {
      await api('PATCH', `/api/calendar/${calEventId}`, { status: 'no-show' });
    });

    // Re-create again
    const start3 = new Date(Date.now() + 3600000).toISOString();
    const end3   = new Date(Date.now() + 7200000).toISOString();
    const newEvt2 = await api('POST', '/api/calendar', {
      title: 'Re-created Appointment 2', start_time: start3, end_time: end3,
      type: 'appointment', lead_id: leadId,
    });
    calEventId = newEvt2.id ?? calEventId;

    // 14. appointment_showup
    await testTrigger('appointment_showup', 'Show Up Appointment', async () => {
      await api('PATCH', `/api/calendar/${calEventId}`, { status: 'completed' });
    });

    // Re-create for rescheduled
    const start4 = new Date(Date.now() + 3600000).toISOString();
    const end4   = new Date(Date.now() + 7200000).toISOString();
    const newEvt3 = await api('POST', '/api/calendar', {
      title: 'Re-created Appointment 3', start_time: start4, end_time: end4,
      type: 'appointment', lead_id: leadId,
    });
    calEventId = newEvt3.id ?? calEventId;

    // 15. appointment_rescheduled — status 'rescheduled' (may not be in backend triggerMap)
    await testTrigger('appointment_rescheduled', 'Appointment Rescheduled', async () => {
      await api('PATCH', `/api/calendar/${calEventId}`, { status: 'rescheduled' });
    });

    // 16. inbound_message — backend-only WhatsApp trigger, can't test without real WhatsApp webhook
    results.push({ key: 'inbound_message', label: 'WhatsApp Inbound Message', status: '⚠️  SKIPPED', reason: 'Requires live WhatsApp webhook — not testable locally without ngrok+Meta' });
    log('\nSkipping [inbound_message] — requires live WhatsApp webhook');

  } catch (err) {
    log(`\n❌ Setup failed: ${err.message}`);
    process.exit(1);
  }

  // ── Print report ──────────────────────────────────────────────────────────
  log('\n\n══════════════════════════════════════════════════════════════');
  log('  TRIGGER TEST REPORT');
  log('══════════════════════════════════════════════════════════════');
  log(`${'Trigger'.padEnd(28)} ${'Label'.padEnd(28)} Status`);
  log('─'.repeat(80));
  for (const r of results) {
    log(`${r.key.padEnd(28)} ${r.label.padEnd(28)} ${r.status}  (${r.reason})`);
  }
  log('══════════════════════════════════════════════════════════════\n');
})();
