const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const QRCode = require("qrcode");

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

  // QR em link
  sock.ev.on("connection.update", async (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("📱 Copie e cole no navegador:");
      const qrImage = await QRCode.toDataURL(qr);
      console.log(qrImage);
    }

    if (connection === "open") {
      console.log("✅ BOT CONECTADO!");
    }

    if (connection === "close") {
      console.log("❌ Reconectando...");
      start();
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    console.log("Mensagem:", text);

    // .oi
    if (text === prefix + "oi") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Salve 😎"
      });
    }

    // .menu
    if (text === prefix + "menu") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `🤖 BOT ONLINE

.oi
.menu
.s (figurinha)
.ban (remover membro)`
      });
    }

    // .s (figurinha)
    if (text === prefix + "s") {
      try {
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        const image =
          msg.message.imageMessage ||
          quoted?.imageMessage;

        if (!image) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Envie ou responda uma imagem com .s"
          });
          return;
        }

        const stream = await downloadContentFromMessage(image, "image");
        const buffer = await bufferFromStream(stream);

        await sock.sendMessage(msg.key.remoteJid, {
          sticker: buffer
        });

      } catch (err) {
        console.log(err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Erro ao fazer figurinha"
        });
      }
    }

    // .ban (admin)
    if (text === prefix + "ban") {
      try {
        const isGroup = msg.key.remoteJid.endsWith("@g.us");
        if (!isGroup) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Só funciona em grupo"
          });
          return;
        }

        const sender = msg.key.participant || msg.key.remoteJid;

        const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
        const admins = groupMetadata.participants
          .filter(p => p.admin !== null)
          .map(p => p.id);

        if (!admins.includes(sender)) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Você não é admin"
          });
          return;
        }

        const mentioned = msg.message.extendedTextMessage?.contextInfo?.participant;

        if (!mentioned) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Responda a mensagem da pessoa"
          });
          return;
        }

        await sock.groupParticipantsUpdate(
          msg.key.remoteJid,
          [mentioned],
          "remove"
        );

        await sock.sendMessage(msg.key.remoteJid, {
          text: "🚫 Usuário removido!"
        });

      } catch (err) {
        console.log(err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Erro ao banir"
        });
      }
    }
  });
}

start();
