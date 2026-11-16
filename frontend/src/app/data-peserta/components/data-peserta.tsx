'use client';

import { useEffect, useState } from 'react';
import { apiRequest, ApiUser, Category, displayCategory, Participant } from '../../../lib/api';

type ParticipantForm = {
  nik: string;
  nama: string;
  tanggalLahir: string;
  jenisKelamin: Participant['jenisKelamin'];
  kategori: Category;
  alamat: string;
  noTelepon: string;
};

const emptyForm: ParticipantForm = {
  nik: '',
  nama: '',
  tanggalLahir: '',
  jenisKelamin: 'PEREMPUAN',
  kategori: 'BALITA',
  alamat: '',
  noTelepon: '',
};

const categories: Array<{ label: string; value: Category | '' }> = [
  { label: 'Semua', value: '' },
  { label: 'Balita', value: 'BALITA' },
  { label: 'Ibu Hamil', value: 'IBU_HAMIL' },
  { label: 'Lansia', value: 'LANSIA' },
];

export default function DataPeserta() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | ''>('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [form, setForm] = useState<ParticipantForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest<ApiUser>('/auth/me')
      .then((response) => {
        if (active) setUser(response.data);
      })
      .catch((error) => {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat informasi akun.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage('');
      const query = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (searchTerm.trim()) query.set('q', searchTerm.trim());
      if (selectedCategory) query.set('kategori', selectedCategory);

      try {
        const response = await apiRequest<Participant[]>(`/peserta?${query}`, {
          signal: controller.signal,
        });
        setParticipants(response.data);
        setTotal(response.meta?.total ?? response.data.length);
        setTotalPages(response.meta?.totalPages ?? 1);
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat peserta.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, pageSize, searchTerm, selectedCategory, refreshKey]);

  const setCategory = (category: Category | '') => {
    setSelectedCategory(category);
    setPage(1);
  };

  const openCreateModal = () => {
    setEditingParticipant(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (participant: Participant) => {
    setEditingParticipant(participant);
    setForm({
      nik: participant.nik,
      nama: participant.nama,
      tanggalLahir: participant.tanggalLahir.slice(0, 10),
      jenisKelamin: participant.jenisKelamin,
      kategori: participant.kategori,
      alamat: participant.alamat,
      noTelepon: participant.noTelepon ?? '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    try {
      await apiRequest<Participant>(
        editingParticipant ? `/peserta/${editingParticipant.id}` : '/peserta',
        {
          method: editingParticipant ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...form,
            tanggalLahir: new Date(`${form.tanggalLahir}T12:00:00`).toISOString(),
            noTelepon: form.noTelepon.trim() || null,
          }),
        },
      );
      setIsModalOpen(false);
      setEditingParticipant(null);
      setForm(emptyForm);
      if (page !== 1) setPage(1);
      else setRefreshKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menyimpan data peserta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (participant: Participant) => {
    if (!window.confirm(`Hapus data peserta ${participant.nama}?`)) return;
    setErrorMessage('');
    try {
      await apiRequest<{ id: string }>(`/peserta/${participant.id}`, { method: 'DELETE' });
      if (participants.length === 1 && page > 1) setPage((current) => current - 1);
      else setRefreshKey((key) => key + 1);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal menghapus data peserta.');
    }
  };

  return (
    <div className="w-full font-sans text-gray-800">
      <main className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
        <header className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Data Peserta</h1>
              <p className="mt-1 text-sm text-gray-500">Data peserta yang tersimpan di sistem Posyandu.</p>
            </div>
            <button type="button" onClick={openCreateModal} className="rounded-xl bg-gradient-to-r from-[#7E3AF2] to-[#E14ECA] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
              + Tambah Peserta
            </button>
          </div>
        </header>

        <div className="mb-5 max-w-md">
          <label htmlFor="participant-search" className="sr-only">Cari nama atau NIK</label>
          <input
            id="participant-search"
            type="search"
            placeholder="Cari nama atau NIK..."
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          {categories.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => setCategory(value)}
              className={`rounded-xl px-5 py-2 text-sm font-bold shadow-sm transition ${
                selectedCategory === value
                  ? 'border border-purple-400 bg-purple-100 text-purple-900'
                  : 'bg-gradient-to-r from-[#7E3AF2] to-[#E14ECA] text-white hover:opacity-90'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-gray-300 shadow-sm">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="bg-gradient-to-r from-[#7E3AF2] to-[#E14ECA] text-sm font-bold text-white">
                <th className="w-16 border-r border-purple-400/30 px-5 py-3.5 text-center">No</th>
                <th className="border-r border-purple-400/30 px-5 py-3.5">Nama</th>
                <th className="border-r border-purple-400/30 px-5 py-3.5">Kategori</th>
                <th className="border-r border-purple-400/30 px-5 py-3.5">Tanggal Lahir</th>
                <th className="border-r border-purple-400/30 px-5 py-3.5">No HP</th>
                <th className="px-5 py-3.5">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm font-medium text-gray-800">
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Memuat data peserta...</td></tr>
              ) : participants.length ? (
                participants.map((participant, index) => (
                  <tr key={participant.id} className="transition-colors hover:bg-purple-50/50">
                    <td className="border-r border-gray-200 px-5 py-4 text-center">{(page - 1) * pageSize + index + 1}</td>
                    <td className="border-r border-gray-200 px-5 py-4">
                      <div className="font-semibold">{participant.nama}</div>
                      <div className="mt-0.5 text-xs text-gray-500">NIK {participant.nik}</div>
                    </td>
                    <td className="border-r border-gray-200 px-5 py-4">{displayCategory(participant.kategori)}</td>
                    <td className="border-r border-gray-200 px-5 py-4">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(`${participant.tanggalLahir.slice(0, 10)}T00:00:00`))}
                    </td>
                    <td className="border-r border-gray-200 px-5 py-4">{participant.noTelepon || '—'}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <button type="button" onClick={() => openEditModal(participant)} className="font-semibold text-purple-700 hover:underline">Ubah</button>
                        {user?.role === 'ADMIN' && (
                          <button type="button" onClick={() => void handleDelete(participant)} className="font-semibold text-red-600 hover:underline">Hapus</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">Data peserta tidak ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span>
              {total === 0
                ? 'Tidak ada peserta'
                : `Menampilkan ${(page - 1) * pageSize + 1}-${Math.min((page - 1) * pageSize + participants.length, total)} dari ${total} peserta`}
            </span>
            <label className="flex items-center gap-2">
              Baris per halaman
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-gray-700"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span>Halaman {page} dari {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              className="rounded-lg border border-gray-300 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </main>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isSaving) setIsModalOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="participant-dialog-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="participant-dialog-title" className="text-xl font-bold text-gray-900">
                  {editingParticipant ? 'Ubah Data Peserta' : 'Tambah Peserta'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Lengkapi informasi peserta Posyandu.</p>
              </div>
              <button type="button" aria-label="Tutup" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="rounded-lg px-2 py-1 text-xl text-gray-500 hover:bg-gray-100 disabled:opacity-50">×</button>
            </div>
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700">
                NIK
                <input required inputMode="numeric" pattern="[0-9]{16}" maxLength={16} value={form.nik} onChange={(event) => setForm({ ...form, nik: event.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Nama lengkap
                <input required minLength={2} maxLength={120} value={form.nama} onChange={(event) => setForm({ ...form, nama: event.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Tanggal lahir
                <input required type="date" value={form.tanggalLahir} onChange={(event) => setForm({ ...form, tanggalLahir: event.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Jenis kelamin
                <select value={form.jenisKelamin} onChange={(event) => setForm({ ...form, jenisKelamin: event.target.value as Participant['jenisKelamin'] })} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
                  <option value="PEREMPUAN">Perempuan</option>
                  <option value="LAKI_LAKI">Laki-laki</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Kategori
                <select value={form.kategori} onChange={(event) => setForm({ ...form, kategori: event.target.value as Category })} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
                  <option value="BALITA">Balita</option>
                  <option value="IBU_HAMIL">Ibu Hamil</option>
                  <option value="LANSIA">Lansia</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                No. telepon
                <input type="tel" maxLength={20} value={form.noTelepon} onChange={(event) => setForm({ ...form, noTelepon: event.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </label>
              <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                Alamat
                <textarea required minLength={3} maxLength={500} rows={3} value={form.alamat} onChange={(event) => setForm({ ...form, alamat: event.target.value })} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100" />
              </label>
              {errorMessage && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{errorMessage}</p>}
              <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 sm:col-span-2">
                <button type="button" disabled={isSaving} onClick={() => setIsModalOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">Batal</button>
                <button type="submit" disabled={isSaving} className="rounded-xl bg-gradient-to-r from-[#7E3AF2] to-[#E14ECA] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
                  {isSaving ? 'Menyimpan...' : editingParticipant ? 'Simpan Perubahan' : 'Simpan Peserta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}