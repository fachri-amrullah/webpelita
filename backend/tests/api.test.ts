import 'dotenv/config';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { KategoriPeserta, JenisKelamin, PrismaClient, Role } from '@prisma/client';

const testDatabaseUrl = process.env.PELITA_TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('Set PELITA_TEST_DATABASE_URL to an isolated test database before running backend API tests.');
}
const testDatabaseName = new URL(testDatabaseUrl).pathname.replace(/^\/+/, '');
if (!/(?:^|_)test$/i.test(testDatabaseName)) {
  throw new Error('Backend API tests only run against a database whose name ends with _test.');
}
process.env.DATABASE_URL = testDatabaseUrl;

const [{ app }, { PrismaClient: TestPrismaClient }] = await Promise.all([
  import('../src/app.js'),
  import('@prisma/client'),
]);
const prisma = new TestPrismaClient();
const password = `Test-${crypto.randomUUID()}-Pass`;
const suffix = crypto.randomUUID();
const kaderEmail = `pelita-test-kader-${suffix}@example.test`;
const adminEmail = `pelita-test-admin-${suffix}@example.test`;
const sharedRoleEmail = `pelita-test-shared-${suffix}@example.test`;
const managedKaderEmail = `pelita-managed-kader-${suffix}@example.test`;
const managedAccountEmail = `pelita-managed-account-${suffix}@example.test`;
const nik = (BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000))).toString();

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

async function login(email: string, role: 'KADER' | 'ADMIN', loginPassword = password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: loginPassword, role }),
  });
  const body = await response.json() as { success: boolean };
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  return { response, body, cookie };
}

before(async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be configured before running backend API tests.');
  }

  const passwordHash = await bcrypt.hash(password, 4);
  await prisma.user.createMany({
    data: [
      { name: 'Test Kader', email: kaderEmail, passwordHash, role: Role.KADER },
      { name: 'Test Admin', email: adminEmail, passwordHash, role: Role.ADMIN },
      { name: 'Test Shared Role', email: sharedRoleEmail, passwordHash, role: Role.KADER },
    ],
  });
  const users = await prisma.user.findMany({ where: { email: { in: [kaderEmail, adminEmail, sharedRoleEmail] } }, select: { id: true, email: true, role: true } });
  await prisma.userRoleGrant.createMany({
    data: users.flatMap((user) => [
      { userId: user.id, role: user.role },
      ...(user.email === sharedRoleEmail ? [{ userId: user.id, role: Role.ADMIN }] : []),
    ]),
  });

  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine API test server address.');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (baseUrl) {
    await prisma.peserta.deleteMany({ where: { nik } });
  }
  await prisma.user.deleteMany({ where: { email: { in: [kaderEmail, adminEmail, sharedRoleEmail, managedKaderEmail, managedAccountEmail] } } });
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await prisma.$disconnect();
});

