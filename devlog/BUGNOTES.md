# Laporan Bug Proyek Edufika && Pembaruan Fitur
 1. Aplikasi tidak dapat logout setelah login. (Diperbaiki)
 2. Fake Kiosk mode tidak dapat dinonaktifkan sehingga pengguna terjebak. (Diperbaiki)
 3. Desain UI masih terasa kurang matang. (Lihat folder `edufika-prototype` di masa depan untuk referensi desain UI) (Diperbaiki)
 4. Implementasi token bermasalah, belum ada login Admin atau Student yang terkonfigurasi untuk kebutuhan debugging. (Diperbaiki)
 5. Fitur QR tidak berfungsi. (Diperbaiki)
 6. Fungsionalitas WebView tidak berjalan, browser tidak terbuka setelah kode QR dipindai. (Diperbaiki)
 7. Bug UI; aplikasi crash saat mencoba membuka UI React Native dan UI gagal terbuka saat dipanggil. (Diperbaiki)
 8. Fungsi URL Whitelist belum ada di Admin Dashboard. (Diperbaiki)
 9. Kiosk Mode tetap nonaktif setelah aplikasi di-reboot, status Kiosk Mode seharusnya tidak persisten antar peluncuran. (Diperbaiki)
 10. AdminID TIDAK BOLEH memiliki akses ke DeveloperAccessPanel; panel itu khusus developer dan hanya dapat diakses melalui passcode rahasia (`EDU_DEV_ACCESS`). (Diperbaiki)
 11. Bug deteksi violation; aplikasi mendeteksi "violation" setelah gagal memasukkan PIN proktor yang benar. Ini adalah bug yang tidak diinginkan. (Diperbaiki)
 12. Setelah student/admin logout, mereka harus diizinkan keluar dari aplikasi. Saat pengguna (student/admin) logout dari sesi mereka, aplikasi saat ini mati sendiri dan menonaktifkan Kiosk Mode sampai aplikasi di-reboot kembali. Mereka juga harus dapat keluar dari aplikasi dari layar login token sesi. Tambahkan tombol exit yang memungkinkan aplikasi dimatikan dengan cara tersebut. (Diperbaiki)
 13. Bug UI RN: `Keypad.tsx` belum memiliki opsi huruf kecil sehingga membatasi kemampuan mengetik huruf kecil. (Diperbaiki)
 14. DeveloperAccessPanel harus memiliki kemampuan untuk menghasilkan admin token bagi login admin. (Diperbaiki)
 15. Token harus dapat dikonfigurasi di Admin Dashboard saat dibuat. Token harus memiliki tanggal kedaluwarsa yang bisa diatur oleh admin saat pembuatan token. *Begitu waktu habis, pengguna harus diberi notifikasi pop-up bahwa waktu mereka habis dan mereka akan dikeluarkan dari aplikasi secara otomatis. (Diperbaiki)
 16. Tambahkan fungsi di Admin Dashboard untuk copy-paste token yang dihasilkan. (Diperbaiki)
 17. Simpan informasi logger secara lokal dalam file `logger.txt` agar admin dapat mengaksesnya di perangkat dan/atau mengirimkannya ke developer untuk analisis data. (Diperbaiki)
 18. Data URL yang di-whitelist harus disimpan di database agar aplikasi merujuk ke sana, bukan disimpan secara lokal. (Diperbaiki)
 19. Untuk layar web browser RN, tambahkan timer yang menunjukkan sisa waktu sampai session token kedaluwarsa. (Diperbaiki)
 20. Proctor PIN hanya di-set sekali saat awal ujian, disimpan di database, dan diperbarui setiap hari. Implementasikan UI RN, fungsionalitas, dan skema database (jika diperlukan) agar admin dapat mengirim PIN dari Admin Dashboard dan menyimpannya di database. (Diperbaiki)
 21. Hitung heartbeat/risk secara lokal untuk seluruh sesi (latensi rendah, tanpa false positive jaringan).
 22. Pertahankan sinkronisasi backend periodik (setiap beberapa detik) saat online, bukan hanya saat logout/pelanggaran.
 23. Kirim event kritis segera (`LOCKED`, `REVOKED`, `SCREEN_OFF`, dll.), tetapi penegakan lock tetap dilakukan secara lokal bahkan sebelum ada ack server.
 24. Pada mode offline, tandai sesi sebagai `DEGRADED` secara lokal, antrekan event disimpan, lalu direkonsiliasi saat koneksi kembali.

 - * Catatan : 15-02-2026
