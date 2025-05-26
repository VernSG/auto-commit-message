#!/usr/bin/env node
// -*- coding: utf-8 -*-

import os from "os";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import dotenv from "dotenv";
import simpleGit from "simple-git";
import readline from "readline";

// Muat environment variables dari .env
dotenv.config();

// Konfigurasi Gemini API
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error(
    "🔴 Error: GEMINI_API_KEY tidak ditemukan. Pastikan sudah ada di file .env"
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",
  // safetySettings: [ // Hapus komentar jika perlu menyesuaikan safety settings
  //     { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  //     { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  //     { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  //     { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  // ]
});

const git = simpleGit();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Helper function untuk menanyakan pertanyaan ke user.
 * @param {string} query
 * @returns {Promise<string>}
 */
function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * Mendapatkan perubahan yang sudah di-stage.
 * @returns {Promise<string|null>}
 */
async function getStagedChanges() {
  try {
    await git.revparse(["--is-inside-work-tree"]).catch(() => {
      throw new Error("Direktori ini bukan repositori Git.");
    });
    const diffOutput = await git.diff(["--cached"]);
    if (!diffOutput) {
      return null;
    }
    return diffOutput;
  } catch (error) {
    if (
      error.message.includes("not a git repository") ||
      error.message.includes("Direktori ini bukan repositori Git")
    ) {
      console.error("🔴 Error: Direktori ini bukan repositori Git.");
    } else {
      console.error(`🔴 Error saat mengambil perubahan: ${error.message}`);
    }
    return null;
  }
}

/**
 * Membuat prompt dan mengirim ke Gemini API untuk saran commit message.
 * @param {string} diffText
 * @returns {Promise<string[]|null>}
 */
async function generateCommitMessage(diffText) {
  if (!diffText) {
    return null;
  }
  const prompt = `
    Anda adalah asisten yang ahli dalam menulis pesan commit mengikuti standar Conventional Commits.
    Berdasarkan perubahan kode (git diff) berikut, yang mungkin mencakup beberapa file dan konteks berbeda, berikan persis 3 saran pesan commit.
    Setiap saran harus berada di baris baru dan HANYA berisi pesan commit itu sendiri, tanpa nomor, tanpa backtick di awal atau akhir pesan, atau teks tambahan lainnya.

    Format setiap pesan commit sebagai: <type>(<scope>): <subject>

    Contoh bagaimana ANDA HARUS memformat output (masing-masing di baris baru, TANPA nomor atau backtick):
    feat(auth): implement JWT authentication
    fix(ui): resolve button alignment issue
    docs(readme): update setup instructions

    Perubahan Kode (Git Diff):
    \`\`\`diff
    ${diffText}
    \`\`\`

    Saran Pesan Commit (HANYA 3 pesan commit, masing-masing di baris baru, tanpa penomoran atau karakter \`\`\` di awal/akhir):
    `;

  try {
    console.log("\n🔄 Menghubungi Gemini AI untuk saran commit message...");
    const result = await model.generateContent(prompt);
    const response = result.response;
    const rawText = response.text();

    if (rawText) {
      const suggestions = rawText
        .trim()
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s);
      const validSuggestions = suggestions.filter(
        (s) =>
          s.includes(":") &&
          s.includes("(") &&
          s.includes(")") &&
          !s.startsWith("```") &&
          !s.endsWith("```")
      );

      if (!validSuggestions.length && suggestions.length > 0) {
        console.warn(
          "⚠️ Peringatan: Saran dari Gemini mungkin tidak sepenuhnya sesuai format yang diminta. Menampilkan apa adanya."
        );
        return suggestions;
      } else if (!suggestions.length) {
        console.log("🔴 Gemini tidak memberikan saran yang dapat diproses.");
        return null;
      }
      return validSuggestions;
    } else {
      console.error("🔴 Gemini tidak memberikan respons teks.");
      return null;
    }
  } catch (error) {
    console.error(`🔴 Error saat menghubungi Gemini API: ${error}`);
    if (error.response && error.response.promptFeedback) {
      console.error("Prompt feedback:", error.response.promptFeedback);
    }
    return null;
  }
}

/**
 * Melakukan git commit dengan pesan yang diberikan, dengan opsi GPG sign.
 * @param {string} message
 * @param {boolean} useGpgSign
 */
