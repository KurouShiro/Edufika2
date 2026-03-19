# CHANGELOG In-App Quiz Edufika

Dokumen ini mencatat perubahan yang telah diimplementasikan pada fitur **in-app quiz** Edufika berdasarkan kondisi codebase, catatan devlog, serta patch pengembangan yang telah dikerjakan selama proses iterasi.

Dokumen ini berfokus pada:
- alur quiz siswa
- alur konfigurasi quiz guru/proktor
- backend sesi quiz
- penilaian dan hasil quiz
- integrasi anti-cheat/violation
- penyimpanan lokal hasil quiz
- integrasi Google Drive untuk `QuizData`

Tanggal pembaruan dokumen: **19 Maret 2026**

---

## Ringkasan Tahap Pengembangan

### Tahap 1 - Fondasi Quiz
Fitur in-app quiz mulai dibangun sebagai mode ujian terpisah dari browser lockdown. Pada tahap ini, backend menyiapkan pondasi sesi quiz, tabel attempt, penyimpanan jawaban, dan perhitungan nilai berbasis poin.

### Tahap 2 - Alur Guru/Proktor
UI React Native untuk guru/proktor ditambahkan agar pembuatan quiz dapat dilakukan langsung dari aplikasi. Tahap ini meliputi layar konfigurasi quiz, builder soal, pengikatan token, dan cache draft konfigurasi.

### Tahap 3 - Alur Siswa
Alur login siswa, daftar quiz aktif, mulai quiz, simpan jawaban, dan submit hasil disambungkan ke backend. Tahap ini juga memperkenalkan layar hasil quiz yang menampilkan nilai akhir dan review jawaban.

### Tahap 4 - Keamanan dan Audit
Quiz in-app diintegrasikan dengan sistem violation, risk score, heartbeat, integritas sesi, serta audit hasil. Tujuannya adalah agar mode quiz mengikuti standar pengamanan yang sama dengan mode browser.

### Tahap 5 - Ekspor dan Sinkronisasi Hasil
Hasil quiz mulai disimpan ke file lokal, diekspor ke Google Drive, diberi health check koneksi, dan diorganisasi ke struktur folder yang lebih rapi berdasarkan kelas dan peminatan.

---

## Riwayat Patch

## Patch IQ-01 - Fondasi Backend In-App Quiz

### Fitur Baru
- Menambahkan mode sesi `IN_APP_QUIZ` pada backend.
- Menambahkan endpoint backend untuk:
  - mulai quiz
  - join quiz
  - simpan jawaban
  - selesai quiz
  - ambil hasil quiz
  - unggah hasil quiz
- Menambahkan struktur data backend untuk:
  - konfigurasi quiz
  - subject quiz
  - bank soal
  - option jawaban
  - quiz attempt siswa
  - jawaban siswa

### Perubahan Teknis
- Perhitungan nilai backend disusun berdasarkan `points` per soal.
- Dukungan `show_results_immediately`, `allow_review`, dan `randomize_questions` disiapkan di backend.
- Data profil siswa untuk attempt quiz disimpan bersama hasil pengerjaan.

### Dampak
- Edufika memiliki fondasi penuh untuk menjalankan quiz native/in-app tanpa bergantung pada WebView browser.

---

## Patch IQ-02 - Alur Login dan Masuk Sesi Quiz

### Fitur Baru
- Menambahkan login siswa berbasis **Basic Auth** ke backend.
- Menambahkan layar **InAppQuizSelection** untuk menampilkan daftar quiz aktif.
- Menambahkan alur **join quiz session** sebelum siswa masuk ke layar pengerjaan.

### Perubahan Teknis
- Setelah login siswa berhasil, aplikasi memuat daftar quiz aktif dari backend.
- Saat siswa memilih quiz, aplikasi meminta:
  - `access_signature`
  - `device_binding_id`
  - `session_id`
  - `student_token`
  - mode ujian aktif

