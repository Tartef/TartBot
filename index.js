require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const { DateTime } = require("luxon");
const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CONFIG_FILE = "./config.json";
const TIMEZONE = "Europe/Paris";

// ========= LOAD CONFIG =========
let configs = {};
if (fs.existsSync(CONFIG_FILE)) {
    configs = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

// Migration ancienne config hourType → parity
for (const guildId in configs) {
    for (const alarm of configs[guildId]) {
        if (!alarm.parity && alarm.hourType) {
            alarm.parity = alarm.hourType;
            delete alarm.hourType;
        }
    }
}
fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));

function saveConfigs() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

// ========= CLIENT =========
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ========= SLASH COMMANDS =========
const commands = [
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Créer une alarme")
        .addIntegerOption(o =>
            o.setName("value")
                .setDescription("Valeur de l'intervalle")
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(o =>
            o.setName("unit")
                .setDescription("Unité de temps")
                .setRequired(true)
                .addChoices(
                    { name: "Secondes", value: "seconds" },
                    { name: "Minutes", value: "minutes" },
                    { name: "Heures", value: "hours" }
                )
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Salon d'envoi")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Message envoyé")
                .setRequired(true)
        )
        .addStringOption(o =>
            o.setName("parity")
                .setDescription("Parité de l'unité de temps")
                .addChoices(
                    { name: "Peu importe", value: "any" },
                    { name: "Valeurs paires", value: "even" },
                    { name: "Valeurs impaires", value: "odd" }
                )
        ),

    new SlashCommandBuilder()
        .setName("edit")
        .setDescription("Modifier une alarme existante")
        .addIntegerOption(o =>
            o.setName("id")
                .setDescription("ID de l'alarme")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("value")
                .setDescription("Nouvelle valeur de l'intervalle")
                .setMinValue(1)
        )
        .addStringOption(o =>
            o.setName("unit")
                .setDescription("Nouvelle unité de temps")
                .addChoices(
                    { name: "Secondes", value: "seconds" },
                    { name: "Minutes", value: "minutes" },
                    { name: "Heures", value: "hours" }
                )
        )
        .addStringOption(o =>
            o.setName("parity")
                .setDescription("Nouvelle parité")
                .addChoices(
                    { name: "Peu importe", value: "any" },
                    { name: "Valeurs paires", value: "even" },
                    { name: "Valeurs impaires", value: "odd" }
                )
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Nouveau salon")
        )
        .addStringOption(o =>
            o.setName("message")
                .setDescription("Nouveau message")
        ),

    new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Supprimer une alarme")
        .addIntegerOption(o =>
            o.setName("id")
                .setDescription("ID de l'alarme")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("list")
        .setDescription("Lister toutes les alarmes")
].map(c => c.toJSON());

// ========= REGISTER =========
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands enregistrées");
})();

// ========= READY =========
client.once("ready", () => {
    console.log(`🤖 Connecté : ${client.user.tag}`);
    startScheduler();
});

// ========= INTERACTIONS =========
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const guildId = interaction.guildId;

    if (!configs[guildId]) configs[guildId] = [];

    // ===== SETUP =====
    if (interaction.commandName === "setup") {
        const alarms = configs[guildId];
        const newId = alarms.length ? Math.max(...alarms.map(a => a.id)) + 1 : 1;

        alarms.push({
            id: newId,
            value: interaction.options.getInteger("value"),
            unit: interaction.options.getString("unit"),
            parity: interaction.options.getString("parity") ?? "any",
            channelId: interaction.options.getChannel("channel").id,
            message: interaction.options.getString("message"),
            lastSent: null
        });

        saveConfigs();
        return interaction.reply({ content: `✅ Alarme créée (ID ${newId})`, ephemeral: true });
    }

    // ===== EDIT =====
    if (interaction.commandName === "edit") {
        const id = interaction.options.getInteger("id");
        const alarm = configs[guildId].find(a => a.id === id);
        if (!alarm) return interaction.reply({ content: "❌ ID introuvable", ephemeral: true });

        if (interaction.options.getInteger("value")) alarm.value = interaction.options.getInteger("value");
        if (interaction.options.getString("unit")) alarm.unit = interaction.options.getString("unit");
        if (interaction.options.getString("parity")) alarm.parity = interaction.options.getString("parity");
        if (interaction.options.getChannel("channel")) alarm.channelId = interaction.options.getChannel("channel").id;
        if (interaction.options.getString("message")) alarm.message = interaction.options.getString("message");

        saveConfigs();
        return interaction.reply({ content: `✏️ Alarme ${id} modifiée`, ephemeral: true });
    }

    // ===== DELETE =====
    if (interaction.commandName === "delete") {
        const id = interaction.options.getInteger("id");
        const index = configs[guildId].findIndex(a => a.id === id);
        if (index === -1) return interaction.reply({ content: "❌ ID introuvable", ephemeral: true });

        configs[guildId].splice(index, 1);
        saveConfigs();
        return interaction.reply({ content: `🗑️ Alarme ${id} supprimée`, ephemeral: true });
    }

    // ===== LIST =====
    if (interaction.commandName === "list") {
        if (!configs[guildId].length) {
            return interaction.reply({ content: "❌ Aucune alarme", ephemeral: true });
        }

        const msg = configs[guildId].map(a =>
            `🆔 **${a.id}**
⏱️ ${a.value} ${a.unit}
🔢 Parité : ${a.parity === "even" ? "Paire" : a.parity === "odd" ? "Impaire" : "Aucune"}
📢 <#${a.channelId}>
💬 ${a.message}`
        ).join("\n\n");

        return interaction.reply({ content: msg, ephemeral: true });
    }
});

// ========= SCHEDULER =========
function startScheduler() {
    setInterval(async () => {
        const now = DateTime.now().setZone(TIMEZONE);

        for (const guildId in configs) {
            for (const alarm of configs[guildId]) {

                let currentValue;
                let unit;

                // 1️⃣ Déterminer la valeur actuelle
                if (alarm.unit === "seconds") {
                    currentValue = now.second;
                    unit = "seconds";
                } else if (alarm.unit === "minutes") {
                    if (now.second !== 0) continue;
                    currentValue = now.minute;
                    unit = "minutes";
                } else if (alarm.unit === "hours") {
                    if (now.minute !== 0 || now.second !== 0) continue;
                    currentValue = now.hour;
                    unit = "hours";
                } else {
                    continue;
                }

                // 2️⃣ Filtre de parité
                if (
                    (alarm.parity === "even" && currentValue % 2 !== 0) ||
                    (alarm.parity === "odd" && currentValue % 2 !== 1)
                ) {
                    continue;
                }

                // 3️⃣ Gestion de l’intervalle
                let shouldSend = false;

                if (!alarm.lastSent) {
                    shouldSend = true;
                } else {
                    const last = DateTime.fromMillis(alarm.lastSent).setZone(TIMEZONE);
                    const diff = now.diff(last, unit)[unit];
                    if (diff >= alarm.value) shouldSend = true;
                }

                if (!shouldSend) continue;

                // 4️⃣ Envoi
                try {
                    const channel = await client.channels.fetch(alarm.channelId);
                    if (channel?.isTextBased()) {
                        await channel.send({
                            content: alarm.message,
                            allowedMentions: { parse: ["everyone", "roles"] }
                        });

                        alarm.lastSent = now.toMillis();
                        saveConfigs();
                    }
                } catch (err) {
                    console.error("Erreur envoi alarme:", err.message);
                }
            }
        }
    }, 1000);
}

client.login(TOKEN);
