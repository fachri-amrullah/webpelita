import 'dotenv/config';
import {
  JenisKelamin,
  KategoriPeserta,
  Prisma,
  PrismaClient,
  StatusAntrean,
  StatusJadwal,
  StatusPemeriksaan,
} from '@prisma/client';

const prisma = new PrismaClient();
const dummyCount = 500;
const dummyNikPrefix = '999999000000';
const locations = ['Posyandu Melati', 'Posyandu Mawar', 'Posyandu Anggrek'];
const firstNames = ['Ayu', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Intan', 'Joko', 'Kirana', 'Lukman'];
const lastNames = ['Santoso', 'Wijaya', 'Lestari', 'Saputra', 'Permata', 'Pratama', 'Putri', 'Nugroho', 'Sari', 'Utami'];
const scheduleOffsets = [-210, -180, -150, -120, -90, -60, -30, 0, 14];

function jakartaDateAt(offsetDays: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day + offsetDays, 2));
}

function birthdayFor(age: number, index: number) {
  const birthday = jakartaDateAt(0);
  birthday.setUTCFullYear(birthday.getUTCFullYear() - age);
  birthday.setUTCDate(birthday.getUTCDate() - ((index * 17) % 365));
  return birthday;
}

function participantData(index: number): Prisma.PesertaCreateManyInput {
  const categoryIndex = index % 3;
  const kategori = [KategoriPeserta.BALITA, KategoriPeserta.IBU_HAMIL, KategoriPeserta.LANSIA][categoryIndex];
  const age = kategori === KategoriPeserta.BALITA
    ? index % 6
    : kategori === KategoriPeserta.IBU_HAMIL
      ? 20 + (index % 18)
      : 60 + (index % 21);
  const jenisKelamin = kategori === KategoriPeserta.IBU_HAMIL || index % 2 === 0
    ? JenisKelamin.PEREMPUAN
    : JenisKelamin.LAKI_LAKI;

  return {
    nik: `${dummyNikPrefix}${String(index).padStart(4, '0')}`,
    nama: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
    tanggalLahir: birthdayFor(age, index),
    jenisKelamin,
    kategori,
    alamat: `Jl. Melati No. ${(index % 20) + 1}, Kelurahan Sukamaju`,
    noTelepon: null,
  };
}

function assertLocalDevelopmentDatabase() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL is not configured.');

  const databaseUrl = new URL(rawUrl);
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ''));
  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname) ||
    databaseName !== 'pelita_db' ||
    process.env.NODE_ENV === 'production' ||
    process.env.CONFIRM_DUMMY_SEED !== 'YES') {
    throw new Error('Dummy seeding is restricted to local pelita_db. Set CONFIRM_DUMMY_SEED=YES to explicitly confirm.');
  }
}

