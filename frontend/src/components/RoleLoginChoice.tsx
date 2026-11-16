'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from '../app/page.module.css';

export default function RoleLoginChoice() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  function chooseRole(role: 'KADER' | 'ADMIN') {
    setIsOpen(false);
    router.push(`/login?role=${role}`);
  }

  return (
    <div className={styles.actions}>
      <div ref={menuRef} className={styles.roleMenu} onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-controls="role-login-menu"
          onClick={() => setIsOpen((open) => !open)}
          className={styles.roleSelectButton}
        >
          <span className={styles.roleButtonText}>
            <span className={styles.roleButtonEyebrow}>Pilih akses</span>
            <span>Masuk sebagai</span>
            <strong>Kader</strong>
          </span>
          <span className={`${styles.roleSelectArrow} ${isOpen ? styles.roleSelectArrowOpen : ''}`} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        {isOpen && (
          <div id="role-login-menu" role="menu" aria-label="Pilih peran untuk masuk" className={styles.roleMenuOptions}>
            <p className={styles.roleMenuHeading}>Pilih jenis akun</p>
            <button type="button" role="menuitem" onClick={() => chooseRole('KADER')}>
              <span className={`${styles.roleOptionIcon} ${styles.kaderIcon}`} aria-hidden="true">K</span>
              <span className={styles.roleOptionText}>
                <strong>Kader</strong>
                <small>Kelola pelayanan Posyandu</small>
              </span>
              <svg className={styles.roleOptionArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" role="menuitem" onClick={() => chooseRole('ADMIN')}>
              <span className={`${styles.roleOptionIcon} ${styles.adminIcon}`} aria-hidden="true">A</span>
              <span className={styles.roleOptionText}>
                <strong>Super Admin</strong>
                <small>Akses pengelolaan administrator</small>
              </span>
              <svg className={styles.roleOptionArrow} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <a href="#fitur" className={styles.secondaryButton}>Kenali fitur</a>
    </div>
  );
}