### Perbaikan
- Reset state student dan sesi quiz diperjelas saat login ulang agar data lama tidak tercampur dengan sesi baru.

### Dampak
- Alur masuk quiz menjadi konsisten: login siswa -> pilih quiz -> join sesi -> kerjakan quiz.

---

## Patch IQ-03 - Layar Konfigurasi Quiz Guru

### Fitur Baru
- Menambahkan **QuizTeacherScreen** sebagai layar konfigurasi utama quiz.
- Menambahkan pengaturan:
  - judul quiz
  - deskripsi
  - durasi
  - tampilkan hasil langsung
  - izin review hasil
  - randomisasi soal
  - subject code / subject name

### Pengembangan Fungsional
- Menambahkan pilihan akses quiz:
  - menggunakan token siswa
  - tanpa token siswa / basic auth
- Menambahkan logika agar quiz dapat dikunci ke token tertentu jika dibutuhkan.

### Perbaikan Bug
- Memperbaiki hilangnya data konfigurasi ketika berpindah layar dengan menambahkan cache state untuk layar guru.
- Menjaga draft konfigurasi agar tidak ter-reset saat navigasi antar layar admin.

### Dampak
- Guru/proktor dapat menyiapkan quiz secara lebih fleksibel tanpa kehilangan konfigurasi saat berpindah menu.

---

## Patch IQ-04 - Builder Soal Dinamis

### Fitur Baru
- Menambahkan **QuizQuestionBuilderScreen** untuk menyusun soal secara dinamis.
- Jumlah soal dapat ditentukan oleh guru/proktor, lalu form per soal muncul otomatis.
- Mendukung beberapa tipe soal, termasuk single choice dan variasi multi-answer.

### Pengembangan Fungsional
- Menambahkan input **nilai/poin per soal** agar nilai akhir mengikuti preferensi grading guru.
- Menambahkan selector quiz target di bagian bawah builder agar soal disimpan ke quiz yang tepat.
- Menambahkan export draft builder ke file dan Google Drive.

### Perbaikan Bug
- Memperbaiki kondisi di mana soal tidak tersimpan ke quiz yang benar.
- Menambahkan validasi agar submit/generate tidak berjalan sebelum target quiz dipilih.
- Menstabilkan alur builder agar draft soal lebih konsisten terhadap cache admin.

### Dampak
- Soal tidak lagi dianggap berdiri sendiri; builder sekarang lebih jelas terhubung ke konfigurasi quiz yang aktif.

---

## Patch IQ-05 - Alur Pengerjaan Quiz Siswa

### Fitur Baru
- Menambahkan **QuizStudentScreen** untuk pengerjaan quiz end-to-end.
- Fitur utama:
  - input data siswa
  - mulai quiz
  - navigasi soal berikut/sebelumnya
  - simpan jawaban ke backend
  - submit quiz
  - tampilkan nilai akhir

### Pengembangan Fungsional
- Skor akhir ditampilkan sebagai angka besar di tengah layar hasil.
- Di bawah skor akhir tersedia dropdown untuk menampilkan jawaban benar/salah jika diizinkan sesi.
- Jika `show_results_immediately` dimatikan, detail hasil disembunyikan sesuai kebijakan quiz.

### Perbaikan Bug
- Perbaikan formatting layar hasil agar lebih mudah dibaca.
- Perbaikan alur finish quiz agar ekspor hasil berjalan setelah payload nilai akhir diterima.

### Dampak
- Pengalaman siswa menjadi lengkap dari mulai masuk quiz hingga melihat hasil akhir.

---

## Patch IQ-06 - Integrasi Violation dan Risk Score

### Fitur Baru
- Quiz in-app dihubungkan ke sistem violation yang sebelumnya dipakai pada mode ujian browser.
- `QuizStudentScreen` kini dianggap sebagai layar ujian aktif untuk:
  - risk score
  - heartbeat session
  - sync ke backend
  - deteksi multi-window / split-screen

