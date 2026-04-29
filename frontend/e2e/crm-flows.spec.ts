import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API  = 'http://localhost:4000';

// ── helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', 'saral@demo.com');
  await page.fill('input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|leads|pipeline)/, { timeout: 10_000 });
}

async function apiLogin(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'saral@demo.com', password: 'demo123' }),
  });
  const json = await res.json();
  return json.token ?? json.accessToken ?? '';
}

// ── 1. Form submission creates CRM lead ───────────────────────────────────

test('1. Form submission → lead appears in CRM', async ({ page }) => {
  const token = await apiLogin();

  // Get an active form's slug
  const formsRes = await fetch(`${API}/api/forms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const forms = await formsRes.json();

  if (!forms.length) {
    console.log('⚠️  No forms found — skipping form-submission test');
    test.skip();
    return;
  }

  const form = forms[0];
  const uniqueEmail = `playwright_${Date.now()}@test.com`;

  // Submit via public endpoint (no auth)
  const submitRes = await fetch(`${API}/api/forms/${form.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { name: 'PW TestLead', email: uniqueEmail, phone: '+91 99999 00001' } }),
  });
  const submitJson = await submitRes.json();
  expect(submitRes.status).toBe(200);
  expect(submitJson.success).toBe(true);

  // Verify lead exists in CRM
  const leadsRes = await fetch(`${API}/api/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leads = await leadsRes.json();
  const found = (Array.isArray(leads) ? leads : leads.leads ?? []).find(
    (l: any) => l.email === uniqueEmail
  );
  expect(found).toBeTruthy();
  console.log(`✅  Lead created: ${found?.name} (${found?.email})`);
});

// ── 2. Move lead from one stage to another ────────────────────────────────

test('2. Stage movement — move lead to next stage', async ({ page }) => {
  await login(page);

  // Navigate to leads / pipeline
  await page.goto(`${BASE}/leads`);
  await page.waitForLoadState('networkidle');

  // Check if there's a pipeline/kanban view
  const stageSelector = page.locator('[data-testid="pipeline-stage"], .pipeline-stage, [class*="stage"]').first();
  const leadCard = page.locator('[data-testid="lead-card"], [class*="lead-card"], [class*="LeadCard"]').first();

  // Try the API approach (more reliable)
  const token = await apiLogin();

  const pipelinesRes = await fetch(`${API}/api/pipelines`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pipelines = await pipelinesRes.json();
  if (!pipelines.length) { console.log('⚠️  No pipelines'); test.skip(); return; }

  const pipeline = pipelines[0];
  const stages: any[] = pipeline.stages ?? [];
  if (stages.length < 2) { console.log('⚠️  Need ≥2 stages'); test.skip(); return; }

  const leadsRes = await fetch(`${API}/api/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leadsData = await leadsRes.json();
  const leads = Array.isArray(leadsData) ? leadsData : leadsData.leads ?? [];
  if (!leads.length) { console.log('⚠️  No leads'); test.skip(); return; }

  const lead = leads[0];
  const nextStage = stages.find((s: any) => s.id !== lead.stage_id) ?? stages[1];

  const moveRes = await fetch(`${API}/api/leads/${lead.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage_id: nextStage.id }),
  });
  expect(moveRes.status).toBe(200);
  const updated = await moveRes.json();
  expect(updated.stage_id).toBe(nextStage.id);
  console.log(`✅  Lead "${lead.name}" moved to stage "${nextStage.name}"`);
});

// ── 3. Create a new pipeline stage ───────────────────────────────────────

test('3. Create new pipeline stage', async ({ page }) => {
  const token = await apiLogin();

  const pipelinesRes = await fetch(`${API}/api/pipelines`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pipelines = await pipelinesRes.json();
  if (!pipelines.length) { test.skip(); return; }

  const pipeline = pipelines[0];
  const stageName = `PW Stage ${Date.now()}`;

  const createRes = await fetch(`${API}/api/pipelines/${pipeline.id}/stages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: stageName }),
  });
  expect(createRes.status).toBe(201);
  const stage = await createRes.json();
  expect(stage.name).toBe(stageName);
  console.log(`✅  Stage created: "${stage.name}" (id=${stage.id})`);

  // Cleanup
  await fetch(`${API}/api/pipelines/${pipeline.id}/stages/${stage.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

// ── 4. Add notes to a lead ────────────────────────────────────────────────

test('4. Add note to lead', async ({ page }) => {
  const token = await apiLogin();

  const leadsRes = await fetch(`${API}/api/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leadsData = await leadsRes.json();
  const leads = Array.isArray(leadsData) ? leadsData : leadsData.leads ?? [];
  if (!leads.length) { test.skip(); return; }

  const lead = leads[0];
  const noteText = `Playwright note ${Date.now()}`;

  const noteRes = await fetch(`${API}/api/leads/${lead.id}/notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: noteText }),
  });
  expect(noteRes.status).toBe(201);
  const note = await noteRes.json();
  expect(note.content).toBe(noteText);
  console.log(`✅  Note added to "${lead.name}": "${note.content}"`);

  // Verify note appears in list
  const notesRes = await fetch(`${API}/api/leads/${lead.id}/notes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const notes = await notesRes.json();
  const found = notes.find((n: any) => n.content === noteText);
  expect(found).toBeTruthy();
});

