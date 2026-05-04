const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const QRCode = require("qrcode");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");

const prefix = ".";

function bufferFromStream(stream) {
  return new Promise(async (resolve) => {
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    resolve(buffer);
  });
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("📱 GEADA BOT - escaneie:");
      const qrImage = await QRCode.toDataURL(qr);
      console.log(qrImage);
    }

    if (connection === "open") {
      console.log("❄️ GEADA BOT CONECTADO!");
    }

    if (connection === "close") {
      console.log("❌ Reconectando...");
      start();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || from;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    const isGroup = from.endsWith("@g.us");

    let admins = [];
    if (isGroup) {
      const metadata = await sock.groupMetadata(from);
      admins = metadata.participants
        .filter(p => p.admin)
        .map(p => p.id);
    }

    const isAdmin = admins.includes(sender);

    console.log("Mensagem:", text);

    // =================
    // COMANDOS
    // =================

    if (text === prefix + "oi") {
      await sock.sendMessage(from, { text: "FALA AI 😎" });
    }

    if (text === prefix + "menu") {
      await sock.sendMessage(from, {
        text: `❄️ GEADA BOT

.oi
.menu
.s

ADMIN:
.ban
.add
.abrir
.fechar`
      });
    }

    // =================
    // FIGURINHA
    // =================

    if (text === prefix + "s") {
      try {
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        const image =
          msg.message.imageMessage ||
          quoted?.imageMessage;

        if (!image) {
          await sock.sendMessage(from, {
            text: "❌ Envie ou responda uma imagem com .s"
          });
          return;
        }

        const stream = await downloadContentFromMessage(image, "image");
        const buffer = await bufferFromStream(stream);

        const sticker = new Sticker(buffer, {
          pack: "GEADA BOT ❄️",
          author: "MICHELsw17",
          type: StickerTypes.FULL,
          quality: 70
        });

        const stickerBuffer = await sticker.toBuffer();

        await sock.sendMessage(from, {
          sticker: stickerBuffer
        });

      } catch (err) {
        console.log(err);
        await sock.sendMessage(from, {
          text: "❌ Erro ao fazer figurinha"
        });
      }
    }

    // =================
    // BAN
    // =================

    if (text === prefix + "ban") {
      if (!isGroup || !isAdmin) return;

      const quoted = msg.message.extendedTextMessage?.contextInfo;

      if (!quoted) {
        await sock.sendMessage(from, {
          text: "❌ Responda a mensagem da pessoa"
        });
        return;
      }

      const user = quoted.participant;

      await sock.groupParticipantsUpdate(from, [user], "remove");

      await sock.sendMessage(from, {
        text: "🚫 Removido pelo GEADA BOT"
      });
    }

    // =================
    // ADD
    // =================

    if (text.startsWith(prefix + "add")) {
      if (!isGroup || !isAdmin) return;

      const number = text.replace(prefix + "add", "").trim();

      if (!number) {
        await sock.sendMessage(from, {
          text: "❌ Use: .add 559999999999"
        });
        return;
      }

      const user = number.replace(/\D/g, "") + "@s.whatsapp.net";

      try {
        await sock.groupParticipantsUpdate(from, [user], "add");

        await sock.sendMessage(from, {
          text: "✅ Adicionado pelo GEADA BOT"
        });

      } catch (err) {
        console.log(err);
        await sock.sendMessage(from, {
          text: "❌ Não foi possível adicionar"
        });
      }
    }

    // =================
    // FECHAR
    // =================

    if (text === prefix + "fechar") {
      if (!isGroup || !isAdmin) return;

      await sock.groupSettingUpdate(from, "announcement");

      await sock.sendMessage(from, {
        text: "🔒 Grupo fechado (GEADA BOT)"
      });
    }

    // =================
    // ABRIR
    // =================

    if (text === prefix + "abrir") {
      if (!isGroup || !isAdmin) return;

      await sock.groupSettingUpdate(from, "not_announcement");

      await sock.sendMessage(from, {
        text: "🔓 Grupo aberto (GEADA BOT)"
      });
    }
  });
}

start();
