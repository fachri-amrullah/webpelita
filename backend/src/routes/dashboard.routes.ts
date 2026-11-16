import { Router } from 'express';
import { prisma } from '../config/db.js';
import { success } from '../utils/response.js';

const router = Router();
const jakartaTimeZone = 'Asia/Jakarta';

function jakartaDayStart(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: jakartaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
}

router.get('/', async (_req, res, next) => {
  try {
    const todayStart = jakartaDayStart(new Date());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayRange = { gte: todayStart, lt: tomorrowStart };

    const [totalPeserta, antreanHariIni, pemeriksaanSelesaiHariIni, jadwalHariIni, jadwalMendatang] =
      await Promise.all([
        prisma.peserta.count(),
        prisma.antrean.count({
          where: { jadwal: { tanggal: todayRange }, status: { not: 'BATAL' } },
        }),
        prisma.pemeriksaan.count({
          where: {
            jadwal: { tanggal: todayRange },
            statusPemeriksaan: 'SELESAI',
          },
        }),
        prisma.jadwalPosyandu.findMany({
          where: { tanggal: todayRange },
          orderBy: { tanggal: 'asc' },
          include: { _count: { select: { antrean: true } } },
        }),
        prisma.jadwalPosyandu.findMany({
          where: {
            tanggal: { gte: tomorrowStart },
            status: 'MENDATANG',
          },
          orderBy: { tanggal: 'asc' },
          take: 4,
          include: { _count: { select: { antrean: true } } },
        }),
      ]);

    return success(res, {
      statistik: {
        totalPeserta,
        antreanHariIni,
        sudahDiperiksaHariIni: pemeriksaanSelesaiHariIni,
        belumDiperiksaHariIni: Math.max(0, antreanHariIni - pemeriksaanSelesaiHariIni),
      },
      jadwalHariIni,
      jadwalMendatang,
    }, 'Dashboard data loaded');
  } catch (error) {
    return next(error);
  }
});

export default router;