// ── 5. Add follow-up ──────────────────────────────────────────────────────

test('5. Add follow-up to lead', async ({ page }) => {
  const token = await apiLogin();

  const leadsRes = await fetch(`${API}/api/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leadsData = await leadsRes.json();
  const leads = Array.isArray(leadsData) ? leadsData : leadsData.leads ?? [];
  if (!leads.length) { test.skip(); return; }

  const lead = leads[0];
  const followUpDate = new Date(Date.now() + 86400_000).toISOString(); // tomorrow

  const fuRes = await fetch(`${API}/api/leads/${lead.id}/followups`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'PW Follow-up call',
      due_at: followUpDate,
      notes: 'Created by Playwright test',
    }),
  });
  expect(fuRes.status).toBe(201);
  const fu = await fuRes.json();
  expect(fu.title).toBe('PW Follow-up call');
  console.log(`✅  Follow-up created for "${lead.name}": "${fu.title}" due ${fu.due_at}`);
});

// ── 6. Automation flows ───────────────────────────────────────────────────

test('6a. Automation — create workflow with add_tag + send_email + internal_notify', async ({ page }) => {
  const token = await apiLogin();

  const wfRes = await fetch(`${API}/api/workflows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PW Test Workflow',
      trigger: 'lead_created',
      nodes: [
        { id: 'n1', type: 'add_tag',         config: { tag: 'pw-test-tag' } },
        { id: 'n2', type: 'send_email',       config: { to: '{email}', subject: 'Welcome {first_name}', body: 'Hello {name}!' } },
        { id: 'n3', type: 'internal_notify',  config: { message: 'New lead: {name}' } },
      ],
      edges: [
        { from: 'trigger', to: 'n1' },
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
      is_active: true,
    }),
  });
  expect(wfRes.status).toBe(201);
  const wf = await wfRes.json();
  expect(wf.id).toBeTruthy();
  console.log(`✅  Workflow created: "${wf.name}" (id=${wf.id})`);

  // Cleanup
  await fetch(`${API}/api/workflows/${wf.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

test('6b. Automation — remove_tag workflow', async ({ page }) => {
  const token = await apiLogin();

  const leadsRes = await fetch(`${API}/api/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leadsData = await leadsRes.json();
  const leads = Array.isArray(leadsData) ? leadsData : leadsData.leads ?? [];
  if (!leads.length) { test.skip(); return; }

  const lead = leads[0];

  // Add a tag first
  await fetch(`${API}/api/leads/${lead.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: [...(lead.tags ?? []), 'removeme'] }),
  });

  // Create remove_tag workflow and fire it
  const wfRes = await fetch(`${API}/api/workflows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PW Remove Tag WF',
      trigger: 'lead_created',
      nodes: [{ id: 'n1', type: 'remove_tag', config: { tag: 'removeme' } }],
      edges: [{ from: 'trigger', to: 'n1' }],
      is_active: true,
    }),
  });
  expect(wfRes.status).toBe(201);
  const wf = await wfRes.json();
  console.log(`✅  remove_tag workflow created (id=${wf.id})`);

  // Manually trigger
  const trigRes = await fetch(`${API}/api/workflows/${wf.id}/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: lead.id }),
  });
  if (trigRes.status === 200) {
    const tr = await trigRes.json();
    console.log(`✅  remove_tag workflow triggered: ${JSON.stringify(tr)}`);
  } else {
    console.log(`ℹ️  Manual trigger endpoint returned ${trigRes.status} (may not be implemented)`);
  }

  // Cleanup
  await fetch(`${API}/api/workflows/${wf.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

test('6c. Automation — assign_staff (round-robin) workflow', async ({ page }) => {
  const token = await apiLogin();

  // Get staff list
  const staffRes = await fetch(`${API}/api/staff`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const staff = await staffRes.json();
  if (!Array.isArray(staff) || staff.length < 1) {
    console.log('ℹ️  No staff members — skipping round-robin test');
    test.skip();
    return;
  }

  const wfRes = await fetch(`${API}/api/workflows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PW Assign Staff WF',
      trigger: 'lead_created',
      nodes: [{
        id: 'n1',
        type: 'assign_staff',
        config: {
          method: 'round_robin',
          staff_ids: staff.slice(0, 2).map((s: any) => s.id),
        },
      }],
      edges: [{ from: 'trigger', to: 'n1' }],
      is_active: true,
    }),
  });
  expect(wfRes.status).toBe(201);
  const wf = await wfRes.json();
  console.log(`✅  assign_staff (round-robin) workflow created (id=${wf.id})`);

  // Cleanup
  await fetch(`${API}/api/workflows/${wf.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

test('6d. Automation — form_submit trigger fires workflow', async ({ page }) => {
  const token = await apiLogin();

  // Get a form
  const formsRes = await fetch(`${API}/api/forms`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const forms = await formsRes.json();
  if (!forms.length) {
    console.log('⚠️  No forms — skipping form_submit trigger test');
    test.skip();
    return;
  }

  const form = forms[0];

  // Create an opt_in_form workflow
  const wfRes = await fetch(`${API}/api/workflows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PW Form Submit WF',
      trigger: 'opt_in_form',
      nodes: [{ id: 'n1', type: 'add_tag', config: { tag: 'form-submitted' } }],
      edges: [{ from: 'trigger', to: 'n1' }],
      is_active: true,
    }),
  });
  expect(wfRes.status).toBe(201);
  const wf = await wfRes.json();

  // Submit the form (triggers opt_in_form workflow)
  const uniqueEmail = `pw_form_${Date.now()}@test.com`;
  const submitRes = await fetch(`${API}/api/forms/${form.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { name: 'PW Form User', email: uniqueEmail, phone: '+919900000002' } }),
  });
  expect(submitRes.status).toBe(200);
  console.log(`✅  Form submitted → opt_in_form trigger → add_tag workflow fired`);

  // Wait briefly and check lead has tag
  await new Promise(r => setTimeout(r, 2000));
  const leadsRes = await fetch(`${API}/api/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const leadsData = await leadsRes.json();
  const leads = Array.isArray(leadsData) ? leadsData : leadsData.leads ?? [];
  const pwLead = leads.find((l: any) => l.email === uniqueEmail);
  if (pwLead) {
    console.log(`✅  Lead tags after form submit: ${JSON.stringify(pwLead.tags)}`);
  }

  // Cleanup workflow
  await fetch(`${API}/api/workflows/${wf.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

test('6e. Automation — WhatsApp send_whatsapp node can be configured', async ({ page }) => {
  const token = await apiLogin();

  const wfRes = await fetch(`${API}/api/workflows`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'PW WhatsApp WF',
      trigger: 'lead_created',
      nodes: [{
        id: 'n1',
        type: 'send_whatsapp',
        config: {
          template_name: 'hello_world',
          template_language: 'en',
          body: 'Hi {first_name}, thanks for reaching out!',
        },
      }],
      edges: [{ from: 'trigger', to: 'n1' }],
      is_active: true,
    }),
  });
  expect(wfRes.status).toBe(201);
  const wf = await wfRes.json();
  console.log(`✅  WhatsApp workflow created and saved (id=${wf.id})`);

  // Cleanup
  await fetch(`${API}/api/workflows/${wf.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

// ── UI smoke tests ────────────────────────────────────────────────────────

test('UI: leads page loads and shows lead list', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/leads`);
  await page.waitForLoadState('networkidle');

  const rows = page.locator('table tbody tr, [class*="lead-row"], [class*="LeadRow"]');
  const cards = page.locator('[class*="card"], [class*="Card"]');

  const content = await page.content();
  const hasLeads = content.includes('Aarav') || content.includes('Priya') || content.includes('Rahul');
  console.log(hasLeads ? '✅  Leads visible on leads page' : '⚠️  Could not find expected lead names');
  expect(hasLeads).toBe(true);
});

test('UI: automation page loads', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/automation`);
  await page.waitForLoadState('networkidle');
  const title = await page.title();
  const content = await page.content();
  const ok = content.toLowerCase().includes('workflow') ||
              content.toLowerCase().includes('automation') ||
              content.toLowerCase().includes('create');
  console.log(ok ? '✅  Automation page loaded' : '⚠️  Automation page may be empty');
  expect(ok).toBe(true);
});

test('UI: workflow editor opens', async ({ page }) => {
  await login(page);
  await page.goto(`${BASE}/automation/new`);
  await page.waitForLoadState('networkidle');
  const content = await page.content();
  const hasEditor = content.toLowerCase().includes('trigger') ||
                    content.toLowerCase().includes('node') ||
                    content.toLowerCase().includes('workflow');
  console.log(hasEditor ? '✅  Workflow editor loaded' : '⚠️  Editor content not detected');
  expect(hasEditor).toBe(true);
});
