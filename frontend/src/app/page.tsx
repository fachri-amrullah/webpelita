import Image from 'next/image';
import Link from 'next/link';
import RoleLoginChoice from '../components/RoleLoginChoice';
import styles from './page.module.css';

const features = [
  {
    number: '01',
    title: 'Data peserta',
    description: 'Simpan dan temukan informasi peserta Posyandu dengan lebih mudah.',
  },
  {
    number: '02',
    title: 'Jadwal & antrean',
    description: 'Atur jadwal kegiatan dan pantau antrean dalam satu sistem.',
  },
  {
    number: '03',
    title: 'Hasil pemeriksaan',
    description: 'Catat hasil pemeriksaan dan lihat rekap pelayanan Posyandu.',
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="PELITA, halaman utama">
          <Image src="/logo.png" alt="" width={48} height={48} priority />
          <span>PELITA</span>
        </Link>
        <Link href="/login" className={styles.headerLink}>Masuk ke sistem</Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Sistem Informasi Posyandu</span>
          <h1>
            Pelayanan Posyandu
            <span>lebih tertata, lebih dekat.</span>
          </h1>
          <p>
            PELITA membantu kader mengelola data peserta, jadwal kegiatan,
            antrean, dan catatan pemeriksaan dalam satu tempat.
          </p>
          <RoleLoginChoice />
          <div className={styles.note}>
            <span className={styles.statusDot} />
            Mendukung pencatatan layanan Posyandu yang lebih terorganisir
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Ringkasan fitur PELITA">
          <div className={styles.visualGlow} />
          <div className={styles.dashboardCard}>
            <div className={styles.cardTop}>
              <div>
                <span className={styles.cardCaption}>RUANG KERJA KADER</span>
                <strong>Semua layanan, satu tempat.</strong>
              </div>
              <Image src="/logo.png" alt="" width={42} height={42} />
            </div>
            <div className={styles.previewRows}>
              <div className={styles.previewRow}>
                <span className={`${styles.previewIcon} ${styles.purpleIcon}`} aria-hidden="true">01</span>
                <span><strong>Data peserta</strong><small>Informasi tersimpan rapi</small></span>
                <span className={styles.rowArrow} aria-hidden="true">↗</span>
              </div>
              <div className={styles.previewRow}>
                <span className={`${styles.previewIcon} ${styles.pinkIcon}`} aria-hidden="true">02</span>
                <span><strong>Jadwal Posyandu</strong><small>Kegiatan mudah dipantau</small></span>
                <span className={styles.rowArrow} aria-hidden="true">↗</span>
              </div>
              <div className={styles.previewRow}>
                <span className={`${styles.previewIcon} ${styles.greenIcon}`} aria-hidden="true">03</span>
                <span><strong>Catatan pemeriksaan</strong><small>Riwayat layanan tercatat</small></span>
                <span className={styles.rowArrow} aria-hidden="true">↗</span>
              </div>
            </div>
            <div className={styles.cardFooter}>
              <span className={styles.footerMark} aria-hidden="true">✦</span>
              <span>Berfokus pada pelayanan ibu dan anak</span>
            </div>
          </div>
          <span className={styles.floatingBadge}><span aria-hidden="true">♥</span> Tumbuh bersama keluarga sehat</span>
        </div>
      </section>

      <section id="fitur" className={styles.features}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>Dirancang untuk kegiatan Posyandu</span>
          <h2>Hal penting dalam satu alur kerja.</h2>
        </div>
        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <article key={feature.number} className={styles.featureCard}>
              <span className={styles.featureNumber}>{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>PELITA · Sistem Informasi Posyandu</span>
        <Link href="/login">Masuk ke sistem <span aria-hidden="true">→</span></Link>
      </footer>
    </main>
  );
}