async function main() {
  assertLocalDevelopmentDatabase();

  const result = await prisma.$transaction(async (tx) => {
    const participants = Array.from({ length: dummyCount }, (_, index) => participantData(index + 1));
    const nikList = participants.map(({ nik }) => nik);
    const participantsByNik = new Map(participants.map((participant) => [participant.nik, participant]));
    const existingByNik = await tx.peserta.findMany({
      where: { nik: { in: nikList } },
      select: { nik: true, nama: true, alamat: true },
    });

    for (const existing of existingByNik) {
      const expected = participantsByNik.get(existing.nik);
      const isExistingSyntheticRecord = existing.nama.startsWith('DUMMY PELITA - ') &&
        existing.alamat.startsWith('DATA SIMULASI - bukan data peserta nyata');
      if (!expected || (!isExistingSyntheticRecord &&
        (existing.nama !== expected.nama || existing.alamat !== expected.alamat))) {
        throw new Error(`Synthetic identity collision detected for NIK ${existing.nik}; no data was written.`);
      }
    }

    const existingNiks = new Set(existingByNik.map(({ nik }) => nik));
    const missingParticipants = participants.filter(({ nik }) => !existingNiks.has(nik));
    const insertedParticipants = await tx.peserta.createMany({ data: missingParticipants, skipDuplicates: true });
    await Promise.all(existingByNik.map((existing) => {
      const expected = participantsByNik.get(existing.nik)!;
      return tx.peserta.update({
        where: { nik: existing.nik },
        data: { nama: expected.nama, alamat: expected.alamat },
      });
    }));

    const scheduleDates = scheduleOffsets.map(jakartaDateAt);
    const scheduleDescriptions = scheduleOffsets.map((_, index) =>
      `Layanan Posyandu Bulanan ke-${String(index + 1).padStart(2, '0')}`);
    const previousScheduleDescriptions = scheduleOffsets.map((_, index) =>
      `DATA DUMMY PELITA - ${String(index + 1).padStart(2, '0')}`);
    const existingSchedules = await tx.jadwalPosyandu.findMany({
      where: { deskripsi: { in: [...scheduleDescriptions, ...previousScheduleDescriptions] } },
      select: { id: true, deskripsi: true, lokasi: true },
    });
    const scheduleByDescription = new Map(existingSchedules.map((schedule) => [schedule.deskripsi, schedule]));
    let insertedSchedules = 0;

    for (let index = 0; index < scheduleOffsets.length; index += 1) {
      const description = scheduleDescriptions[index];
      const previousDescription = previousScheduleDescriptions[index];
      if (!description || !previousDescription) continue;
      const dateOffset = scheduleOffsets[index];
      const status = dateOffset === 0
        ? StatusJadwal.BERJALAN
        : dateOffset > 0
          ? StatusJadwal.MENDATANG
          : StatusJadwal.SELESAI;
      const existing = scheduleByDescription.get(description) ?? scheduleByDescription.get(previousDescription);
      if (existing) {
        const updated = await tx.jadwalPosyandu.update({
          where: { id: existing.id },
          data: { deskripsi: description, lokasi: locations[index % locations.length]! },
          select: { id: true, deskripsi: true, lokasi: true },
        });
        scheduleByDescription.set(description, updated);
        continue;
      }
      const schedule = await tx.jadwalPosyandu.create({
        data: {
          tanggal: scheduleDates[index]!,
          lokasi: locations[index % locations.length]!,
          deskripsi: description,
          status,
        },
        select: { id: true, deskripsi: true, lokasi: true },
      });
      scheduleByDescription.set(description, schedule);
      insertedSchedules += 1;
    }

    const seededParticipants = await tx.peserta.findMany({
      where: { nik: { in: nikList } },
      select: { id: true, nik: true, kategori: true },
      orderBy: { nik: 'asc' },
    });
    if (seededParticipants.length !== dummyCount) {
      throw new Error(`Expected ${dummyCount} synthetic participants but found ${seededParticipants.length}.`);
    }

    const scheduleRows = scheduleOffsets.map((_, index) => {
      const schedule = scheduleByDescription.get(scheduleDescriptions[index]!);
      if (!schedule) throw new Error(`Could not resolve synthetic schedule ${index + 1}.`);
      return schedule;
    });
    const existingQueues = await tx.antrean.findMany({
      where: { pesertaId: { in: seededParticipants.map(({ id }) => id) } },
      select: { pesertaId: true, jadwalId: true },
    });
    const queueKeys = new Set(existingQueues.map(({ pesertaId, jadwalId }) => `${pesertaId}:${jadwalId}`));
    const queueRows: Prisma.AntreanCreateManyInput[] = [];
    const examinationRows: Prisma.PemeriksaanCreateManyInput[] = [];
    const queueNumbers = new Array(scheduleRows.length).fill(0) as number[];

    for (let index = 0; index < seededParticipants.length; index += 1) {
      const participant = seededParticipants[index]!;
      const scheduleIndex = index % scheduleRows.length;
      const schedule = scheduleRows[scheduleIndex]!;
      const scheduleOffset = scheduleOffsets[scheduleIndex]!;
      const shouldBeExamined = scheduleOffset < 0
        ? index % 5 !== 0
        : scheduleOffset === 0 && index % 3 === 0;
      const queueStatus = shouldBeExamined
        ? StatusAntrean.SELESAI
        : scheduleOffset <= 0
          ? StatusAntrean.BATAL
          : StatusAntrean.MENUNGGU;
      queueNumbers[scheduleIndex] = queueNumbers[scheduleIndex]! + 1;

      if (!queueKeys.has(`${participant.id}:${schedule.id}`)) {
        queueRows.push({
          noAntrean: queueNumbers[scheduleIndex],
          pesertaId: participant.id,
          jadwalId: schedule.id,
          status: queueStatus,
          tanggal: scheduleDates[scheduleIndex]!,
        });
      }

      if (shouldBeExamined) {
        examinationRows.push({
          pesertaId: participant.id,
          jadwalId: schedule.id,
          tanggalPemeriksaan: new Date(scheduleDates[scheduleIndex]!.getTime() + ((index % 8) + 1) * 60 * 60 * 1000),
          tinggiBadan: participant.kategori === KategoriPeserta.BALITA ? 75 + (index % 60) / 10 : 145 + (index % 40) / 10,
          beratBadan: participant.kategori === KategoriPeserta.BALITA ? 8 + (index % 180) / 10 : 42 + (index % 380) / 10,
          lingkarKepala: participant.kategori === KategoriPeserta.BALITA ? 42 + (index % 160) / 10 : null,
          catatan: 'Pemeriksaan rutin.',
          statusPemeriksaan: StatusPemeriksaan.SELESAI,
        });
      }
    }

    const [insertedQueues, insertedExaminations] = await Promise.all([
      tx.antrean.createMany({ data: queueRows, skipDuplicates: true }),
      tx.pemeriksaan.createMany({ data: examinationRows, skipDuplicates: true }),
    ]);
    await tx.pemeriksaan.updateMany({
      where: {
        pesertaId: { in: seededParticipants.map(({ id }) => id) },
        catatan: 'Data pemeriksaan simulasi.',
      },
      data: { catatan: 'Pemeriksaan rutin.' },
    });

    return {
      insertedParticipants: insertedParticipants.count,
      insertedSchedules,
      insertedQueues: insertedQueues.count,
      insertedExaminations: insertedExaminations.count,
      totalDummyParticipants: seededParticipants.length,
    };
  }, { maxWait: 10_000, timeout: 120_000 });

  console.info('Synthetic data seeding completed:', result);
}

main()
  .catch((error: unknown) => {
    console.error('Dummy data seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
