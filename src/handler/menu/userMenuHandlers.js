// src/handler/userMenuHandlers.js

import {
  sortTitleKeys,
  sortDivisionKeys,
  getGreeting,
} from "../../utils/utilsHelper.js";
import { saveContactIfNew } from "../../service/googleContactsService.js";
import { formatToWhatsAppId, normalizeWhatsappNumber } from "../../utils/waHelper.js";
import {
  formatUserReport,
  formatFieldList,
  getFieldInfo,
  formatFieldUpdatePrompt,
  formatUpdateSuccess,
  formatOptionsList,
} from "./userMenuHelpers.js";
import {
  validateNRP,
  validateTextField,
  validateInstagram,
  validateTikTok,
  validateListSelection,
} from "./userMenuValidation.js";


export const SESSION_CLOSED_MESSAGE =
  "Terima kasih. Sesi ditutup. Ketik *userrequest* untuk memulai lagi.";

export const closeSession = async (
  session,
  chatId,
  waClient,
  message = SESSION_CLOSED_MESSAGE
) => {
  session.exit = true;
  await waClient.sendMessage(chatId, message);
};



// ===== Handler utama usermenu =====
export const userMenuHandlers = {
  main: async (session, chatId, _text, waClient, _pool, userModel) => {
    const pengirim = normalizeWhatsappNumber(chatId);
    const userByWA = await userModel.findUserByWhatsApp(pengirim);

    if (userByWA) {
      session.isDitbinmas = !!userByWA.ditbinmas;
      const salam = getGreeting();
      if (session.identityConfirmed && session.user_id === userByWA.user_id) {
        const msgText = `${salam}, Bapak/Ibu\n${formatUserReport(
          userByWA
        )}\n\nApakah Anda ingin melakukan perubahan data?\nBalas *ya* jika ingin update data, *tidak* untuk keluar, atau *batal* untuk menutup sesi.`;
        session.step = "tanyaUpdateMyData";
        await waClient.sendMessage(chatId, msgText.trim());
        return;
      }
    const msgText = `
${salam}, Bapak/Ibu
${formatUserReport(userByWA)}

Apakah data di atas benar milik Anda?
Balas *ya* jika benar, *tidak* jika bukan, atau *batal* untuk menutup sesi.
`.trim();
      session.step = "confirmUserByWaIdentity";
      session.user_id = userByWA.user_id;
      await waClient.sendMessage(chatId, msgText);
      return;
    }

    session.step = "inputUserId";
    await waClient.sendMessage(
      chatId,
      [
        "Untuk menampilkan data Anda, silakan ketik NRP/NIP Anda (hanya angka).",
        "Ketik *batal* untuk keluar.",
        "",
        "Contoh:",
        "87020990",
      ].join("\n")
    );
  },

  // --- Konfirmasi identitas (lihat data)
  confirmUserByWaIdentity: async (session, chatId, text, waClient, pool, userModel) => {
    const answer = text.trim().toLowerCase();
    if (answer === "ya") {
      session.identityConfirmed = true;
      session.step = "tanyaUpdateMyData";
      await waClient.sendMessage(
        chatId,
        "Apakah Anda ingin melakukan perubahan data?\nBalas *ya* jika ingin update data, *tidak* untuk keluar, atau *batal* untuk menutup sesi."
      );
    } else if (answer === "tidak") {
      await closeSession(session, chatId, waClient);
    } else if (answer === "batal") {
      await closeSession(session, chatId, waClient);
    } else {
      await waClient.sendMessage(
        chatId,
        "Jawaban tidak dikenali. Balas *ya* jika benar data Anda, *tidak* jika bukan, atau *batal* untuk menutup sesi."
      );
    }
  },

  // --- Konfirmasi identitas untuk update data
  confirmUserByWaUpdate: async (session, chatId, text, waClient, pool, userModel) => {
    const answer = text.trim().toLowerCase();
    if (answer === "ya") {
      session.identityConfirmed = true;
      session.updateUserId = session.user_id;
      session.step = "updateAskField";
      await waClient.sendMessage(chatId, formatFieldList(session.isDitbinmas));
      return;
    } else if (answer === "tidak") {
      await closeSession(session, chatId, waClient);
      return;
    } else if (answer === "batal") {
      await closeSession(session, chatId, waClient);
      return;
    }
    await waClient.sendMessage(
      chatId,
      "Jawaban tidak dikenali. Balas *ya* jika benar data Anda, *tidak* jika bukan, atau *batal* untuk menutup sesi."
    );
  },

  // --- Input User ID manual
  inputUserId: async (session, chatId, text, waClient, pool, userModel) => {
    const lower = text.trim().toLowerCase();
    if (lower === "batal") {
      session.exit = true;
      await waClient.sendMessage(chatId, "✅ Menu ditutup. Terima kasih.");
      return;
    }
    if (lower === "userrequest") {
      await userMenuHandlers.main(session, chatId, "", waClient, pool, userModel);
      return;
    }
    
    // Validate NRP/NIP using centralized validator
    const validation = validateNRP(text);
    if (!validation.valid) {
      await waClient.sendMessage(chatId, validation.error);
      return;
    }
    
    const digits = validation.digits;
    
    try {
      const user = await userModel.findUserById(digits);
      if (!user) {
        await waClient.sendMessage(
          chatId,
          `❌ NRP/NIP *${digits}* tidak ditemukan. Jika yakin benar, hubungi Opr Humas Polres Anda.`
        );
        await waClient.sendMessage(chatId, "Silakan masukkan NRP/NIP lain atau ketik *batal* untuk keluar.");
      } else {
        session.step = "confirmBindUser";
        session.bindUserId = digits;
        await waClient.sendMessage(
          chatId,
          `✅ NRP/NIP *${digits}* ditemukan.\n\n` +
            "Nomor WhatsApp ini belum terdaftar. Apakah Anda ingin menghubungkannya dengan akun tersebut?\n\n" +
            "Balas *ya* untuk menghubungkan atau *tidak* untuk membatalkan."
        );
        return;
      }
    } catch (err) {
      console.error('[userMenuHandlers] Error finding user:', err);
      await waClient.sendMessage(chatId, "❌ Terjadi kesalahan saat mengambil data. Silakan coba lagi.");
      await waClient.sendMessage(chatId, "Silakan masukkan NRP/NIP lain atau ketik *batal* untuk keluar.");
    }
  },

  confirmBindUser: async (session, chatId, text, waClient, pool, userModel) => {
    const answer = text.trim().toLowerCase();
    const waNum = normalizeWhatsappNumber(chatId);
    if (answer === "ya") {
      const user_id = session.bindUserId;
      await userModel.updateUserField(user_id, "whatsapp", waNum);
      await saveContactIfNew(formatToWhatsAppId(waNum));
      const user = await userModel.findUserById(user_id);
      session.isDitbinmas = !!user.ditbinmas;
      await waClient.sendMessage(
        chatId,
        `✅ Nomor WhatsApp telah dihubungkan ke NRP/NIP *${user_id}*. Berikut datanya:\n` +
          formatUserReport(user)
      );
      session.identityConfirmed = true;
      session.user_id = user_id;
      session.step = "tanyaUpdateMyData";
      await waClient.sendMessage(
        chatId,
        "Apakah Anda ingin melakukan perubahan data?\nBalas *ya* jika ingin update data, *tidak* untuk keluar, atau *batal* untuk menutup sesi."
      );
      return;
    }
    if (answer === "tidak") {
      await waClient.sendMessage(
        chatId,
        "Nomor WhatsApp ini tetap tidak terhubung dengan NRP/NIP. Jika ingin mencoba lagi, ketik *userrequest* atau hubungi operator bila membutuhkan bantuan."
      );
      session.exit = true;
      return;
    }
    await waClient.sendMessage(
      chatId,
      "Balas *ya* untuk menghubungkan nomor, atau *tidak* untuk membatalkan."
    );
  },

  confirmBindUpdate: async (session, chatId, text, waClient, pool, userModel) => {
    const ans = text.trim().toLowerCase();
    const waNum = normalizeWhatsappNumber(chatId);
    if (ans === "ya") {
      const nrp = session.updateUserId;
      await userModel.updateUserField(nrp, "whatsapp", waNum);
      await saveContactIfNew(formatToWhatsAppId(waNum));
      await waClient.sendMessage(chatId, `✅ Nomor berhasil dihubungkan ke NRP/NIP *${nrp}*.`);
      session.identityConfirmed = true;
      session.user_id = nrp;
      session.step = "updateAskField";
      await waClient.sendMessage(chatId, formatFieldList(session.isDitbinmas));
      return;
    }
    if (ans === "tidak") {
      await waClient.sendMessage(
        chatId,
        "Nomor WhatsApp ini tidak dihubungkan ke NRP/NIP. Ketik *userrequest* untuk kembali ke menu atau hubungi operator bila membutuhkan bantuan."
      );
      session.exit = true;
      return;
    }
    await waClient.sendMessage(
      chatId,
      "Balas *ya* untuk menghubungkan nomor, atau *tidak* untuk membatalkan."
    );
  },

  // --- Pilih field update
  updateAskField: async (session, chatId, text, waClient, pool, userModel) => {
    const allowedFields = [
      { key: "nama", label: "Nama" },
      { key: "pangkat", label: "Pangkat" },
      { key: "satfung", label: "Satfung" },
      { key: "jabatan", label: "Jabatan" },
      { key: "insta", label: "Instagram" },
      { key: "tiktok", label: "TikTok" },
    ];
    if (session.isDitbinmas) {
      allowedFields.push({ key: "desa", label: "Desa Binaan" });
    }

    const lower = text.trim().toLowerCase();
    const maxOption = allowedFields.length;
    if (lower === "batal") {
      session.exit = true;
      await waClient.sendMessage(chatId, "✅ Menu ditutup. Terima kasih.");
      return;
    }
    if (!new RegExp(`^[1-${maxOption}]$`).test(lower)) {
      await waClient.sendMessage(
        chatId,
        "❌ Pilihan tidak valid. Balas dengan angka sesuai daftar (contoh: 1) atau ketik *batal* untuk keluar."
      );
      await waClient.sendMessage(chatId, formatFieldList(session.isDitbinmas));
      return;
    }

    const idx = parseInt(lower) - 1;
    const field = allowedFields[idx].key;
    session.updateField = field;
    
    // Get current user data to show current value
    let currentUser = null;
    try {
      currentUser = await userModel.findUserById(session.updateUserId);
    } catch (e) {
      console.error('[updateAskField] Error fetching user:', e);
    }

    // Tampilkan list pangkat/satfung jika perlu
    if (field === "pangkat") {
      const titles = await userModel.getAvailableTitles();
      if (titles && titles.length) {
        const sorted = sortTitleKeys(titles, titles);
        // Simpan list pangkat di session agar bisa dipakai saat validasi
        session.availableTitles = sorted;
        const listMsg = formatOptionsList(sorted, "Daftar pangkat yang dapat dipilih");
        await waClient.sendMessage(chatId, listMsg);
      }
    }
    if (field === "satfung") {
      let clientId = null;
      try {
        const user = await userModel.findUserById(session.updateUserId);
        clientId = user?.client_id || null;
      } catch (e) { console.error('[updateAskField] Error fetching clientId:', e); }
      const satfung = userModel.mergeStaticDivisions(
        await userModel.getAvailableSatfung(clientId)
      );
      if (satfung && satfung.length) {
        const sorted = sortDivisionKeys(satfung);
        session.availableSatfung = sorted;
        const listMsg = formatOptionsList(sorted, "Daftar satfung yang dapat dipilih");
        await waClient.sendMessage(chatId, listMsg);
      }
    }
    
    session.step = "updateAskValue";
    
    // Show prompt with current value
    const fieldInfo = getFieldInfo(field, currentUser);
    const prompt = formatFieldUpdatePrompt(field, allowedFields[idx].label, fieldInfo.value || fieldInfo.currentValue);
    await waClient.sendMessage(chatId, prompt);
  },

  updateAskValue: async (session, chatId, text, waClient, pool, userModel) => {
    const lower = text.trim().toLowerCase();
    if (lower === "batal") {
      session.exit = true;
      await waClient.sendMessage(chatId, "✅ Perubahan dibatalkan. Ketik *userrequest* untuk memulai lagi.");
      return;
    }
    const user_id = session.updateUserId;
    let field = session.updateField;
    let value = text.trim();

    // Normalisasi field DB
    const dbField = field === "pangkat" ? "title" : field === "satfung" ? "divisi" : field;

    // Validasi khusus per field dengan centralized validators
    try {
      if (dbField === "title") {
        const titles = session.availableTitles || (await userModel.getAvailableTitles());
        const validation = validateListSelection(value, titles);
        if (!validation.valid) {
          await waClient.sendMessage(chatId, validation.error);
          return;
        }
        value = validation.selected;
      } else if (dbField === "divisi") {
        let clientId = null;
        try {
          const user = await userModel.findUserById(session.updateUserId);
          clientId = user?.client_id || null;
        } catch (e) { 
          console.error('[updateAskValue] Error fetching clientId:', e); 
        }
        const satfungList = userModel.mergeStaticDivisions(
          session.availableSatfung || (await userModel.getAvailableSatfung(clientId))
        );
        const validation = validateListSelection(value, satfungList);
        if (!validation.valid) {
          await waClient.sendMessage(chatId, validation.error);
          return;
        }
        value = validation.selected;
      } else if (dbField === "insta") {
        const validation = validateInstagram(value);
        if (!validation.valid) {
          await waClient.sendMessage(chatId, validation.error);
          return;
        }
        value = validation.username;
        
        // Check for duplicate Instagram
        const existing = await userModel.findUserByInsta(value);
        if (existing && existing.user_id !== user_id) {
          await waClient.sendMessage(
            chatId,
            "❌ Akun Instagram tersebut sudah terdaftar pada pengguna lain. Silakan gunakan akun lain atau ketik *batal* untuk membatalkan."
          );
          return;
        }
      } else if (dbField === "tiktok") {
        const validation = validateTikTok(value);
        if (!validation.valid) {
          await waClient.sendMessage(chatId, validation.error);
          return;
        }
        value = validation.username;
        
        // Check for duplicate TikTok
        const existing = await userModel.findUserByTiktok(value);
        if (existing && existing.user_id !== user_id) {
          await waClient.sendMessage(
            chatId,
            "❌ Akun TikTok tersebut sudah terdaftar pada pengguna lain. Silakan gunakan akun lain atau ketik *batal* untuk membatalkan."
          );
          return;
        }
      } else if (dbField === "whatsapp") {
        value = normalizeWhatsappNumber(value);
      } else if (["nama", "jabatan", "desa"].includes(dbField)) {
        const validation = validateTextField(dbField, value);
        if (!validation.valid) {
          await waClient.sendMessage(chatId, validation.error);
          return;
        }
        value = validation.value;
      }

      // Update database with proper error handling
      await userModel.updateUserField(user_id, dbField, value);
      
      // Save contact if WhatsApp field was updated
      if (dbField === "whatsapp" && value) {
        try {
          await saveContactIfNew(formatToWhatsAppId(value));
        } catch (err) {
          console.error('[updateAskValue] Error saving contact:', err);
          // Non-critical error, continue
        }
      }
      
      // Format display value
      const displayValue = (dbField === "insta" || dbField === "tiktok") ? `@${value}` : value;
      const fieldDisplayName = dbField === "title" ? "Pangkat" : 
                              dbField === "divisi" ? "Satfung" : 
                              dbField === "desa" ? "Desa Binaan" : 
                              field.charAt(0).toUpperCase() + field.slice(1);
      
      const successMsg = formatUpdateSuccess(fieldDisplayName, displayValue, user_id);
      await waClient.sendMessage(chatId, successMsg);
      
      // Clean up session data
      delete session.availableTitles;
      delete session.availableSatfung;
      
      // Return to main menu
      await userMenuHandlers.main(session, chatId, "", waClient, pool, userModel);
      
    } catch (err) {
      console.error('[updateAskValue] Error updating field:', err);
      await waClient.sendMessage(
        chatId,
        "❌ Terjadi kesalahan saat memperbarui data. Silakan coba lagi atau ketik *batal* untuk keluar."
      );
    }
  },

  tanyaUpdateMyData: async (session, chatId, text, waClient, pool, userModel) => {
    const answer = text.trim().toLowerCase();
    if (answer === "ya") {
      session.step = "confirmUserByWaUpdate";
      await userMenuHandlers.confirmUserByWaUpdate(
        session,
        chatId,
        "ya",
        waClient,
        pool,
        userModel
      );
      return;
    } else if (answer === "tidak") {
      await closeSession(session, chatId, waClient);
      return;
    } else if (answer === "batal") {
      await closeSession(session, chatId, waClient);
      return;
    }
    await waClient.sendMessage(
      chatId,
      "Balas *ya* jika ingin update data, *tidak* untuk kembali, atau *batal* untuk menutup sesi."
    );
  },
};
