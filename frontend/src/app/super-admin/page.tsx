'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  EllipsisVertical,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { ApiError, ApiUser, apiRequest } from '../../lib/api';

type Role = ApiUser['role'];
type Account = {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  createdAt: string;
};

type Overview = {
  totalAccounts: number;
  kader: number;
  superAdmin: number;
  peserta: number;
  jadwal: number;
  antrean: number;
  pemeriksaan: number;
};

type AccountForm = { name: string; email: string; password: string; roles: Role[] };
const emptyForm: AccountForm = { name: '', email: '', password: '', roles: ['KADER'] };
const pageSize = 8;

async function fetchAdminData() {
  const [overviewResponse, accountsResponse, userResponse] = await Promise.all([
    apiRequest<Overview>('/admin/overview'),
    apiRequest<Account[]>('/admin/accounts'),
    apiRequest<ApiUser>('/auth/me'),
  ]);
  return {
    overview: overviewResponse.data,
    accounts: accountsResponse.data,
    currentUser: userResponse.data,
  };
}

function roleLabel(role: Role) {
  return role === 'ADMIN' ? 'Super Admin' : 'Kader';
}

export default function SuperAdminPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function refreshData() {
    setIsLoading(true);
    setPage(1);
    setErrorMessage('');
    try {
      const data = await fetchAdminData();
      setOverview(data.overview);
      setAccounts(data.accounts);
      setCurrentUser(data.currentUser);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat data akun.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadInitialData() {
      try {
        const data = await fetchAdminData();
        if (!active) return;
        setOverview(data.overview);
        setAccounts(data.accounts);
        setCurrentUser(data.currentUser);
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat data akun.');
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadInitialData();
    return () => { active = false; };
  }, []);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('id-ID');
    return accounts.filter((account) => {
      const matchesRole = roleFilter === 'ALL' || account.roles.includes(roleFilter);
      const matchesSearch = !normalizedSearch ||
        account.name.toLocaleLowerCase('id-ID').includes(normalizedSearch) ||
        account.email.toLocaleLowerCase('id-ID').includes(normalizedSearch);
      return matchesRole && matchesSearch;
    });
  }, [accounts, roleFilter, search]);
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const visibleAccounts = filteredAccounts.slice((page - 1) * pageSize, page * pageSize);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setIsFormOpen(true);
    setSuccessMessage('');
    setErrorMessage('');
  }

  function startEdit(account: Account) {
    setEditing(account);
    setForm({ name: account.name, email: account.email, password: '', roles: account.roles });
    setIsFormOpen(true);
    setOpenMenuId(null);
    setSuccessMessage('');
    setErrorMessage('');
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  function toggleRole(role: Role) {
    setForm((current) => {
      const roles = current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role];
      return { ...current, roles };
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.roles.length) {
      setErrorMessage('Pilih minimal satu peran untuk akun ini.');
      return;
    }
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (editing) {
        const updates: Partial<AccountForm> = {
          name: form.name,
          email: form.email,
          roles: form.roles,
        };
        if (form.password) updates.password = form.password;
        await apiRequest<Account>(`/admin/accounts/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        setSuccessMessage('Akun berhasil diperbarui.');
      } else {
        await apiRequest<Account>('/admin/accounts', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setSuccessMessage('Akun berhasil ditambahkan.');
      }
      closeForm();
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof ApiError && error.status === 409
        ? error.message
        : error instanceof Error ? error.message : 'Gagal menyimpan akun.');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAccount(account: Account) {
    setOpenMenuId(null);
    if (!window.confirm(`Hapus akses akun ${account.name} (${account.email})? Akun ini tidak akan dapat masuk lagi.`)) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await apiRequest<{ id: string }>(`/admin/accounts/${account.id}`, { method: 'DELETE' });
      setSuccessMessage(`Akun ${account.name} berhasil dihapus.`);
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menghapus akun.');
    }
  }

  const stats = [
    { label: 'Total Akun', value: overview?.totalAccounts, icon: UsersRound, tone: 'purple' },
    { label: 'Super Admin', value: overview?.superAdmin, icon: ShieldCheck, tone: 'violet' },
    { label: 'Kader', value: overview?.kader, icon: CircleUserRound, tone: 'pink' },
    { label: 'Data Peserta', value: overview?.peserta, icon: Check, tone: 'blue' },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f7f7fc] px-4 py-5 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <UsersRound size={22} />
            </span>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">Kelola Akun</h1>
              <p className="text-xs text-slate-500">Atur akun pengguna sistem PELITA.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
              <Bell size={18} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-fuchsia-500 ring-2 ring-white" />
            </span>
            <div className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700"><CircleUserRound size={22} /></span>
              <span className="hidden min-w-0 sm:block">
                <strong className="block max-w-40 truncate text-xs text-slate-800">{currentUser?.name ?? 'Super Admin'}</strong>
                <span className="block text-[10px] text-slate-500">Super Admin PELITA</span>
              </span>
              <ChevronDown size={15} className="text-slate-400" />
            </div>
          </div>
        </header>

        {errorMessage && (
          <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p>{errorMessage}</p>
            <button aria-label="Tutup pesan" onClick={() => setErrorMessage('')}><X size={18} /></button>
          </div>
        )}
        {successMessage && (
          <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{successMessage}</div>
        )}

        <section aria-label="Ringkasan akun" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <article key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_3px_14px_rgba(54,39,92,0.04)]">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                tone === 'pink' ? 'bg-pink-100 text-pink-600' :
                  tone === 'blue' ? 'bg-blue-100 text-blue-600' :
                    tone === 'violet' ? 'bg-violet-100 text-violet-700' : 'bg-purple-100 text-purple-700'
              }`}><Icon size={22} /></span>
              <div>
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-0.5 text-2xl font-extrabold leading-none text-slate-900">{isLoading ? '—' : value ?? 0}</p>
                <p className="mt-1 text-[10px] text-slate-400">akun / data terdaftar</p>
              </div>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(54,39,92,0.05)]">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Cari nama atau email..."
                aria-label="Cari akun"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </label>
            <label className="relative">
              <span className="sr-only">Filter peran</span>
              <select
                value={roleFilter}
                onChange={(event) => { setRoleFilter(event.target.value as 'ALL' | Role); setPage(1); }}
                className="h-10 w-full min-w-40 appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="ALL">Semua Peran</option>
                <option value="ADMIN">Super Admin</option>
                <option value="KADER">Kader</option>
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </label>
            <button type="button" onClick={startCreate} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800">
              <Plus size={17} /> Tambah Akun
            </button>
          </div>

          <div className="overflow-x-auto p-2 sm:p-3">
            <table className="min-w-[760px] w-full border-separate border-spacing-y-1 text-left text-xs">
              <thead>
                <tr className="bg-violet-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <th className="rounded-l-lg px-3 py-3">No.</th>
                  <th className="px-3 py-3">Nama</th>
                  <th className="px-3 py-3">ID Login</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Peran</th>
                  <th className="px-3 py-3">Dibuat</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="rounded-r-lg px-3 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">Memuat daftar akun...</td></tr>
                )}
                {!isLoading && visibleAccounts.map((account, index) => (
                  <tr key={account.id} className="bg-white text-slate-700 transition hover:bg-violet-50/50">
                    <td className="border-y border-l border-slate-100 px-3 py-3 text-slate-500">{(page - 1) * pageSize + index + 1}</td>
                    <td className="border-y border-slate-100 px-3 py-3 font-semibold text-slate-900">{account.name}</td>
                    <td className="border-y border-slate-100 px-3 py-3 text-slate-500">{account.email.split('@')[0]}</td>
                    <td className="border-y border-slate-100 px-3 py-3">{account.email}</td>
                    <td className="border-y border-slate-100 px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {account.roles.length ? account.roles.map((role) => (
                          <span key={role} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            role === 'ADMIN' ? 'bg-violet-100 text-violet-800' : 'bg-blue-100 text-blue-800'
                          }`}>{roleLabel(role)}</span>
                        )) : <span className="text-slate-400">Tanpa peran</span>}
                      </div>
                    </td>
                    <td className="border-y border-slate-100 px-3 py-3 whitespace-nowrap text-slate-500">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(account.createdAt))}
                    </td>
                    <td className="border-y border-slate-100 px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className={`h-1.5 w-1.5 rounded-full ${account.roles.length ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {account.roles.length ? 'Aktif' : 'Tanpa akses'}
                      </span>
                    </td>
                    <td className="relative border-y border-r border-slate-100 px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button type="button" onClick={() => startEdit(account)} aria-label={`Edit ${account.name}`} title="Edit akun" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-violet-100 hover:text-violet-700"><Pencil size={14} /></button>
                        <button type="button" onClick={() => setOpenMenuId((id) => id === account.id ? null : account.id)} aria-label={`Menu ${account.name}`} title="Menu akun" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><EllipsisVertical size={16} /></button>
                      </div>
                      {openMenuId === account.id && (
                        <div className="absolute right-3 top-10 z-10 w-40 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg">
                          <button type="button" onClick={() => startEdit(account)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-violet-50"><Pencil size={13} /> Edit akun</button>
                          <button type="button" disabled={account.id === currentUser?.id} onClick={() => void deleteAccount(account)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={13} /> Hapus akun</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!isLoading && visibleAccounts.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                    {accounts.length ? 'Tidak ada akun yang cocok dengan pencarian.' : 'Belum ada akun yang dapat ditampilkan.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Menampilkan {filteredAccounts.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredAccounts.length)} dari {filteredAccounts.length} akun</p>
            <nav aria-label="Halaman daftar akun" className="flex items-center justify-end gap-1">
              <button type="button" aria-label="Halaman sebelumnya" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-violet-50 disabled:opacity-40"><ChevronLeft size={15} /></button>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-violet-700 px-2 font-semibold text-white">{page}</span>
              <span className="px-1">dari {totalPages}</span>
              <button type="button" aria-label="Halaman berikutnya" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 hover:bg-violet-50 disabled:opacity-40"><ChevronRight size={15} /></button>
            </nav>
          </div>
        </section>

        <section aria-labelledby="service-summary-title" className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_4px_20px_rgba(54,39,92,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="service-summary-title" className="font-bold text-slate-900">Ringkasan layanan Posyandu</h2>
              <p className="mt-1 text-sm text-slate-500">Jumlah di bawah berasal dari data yang tersimpan, bukan data contoh.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/data-peserta" className="inline-flex h-9 items-center rounded-lg border border-violet-200 px-3 text-xs font-semibold text-violet-700 transition hover:bg-violet-50">Kelola peserta</Link>
              <Link href="/jadwal-posyandu" className="inline-flex h-9 items-center rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white transition hover:bg-violet-800">Buat jadwal</Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Peserta terdaftar', value: overview?.peserta },
              { label: 'Jadwal Posyandu', value: overview?.jadwal },
              { label: 'Pemeriksaan tercatat', value: overview?.pemeriksaan },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{isLoading ? '—' : value ?? 0}</p>
              </div>
            ))}
          </div>
          {!isLoading && overview?.peserta === 0 && overview.jadwal === 0 && overview.pemeriksaan === 0 && (
            <p className="mt-4 rounded-lg bg-violet-50 px-4 py-3 text-xs leading-relaxed text-violet-800">
              Belum ada data pelayanan. Mulai dengan mendaftarkan peserta dan membuat jadwal Posyandu; data yang dimasukkan akan tampil di ringkasan ini.
            </p>
          )}
        </section>
      </div>

      {isFormOpen && (
        <AccountModal
          editing={editing}
          form={form}
          setForm={setForm}
          toggleRole={toggleRole}
          isSaving={isSaving}
          onSubmit={submitForm}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

function AccountModal({
  editing,
  form,
  setForm,
  toggleRole,
  isSaving,
  onSubmit,
  onClose,
}: {
  editing: Account | null;
  form: AccountForm;
  setForm: (value: AccountForm | ((current: AccountForm) => AccountForm)) => void;
  toggleRole: (role: Role) => void;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <form onSubmit={onSubmit} className="my-auto w-full max-w-2xl rounded-2xl border border-violet-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><UsersRound size={17} /></span>
            <h2 id="account-form-title" className="font-bold text-slate-900">{editing ? 'Edit Akun' : 'Tambah Akun'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup formulir" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Nama lengkap <span className="text-red-500">*</span>
            <input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} autoComplete="name" placeholder="Masukkan nama lengkap" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Email <span className="text-red-500">*</span>
            <input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} autoComplete="email" placeholder="nama@email.com" className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-semibold text-slate-600">Peran <span className="text-red-500">*</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['KADER', 'ADMIN'] as const).map((role) => (
                <label key={role} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  form.roles.includes(role) ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-200 text-slate-600'
                }`}>
                  <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} className="accent-violet-700" />
                  {roleLabel(role)}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">Pilih satu atau kedua akses untuk akun ini.</p>
          </fieldset>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2"><span className="inline-flex items-center gap-1"><KeyRound size={13} /> Kata sandi {editing ? 'baru (opsional)' : 'awal'} <span className="text-red-500">{editing ? '' : '*'}</span></span>
            <input required={!editing} type="password" minLength={12} maxLength={128} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} autoComplete="new-password" placeholder={editing ? 'Kosongkan jika tidak ingin mengganti' : 'Minimal 12 karakter'} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Batal</button>
          <button type="submit" disabled={isSaving || !form.roles.length} className="h-10 rounded-lg bg-violet-700 px-5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </div>
  );
}