### Pengembangan Fungsional
- Menambahkan riwayat violation berbentuk audit record:
  - waktu kejadian
  - tipe violation
  - detail
  - tambahan risk score
  - sumber event

### Perbaikan Bug
- State violation di-reset dengan lebih rapi ketika siswa memulai sesi quiz atau login ulang.
- Integritas warning dan risk state tidak lagi terbawa sembarangan dari sesi sebelumnya.

### Dampak
- Quiz in-app memiliki lapisan keamanan yang sejajar dengan mode exam browser.

---

## Patch IQ-07 - Penyimpanan Lokal Hasil Quiz

### Fitur Baru
- Hasil quiz diekspor ke file `.txt` lokal sebelum atau saat proses sinkronisasi.
- Folder lokal **QuizResult** digunakan untuk penyimpanan hasil quiz di perangkat.

### Pengembangan Fungsional
- Isi file hasil quiz memuat:
  - identitas quiz
  - identitas siswa
  - jumlah soal
  - jumlah benar/salah
  - skor
  - durasi
  - detail hasil per soal

### Perbaikan Bug
- Perbaikan kasus folder hasil quiz tidak terbentuk.
- Menambahkan fallback penyimpanan lokal ketika upload Google Drive gagal.

### Dampak
- Hasil quiz tetap tersimpan walaupun koneksi Drive atau jaringan bermasalah.

---

## Patch IQ-08 - Permission Gate dan Kiosk-Safe Flow

### Fitur Baru
- Menambahkan **Permissions.tsx** sebagai layar permission terpisah.
- Layar permission dijalankan saat startup sebelum login.

### Pengembangan Fungsional
- Permission screen digunakan untuk menangani kebutuhan akses file di luar alur pengerjaan quiz.
- Kiosk/startup gate diatur agar permission flow tidak terkunci oleh mode kiosk saat startup.

### Perbaikan Bug
- Mengatasi kasus prompt permission tidak muncul ketika masih berada dalam mode kiosk.
- Mengurangi risiko black screen pada flow hasil quiz yang sebelumnya terganggu oleh request permission.

### Dampak
- Alur permission menjadi lebih aman dan lebih stabil untuk perangkat ujian yang memakai kiosk mode.

---

## Patch IQ-09 - Integrasi Google Drive Dasar

### Fitur Baru
- Menambahkan upload hasil quiz ke Google Drive melalui backend `edufika-session-api`.
- Menambahkan fallback folder `QuizData` jika folder Drive target tidak bisa dipakai.

### Pengembangan Fungsional
- Hasil upload sekarang mengembalikan informasi:
  - `file_id`
  - `folder_name`
  - `folder_id`
- Hasil tersebut ditampilkan pada layar hasil quiz.

### Perbaikan Bug
- Menambahkan fallback agar file tetap diunggah ke folder app-managed ketika folder Drive terkonfigurasi tidak writable.
- Menampilkan pesan error upload Google Drive secara lebih jelas pada UI hasil quiz.

### Dampak
- Admin/proktor dapat mengetahui apakah file benar-benar berhasil dikirim ke Drive dan ke folder mana file tersebut ditempatkan.

---

## Patch IQ-10 - Google Drive Health Check

### Fitur Baru
- Menambahkan endpoint backend `/health/drive`.
- Menambahkan health card Google Drive pada:
  - `ExamSelectionScreen`
  - `InAppQuizSelection`
  - `QuizStudentScreen`

### Pengembangan Fungsional
- Health check menampilkan status:
  - backend Drive configured / tidak
  - koneksi berhasil / gagal
  - nama folder aktif
  - pesan error jika ada

### Perbaikan Bug
- Mempermudah diagnosis masalah seperti `invalid_client`, refresh token tidak cocok, atau folder Drive tidak dapat diakses.

### Dampak
- Validasi integrasi Drive tidak lagi harus ditebak dari log server saja; statusnya bisa dilihat langsung dari aplikasi.

---

## Patch IQ-11 - Audit Hasil Quiz Bilingual dan Catatan Pelanggaran

