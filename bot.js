const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const sharp = require("sharp");

function bufferFromStream(stream) {
  return new Promise(async (resolve, reject) => {
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

  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;

    if (qr) {
      console.log("📱 Escaneie o QR:");
      qrcode.generate(qr, { small: true });
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

    // 🔥 pega texto corretamente (CORREÇÃO DO UNDEFINED)
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    console.log("Mensagem:", text);

    // comandos básicos
    if (text === "!oi") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "Salve 😎"
      });
    }

    if (text === "!menu") {
      await sock.sendMessage(msg.key.remoteJid, {
        text: "🤖 BOT ONLINE\n\n!oi\n!menu\n.s (figurinha)"
      });
    }

    // 🖼️ FIGURINHA REAL (.s)
    if (text === ".s") {
      try {
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        const image =
          msg.message.imageMessage ||
          quoted?.imageMessage;

        if (!image) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Responda ou envie uma imagem com .s"
          });
          return;
        }

        const stream = await downloadContentFromMessage(image, "image");
        const buffer = await bufferFromStream(stream);

        const sticker = await sharp(buffer)
          .resize(512, 512)
          .webp()
          .toBuffer();

        await sock.sendMessage(msg.key.remoteJid, {
          sticker
        });

      } catch (err) {
        console.log("Erro figurinha:", err);
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Erro ao criar figurinha"
        });
      }
    }
  });
}

start();