require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

const { DateTime } = require("luxon");
const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CONFIG_FILE = "./config.json";
const TIMEZONE = "Europe/Paris";

let configs = {};
if (fs.existsSync(CONFIG_FILE)) {
    configs = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

function saveConfigs() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const commands = [
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Créer une alarme")

        // ===== REQUIRED D'ABORD =====
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

        // ===== OPTIONAL À LA FIN =====
        .addStringOption(o =>
            o.setName("parity")
                .setDescription("Pair / impair (optionnel)")
                .addChoices(
                    { name: "Peu importe", value: "any" },
                    { name: "Pair", value: "even" },
                    { name: "Impair", value: "odd" }
                )
        ),

    new SlashCommandBuilder()
        .setName("edit")
        .setDescription("Modifier une alarme")
        .addIntegerOption(o =>
            o.setName("id")
                .setDescription("ID de l'alarme")
                .setRequired(true)
        )
        .addIntegerOption(o =>
            o.setName("value")
                .setDescription("Nouvelle valeur")
                .setMinValue(1)
        )
        .addStringOption(o =>
            o.setName("unit")
                .setDescription("Nouvelle unité")
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
                    { name: "Pair", value: "even" },
                    { name: "Impair", value: "odd" }
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
        .setDescription("Lister les alarmes")
].map(c => c.toJSON());

// ================= REGISTER COMMANDS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands enregistrées");
})();

// ================= READY =================
client.once("ready", () => {
    console.log(`🤖 Connecté en tant que ${client.user.tag}`);
    startScheduler();
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    if (!configs[guildId]) configs[guildId] = [];

    // ===== SETUP =====
    if (interaction.commandName === "setup") {
        const alarms = configs[guildId];
        const newId = alarms.length ? Math.max(...alarms.map(a => a.id)) + 1 : 1;

        const value = interaction.options.getInteger("value");
        const unit = interaction.options.getString("unit");
        const parity = interaction.options.getString("parity") ?? "any";

        alarms.push({
            id: newId,
            value,
            unit,
            parity,
            channelId: interaction.options.getChannel("channel").id,
            message: interaction.options.getString("message"),
            nextTrigger: Date.now() + getIntervalMs({ value, unit })
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
🔁 Parité : ${a.parity}
📢 <#${a.channelId}>
💬 ${a.message}`
        ).join("\n\n");

        return interaction.reply({ content: msg, ephemeral: true });
    }
});

function startScheduler() {
    setInterval(async () => {
        const now = Date.now();

        for (const guildId in configs) {
            for (const alarm of configs[guildId]) {

                if (now < alarm.nextTrigger) continue;

                const intervalMs = getIntervalMs(alarm);
                alarm.nextTrigger = alarm.nextTrigger + intervalMs;
                saveConfigs();

                const dt = DateTime.fromMillis(now).setZone(TIMEZONE);

                if (
                    alarm.parity === "even" && dt.hour % 2 !== 0 ||
                    alarm.parity === "odd" && dt.hour % 2 !== 1
                ) {
                    continue;
                }

                try {
                    const channel = await client.channels.fetch(alarm.channelId);
                    if (channel?.isTextBased()) {
                        await channel.send({
                            content: alarm.message,
                            allowedMentions: { parse: ["everyone", "roles"] }
                        });
                    }
                } catch (e) {
                    console.error("Erreur envoi message:", e.message);
                }
            }
        }
    }, 1000);
}

// ================= UTILS =================
function getIntervalMs(alarm) {
    switch (alarm.unit) {
        case "seconds": return alarm.value * 1000;
        case "minutes": return alarm.value * 60 * 1000;
        case "hours":   return alarm.value * 60 * 60 * 1000;
    }
}

// ================= LOGIN =================
client.login(TOKEN);