### Fitur Baru
- Isi file hasil quiz sekarang memiliki dua bahasa:
  - English
  - Bahasa Indonesia
- Menambahkan section **Violation Audit / Audit Pelanggaran** ke file hasil quiz.

### Isi Audit Baru
- status apakah siswa melakukan pelanggaran pada sesi tersebut
- jumlah pelanggaran
- risk score saat ini
- ambang lock risk score
- status apakah integrity warning pernah muncul
- pesan integritas terakhir
- daftar pelanggaran beserta:
  - timestamp
  - tipe
  - detail
  - delta risk
  - sumber event

### Perbaikan Bug
- Riwayat violation kini ikut dibawa ke proses ekspor hasil quiz.
- Metadata upload hasil quiz ikut diperluas agar sinkron dengan isi file audit.

### Dampak
- Guru/proktor mendapat catatan yang jauh lebih lengkap untuk analisis perilaku siswa selama quiz berlangsung.

---

## Patch IQ-12 - Organisasi Folder QuizData per Kelas dan Peminatan

### Fitur Baru
- Struktur folder Google Drive untuk `QuizData` kini lebih terorganisasi.
- File hasil quiz akan diunggah ke struktur:
  - `QuizData/<Kelas>/<Peminatan>`

### Contoh
- `QuizData/Fase E/RPL`
- `QuizData/Fase F/TKJ`
- `QuizData/Fase FL/AKL`

### Pengembangan Fungsional
- Backend otomatis:
  - mencari folder kelas di bawah `QuizData`
  - membuat folder kelas jika belum ada
  - mencari folder peminatan di dalam folder kelas
  - membuat folder peminatan jika belum ada
- Metadata upload dari app diperluas agar mengirim:
  - `student_class`
  - `student_elective`
  - `student_school_year`
  - `student_token`

### Fallback
- Jika data kelas atau peminatan kosong, backend menggunakan fallback:
  - `Tanpa Kelas`
  - `Tanpa Peminatan`

### Dampak
- Guru dapat menelusuri hasil quiz per fase dan per jurusan/peminatan dengan jauh lebih rapi.

---

## Patch IQ-13 - Developer Controls yang Relevan untuk Pengujian Quiz

### Fitur Baru
- Menambahkan toggle akses screenshot di `DeveloperAccessScreen`.
- Menjaga toggle keamanan lain tetap tersedia untuk pengujian:
  - kiosk mode
  - violation system
  - split-screen detection

### Dampak
- Pengujian internal terhadap alur quiz, hasil, dan permission menjadi lebih mudah dilakukan tanpa harus mematikan seluruh lapisan keamanan secara permanen.

---

## Ringkasan Dampak Keseluruhan

Setelah seluruh patch di atas:
- Edufika sudah memiliki mode **in-app quiz** yang fungsional dari sisi guru maupun siswa.
- Penilaian quiz sudah mendukung bobot nilai per soal.
- Hasil quiz dapat disimpan lokal dan diunggah ke Google Drive.
- Audit pelanggaran ikut terdokumentasi dalam file hasil.
- Struktur penyimpanan di Google Drive telah ditingkatkan menjadi lebih rapi per kelas dan peminatan.
- Integrasi keamanan quiz telah sejajar dengan mekanisme violation/risk yang digunakan pada mode browser.

---

## Catatan Lanjutan yang Disarankan

- Standarkan penamaan kelas seperti `Fase E`, `Fase F`, dan `Fase FL` agar tidak tercipta folder ganda akibat perbedaan huruf besar/kecil.
- Standarkan penamaan peminatan seperti `RPL`, `TKJ`, `LK`, `LK2`, `AKL`, `MPLB1`, dan `MPLB2`.
- Pertimbangkan penambahan subfolder per tahun ajaran atau per nama ujian jika volume file `QuizData` semakin besar.
- Pertimbangkan panel monitoring hasil quiz khusus guru agar tidak perlu selalu membuka file Drive secara manual.
