# 🤖 AI Git Commit Suggester (Node.js)

Skrip Node.js ini membantu Anda membuat pesan commit Git yang lebih baik dan konsisten dengan memanfaatkan kecerdasan Google Gemini AI. Skrip akan menganalisis perubahan yang telah Anda _stage_ dan menyarankan beberapa opsi pesan commit yang mengikuti standar [Conventional Commits](https://www.conventionalcommits.org/). Anda juga diberi opsi untuk melakukan commit dengan tanda tangan GPG (`-S`).

## ✨ Fitur

- Menganalisis perubahan kode yang sudah di-_stage_ (`git diff --cached`).
- Menghasilkan 3 (tiga) saran pesan commit menggunakan Google Gemini AI.
- Saran pesan commit diformat mengikuti standar Conventional Commits.
- Antarmuka baris perintah (CLI) yang interaktif.
- Memungkinkan pengguna memilih dari saran, menulis pesan manual, atau membatalkan.
- Menawarkan opsi untuk menandatangani commit dengan GPG key (`git commit -S`).
- Pesan status dan error yang informatif.

## ⚙️ Prasyarat

Sebelum menjalankan skrip, pastikan Anda memiliki:

1.  **Node.js**: Versi 18.x atau yang lebih baru direkomendasikan.
2.  **npm**: Biasanya terinstal bersama Node.js.
3.  **Git**: Terinstal dan terkonfigurasi di sistem Anda.
4.  **Google Gemini API Key**: Anda bisa mendapatkannya dari [Google AI Studio](https://aistudio.google.com/app/apikey).
5.  **(Opsional) GPG Key**: Jika Anda ingin menggunakan fitur commit yang ditandatangani, pastikan GPG key Anda sudah terinstal dan terkonfigurasi dengan Git.