async function commitChanges(message, useGpgSign = false) {
  try {
    const status = await git.status();
    let hasStagedChanges = status.staged.length > 0;

    if (!hasStagedChanges) {
      const stagedDiff = await git.diff(["--cached"]);
      if (!stagedDiff) {
        console.warn("⚠️ Tidak ada perubahan yang di-stage untuk di-commit.");
        console.log(
          "Gunakan 'git add <file>' untuk stage perubahan terlebih dahulu."
        );
        return;
      }
    }

    const commitOptions = useGpgSign ? ["-S"] : [];

    if (useGpgSign) {
      console.log("✍️ Melakukan commit dengan tanda tangan GPG (-S)...");
    } else {
      console.log("📝 Melakukan commit biasa...");
    }
    await git.commit(message, commitOptions); // simple-git meneruskan array options
    console.log(
      `\n✅ Berhasil melakukan commit dengan pesan: "${message}" ${
        useGpgSign ? "(Signed with GPG key)" : ""
      }`
    );
  } catch (error) {
    const errorMessage = error.message.toLowerCase();
    if (
      errorMessage.includes("nothing to commit") ||
      errorMessage.includes("no changes added to commit") ||
      errorMessage.includes("changes not staged for commit")
    ) {
      console.warn(
        "ℹ️ Tidak ada perubahan yang di-stage untuk di-commit atau Git dalam state yang tidak biasa."
      );
      console.log(
        "ℹ️ Pastikan Anda sudah 'git add' file yang ingin di-commit."
      );
    } else if (
      useGpgSign &&
      (errorMessage.includes("gpg failed to sign the data") ||
        errorMessage.includes("no default secret key"))
    ) {
      console.error(
        "🔴 Error GPG: Gagal menandatangani data. Pastikan GPG key Anda terkonfigurasi dengan benar di Git."
      );
      console.error(
        "   Anda bisa mengkonfigurasi GPG key dengan `git config --global user.signingkey YOUR_GPG_KEY_ID`"
      );
      console.error("   Dan pastikan GPG agent berjalan jika diperlukan.");
    } else {
      console.error(`🔴 Error Git saat melakukan commit: ${error.message}`);
    }
  }
}

/**
 * Memungkinkan pengguna memilih saran atau memasukkan pesan manual, dan memilih opsi GPG.
 * @param {string[]} suggestions
 */
async function selectAndCommit(suggestions) {
  let commitMessage = "";
  let useGpg = false;

  if (!suggestions || suggestions.length === 0) {
    console.log("ℹ️ Tidak ada saran commit yang valid dihasilkan.");
    const useManual = await askQuestion(
      "Apakah Anda ingin menulis pesan commit manual? (y/n): "
    );
    if (useManual.toLowerCase() === "y") {
      const manualMessage = await askQuestion("Masukkan pesan commit Anda: ");
      if (manualMessage.trim()) {
        commitMessage = manualMessage.trim();
      } else {
        console.log("Pesan commit tidak boleh kosong. Commit dibatalkan.");
        return;
      }
    } else {
      return; // User memilih tidak menulis manual, batalkan
    }
  } else {
    console.log("\n💡 Berikut adalah saran pesan commit dari Gemini AI:");
    suggestions.forEach((suggestion, i) => {
      console.log(`${i + 1}. ${suggestion}`);
    });
    console.log(`${suggestions.length + 1}. Tulis pesan manual`);
    console.log(`${suggestions.length + 2}. Batalkan`);

    while (true) {
      try {
        const choiceStr = await askQuestion(
          `Pilih opsi (1-${suggestions.length + 2}): `
        );
        const choice = parseInt(choiceStr, 10);

        if (choice >= 1 && choice <= suggestions.length) {
          commitMessage = suggestions[choice - 1];
          console.log(`Anda memilih: "${commitMessage}"`);
          break; // Keluar dari loop pilihan pesan
        } else if (choice === suggestions.length + 1) {
          const manualMessage = await askQuestion(
            "Masukkan pesan commit Anda: "
          );
          if (manualMessage.trim()) {
            commitMessage = manualMessage.trim();
            break; // Keluar dari loop pilihan pesan
          } else {
            console.log(
              "Pesan commit tidak boleh kosong. Coba lagi atau batalkan."
            );
            // Tetap dalam loop untuk memilih lagi atau membatalkan
          }
        } else if (choice === suggestions.length + 2) {
          console.log("Commit dibatalkan.");
          return; // Langsung keluar fungsi
        } else {
          console.log("Pilihan tidak valid.");
        }
      } catch (error) {
        console.log("Masukkan nomor yang valid.");
      }
    }
  }

  // Jika kita punya commit message (baik dari saran atau manual)
  if (commitMessage) {
    const confirmCommit = await askQuestion(
      `Lanjutkan dengan commit: "${commitMessage}"? (y/n): `
    );
    if (confirmCommit.toLowerCase() === "y") {
      const signCommitChoice = await askQuestion(
        "Tanda tangani commit dengan GPG key (-S)? (y/n, default n): "
      );
      useGpg = signCommitChoice.toLowerCase() === "y";
      await commitChanges(commitMessage, useGpg);
    } else {
      console.log("Commit dibatalkan oleh pengguna.");
    }
  }
}

/**
 * Fungsi utama untuk menjalankan skrip.
 */
async function main() {
  console.log("🔍 Mencari perubahan yang di-stage...");
  const diff = await getStagedChanges();

  if (diff) {
    console.log("✨ Perubahan terdeteksi.");
    const suggestions = await generateCommitMessage(diff);
    await selectAndCommit(suggestions); // selectAndCommit sekarang menangani kasus suggestions kosong/null juga
  } else {
    // Jika diff bernilai null, berarti:
    // 1. getStagedChanges() sudah mencetak error jika bukan repo Git atau ada error saat diff.
    // 2. Atau, getStagedChanges() mengembalikan null karena memang tidak ada staged changes (tanpa error).
    // Pesan di bawah ini akan ditampilkan setelah pesan error dari getStagedChanges (jika ada).
    console.log(
      "➡️ Tidak ada perubahan yang di-stage untuk diproses, atau terjadi error saat mengambil perubahan (lihat pesan di atas jika ada)."
    );
  }
  rl.close();
}

main().catch((error) => {
  console.error("🔴 Terjadi error tidak terduga di level atas:", error);
  rl.close();
  process.exit(1);
});
