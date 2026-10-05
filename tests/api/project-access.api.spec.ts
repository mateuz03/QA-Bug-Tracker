import { expect, test } from '@playwright/test';

test.describe('RBAC por projeto e auditoria', () => {
  test('controla papéis e registra alterações administrativas', async ({ request }) => {
    const suffix = Date.now();
    const adminLogin = await request.post('/api/auth/login', {
      data: { email: 'admin@qatracker.dev', password: 'Qa@123456' }
    });
    const adminToken = (await adminLogin.json()).token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    const viewerEmail = `viewer-${suffix}@qatracker.dev`;
    const password = 'Viewer@123456';

    const userResponse = await request.post('/api/users', {
      headers: adminHeaders,
      data: { name: `Leitor ${suffix}`, email: viewerEmail, password, role: 'ANALYST' }
    });
    expect(userResponse.status()).toBe(201);
    const viewer = await userResponse.json();

    const projectResponse = await request.post('/api/projects', {
      headers: adminHeaders,
      data: {
        name: `Projeto protegido ${suffix}`,
        description: 'Projeto usado para validar acesso por papel e auditoria.',
        environments: [{ name: 'Local', baseUrl: 'http://localhost:5173', isDefault: true }]
      }
    });
    expect(projectResponse.status()).toBe(201);
    const project = await projectResponse.json();

    const addMember = await request.put(`/api/projects/${project.id}/members/${viewer.id}`, {
      headers: adminHeaders,
      data: { role: 'VIEWER' }
    });
    expect(addMember.status()).toBe(200);
    expect(await addMember.json()).toMatchObject({ userId: viewer.id, role: 'VIEWER' });

    const viewerLogin = await request.post('/api/auth/login', { data: { email: viewerEmail, password } });
    const viewerToken = (await viewerLogin.json()).token;
    const viewerHeaders = { Authorization: `Bearer ${viewerToken}` };

    const visibleProjects = await (await request.get('/api/projects', { headers: viewerHeaders })).json();
    expect(visibleProjects.some((item: { id: number }) => item.id === project.id)).toBe(true);
    const viewerDetail = await request.get(`/api/projects/${project.id}`, { headers: viewerHeaders });
    expect(viewerDetail.status()).toBe(200);
    expect((await viewerDetail.json()).currentUserRole).toBe('VIEWER');

    const forbiddenRequirement = await request.post(`/api/projects/${project.id}/requirements`, {
      headers: viewerHeaders,
      data: { title: 'Alteração sem permissão', description: 'Um leitor não deve conseguir criar este requisito.' }
    });
    expect(forbiddenRequirement.status()).toBe(403);
    expect((await request.get(`/api/projects/${project.id}/audit`, { headers: viewerHeaders })).status()).toBe(403);

    const promoteMember = await request.put(`/api/projects/${project.id}/members/${viewer.id}`, {
      headers: adminHeaders,
      data: { role: 'MANAGER' }
    });
    expect(promoteMember.status()).toBe(200);

    const requirementResponse = await request.post(`/api/projects/${project.id}/requirements`, {
      headers: viewerHeaders,
      data: { title: 'Alteração autorizada', description: 'Um gestor pode manter os requisitos deste projeto.' }
    });
    expect(requirementResponse.status()).toBe(201);

    const auditResponse = await request.get(`/api/projects/${project.id}/audit`, { headers: adminHeaders });
    expect(auditResponse.status()).toBe(200);
    const audit = await auditResponse.json();
    expect(audit.some((item: { action: string; actorId: number }) => item.action === 'REQUIREMENT_CREATED' && item.actorId === viewer.id)).toBe(true);
    expect(audit.filter((item: { action: string }) => item.action === 'PROJECT_MEMBER_UPSERTED')).toHaveLength(2);

    const removeMember = await request.delete(`/api/projects/${project.id}/members/${viewer.id}`, { headers: adminHeaders });
    expect(removeMember.status()).toBe(204);
    expect((await request.get(`/api/projects/${project.id}`, { headers: viewerHeaders })).status()).toBe(403);
    const hiddenProjects = await (await request.get('/api/projects', { headers: viewerHeaders })).json();
    expect(hiddenProjects.some((item: { id: number }) => item.id === project.id)).toBe(false);
  });
});