test('login enforces account roles and participant CRUD enforces authorization', async () => {
  const mismatchedRole = await login(kaderEmail, 'ADMIN');
  assert.equal(mismatchedRole.response.status, 401);

  const unauthenticated = await fetch(`${baseUrl}/api/peserta`);
  assert.equal(unauthenticated.status, 401);
  const unauthenticatedAdmin = await fetch(`${baseUrl}/api/admin/overview`);
  assert.equal(unauthenticatedAdmin.status, 401);

  const kaderLogin = await login(kaderEmail, 'KADER');
  assert.equal(kaderLogin.response.status, 200);
  assert.equal(kaderLogin.body.success, true);
  assert.ok(kaderLogin.cookie);
  const kaderAdminAccess = await fetch(`${baseUrl}/api/admin/overview`, { headers: { Cookie: kaderLogin.cookie! } });
  assert.equal(kaderAdminAccess.status, 403);

  const sharedAdminLogin = await login(sharedRoleEmail, 'ADMIN');
  assert.equal(sharedAdminLogin.response.status, 200);
  assert.ok(sharedAdminLogin.cookie);
  const sharedAdminAccess = await fetch(`${baseUrl}/api/admin/overview`, { headers: { Cookie: sharedAdminLogin.cookie! } });
  assert.equal(sharedAdminAccess.status, 200);
  const sharedKaderLogin = await login(sharedRoleEmail, 'KADER');
  assert.equal(sharedKaderLogin.response.status, 200);

  const participantResponse = await fetch(`${baseUrl}/api/peserta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: kaderLogin.cookie! },
    body: JSON.stringify({
      nik,
      nama: 'Peserta Tes API',
      tanggalLahir: '2020-06-15',
      jenisKelamin: JenisKelamin.PEREMPUAN,
      kategori: KategoriPeserta.BALITA,
      alamat: 'Alamat sementara untuk pengujian API',
    }),
  });
  assert.equal(participantResponse.status, 201);
  const participantBody = await participantResponse.json() as { data: { id: string } };
  const participantId = participantBody.data.id;

  const updateResponse = await fetch(`${baseUrl}/api/peserta/${participantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: kaderLogin.cookie! },
    body: JSON.stringify({ nama: 'Peserta Tes API Diperbarui' }),
  });
  assert.equal(updateResponse.status, 200);

  const kaderDelete = await fetch(`${baseUrl}/api/peserta/${participantId}`, {
    method: 'DELETE',
    headers: { Cookie: kaderLogin.cookie! },
  });
  assert.equal(kaderDelete.status, 403);

  const adminLogin = await login(adminEmail, 'ADMIN');
  assert.equal(adminLogin.response.status, 200);
  assert.ok(adminLogin.cookie);
  const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminLogin.cookie! };
  const overviewResponse = await fetch(`${baseUrl}/api/admin/overview`, { headers: adminHeaders });
  assert.equal(overviewResponse.status, 200);
  const accountListResponse = await fetch(`${baseUrl}/api/admin/accounts`, { headers: adminHeaders });
  assert.equal(accountListResponse.status, 200);
  const accountList = await accountListResponse.json() as { data: Array<{ email: string; roles: string[] }> };
  assert.ok(accountList.data.some((account) => account.email === adminEmail && account.roles.includes('ADMIN')));
  const createAccountResponse = await fetch(`${baseUrl}/api/admin/accounts`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Managed Test Admin', email: managedAccountEmail, password: 'Managed-Account-Password-12', roles: ['ADMIN'] }),
  });
  assert.equal(createAccountResponse.status, 201);
  const createdAccount = await createAccountResponse.json() as { data: { id: string; roles: string[] } };
  assert.deepEqual(createdAccount.data.roles, ['ADMIN']);
  const updateAccountResponse = await fetch(`${baseUrl}/api/admin/accounts/${createdAccount.data.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ roles: ['KADER', 'ADMIN'] }),
  });
  assert.equal(updateAccountResponse.status, 200);
  const updatedAccount = await updateAccountResponse.json() as { data: { roles: string[] } };
  assert.deepEqual(new Set(updatedAccount.data.roles), new Set(['ADMIN', 'KADER']));
  const deleteAccountResponse = await fetch(`${baseUrl}/api/admin/accounts/${createdAccount.data.id}`, {
    method: 'DELETE',
    headers: { Cookie: adminLogin.cookie! },
  });
  assert.equal(deleteAccountResponse.status, 200);

  const createKader = await fetch(`${baseUrl}/api/admin/kader`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Managed Test Kader', email: managedKaderEmail, password: 'Managed-Test-Password-12' }),
  });
  assert.equal(createKader.status, 201);
  const createdKader = await createKader.json() as { data: { id: string } };
  const updateKader = await fetch(`${baseUrl}/api/admin/kader/${createdKader.data.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ name: 'Updated Test Kader', adminAccess: true }),
  });
  assert.equal(updateKader.status, 200);
  const promotedLogin = await login(managedKaderEmail, 'ADMIN', 'Managed-Test-Password-12');
  assert.equal(promotedLogin.response.status, 200);
  const revokeAdminAccess = await fetch(`${baseUrl}/api/admin/kader/${createdKader.data.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ adminAccess: false }),
  });
  assert.equal(revokeAdminAccess.status, 200);
  const revokedAdminLogin = await login(managedKaderEmail, 'ADMIN', 'Managed-Test-Password-12');
  assert.equal(revokedAdminLogin.response.status, 401);
  const deleteKader = await fetch(`${baseUrl}/api/admin/kader/${createdKader.data.id}`, {
    method: 'DELETE',
    headers: { Cookie: adminLogin.cookie! },
  });
  assert.equal(deleteKader.status, 200);
  const adminDelete = await fetch(`${baseUrl}/api/peserta/${participantId}`, {
    method: 'DELETE',
    headers: { Cookie: adminLogin.cookie! },
  });
  assert.equal(adminDelete.status, 200);
});
