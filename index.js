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
                .setDescription("Unité")
                .setRequired(true)
                .addChoices(
                    { name: "Secondes", value: "seconds" },
                    { name: "Minutes", value: "minutes" },
                    { name: "Heures", value: "hours" }
                )
        )
        .addChannelOption(o =>
            o.setName("channel")
                .setDescription("Salon")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("list")
        .setDescription("Lister les alarmes"),

    new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Supprimer une alarme")
        .addIntegerOption(o =>
            o.setName("id")
                .setDescription("ID de l'alarme")
                .setRequired(true)
        )
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
    console.log(`📥 /${interaction.commandName} (${guildId})`);

    if (!configs[guildId]) configs[guildId] = [];

    // ===== SETUP =====
    if (interaction.commandName === "setup") {
        const alarms = configs[guildId];
        const newId = alarms.length ? Math.max(...alarms.map(a => a.id)) + 1 : 1;

        alarms.push({
            id: newId,
            value: interaction.options.getInteger("value"),
            unit: interaction.options.getString("unit"),
            channelId: interaction.options.getChannel("channel").id
        });

        saveConfigs();

        return interaction.reply({
            content: `✅ Alarme créée (ID: **${newId}**)`,
            ephemeral: true
        });
    }

    // ===== LIST =====
    if (interaction.commandName === "list") {
        const alarms = configs[guildId];

        if (!alarms.length) {
            return interaction.reply({ content: "❌ Aucune alarme", ephemeral: true });
        }

        const msg = alarms.map(a =>
            `🆔 **${a.id}** → toutes les **${a.value} ${a.unit}** dans <#${a.channelId}>`
        ).join("\n");

        return interaction.reply({ content: msg, ephemeral: true });
    }

    // ===== DELETE =====
    if (interaction.commandName === "delete") {
        const id = interaction.options.getInteger("id");
        const alarms = configs[guildId];

        const index = alarms.findIndex(a => a.id === id);
        if (index === -1) {
            return interaction.reply({ content: "❌ ID introuvable", ephemeral: true });
        }

        alarms.splice(index, 1);
        saveConfigs();

        return interaction.reply({
            content: `🗑️ Alarme **${id}** supprimée`,
            ephemeral: true
        });
    }
});

// ========= SCHEDULER =========
function startScheduler() {
    setInterval(async () => {
        const now = DateTime.now().setZone(TIMEZONE);

        for (const guildId in configs) {
            for (const alarm of configs[guildId]) {
                let send = false;

                if (alarm.unit === "seconds" && now.second % alarm.value === 0) send = true;
                if (alarm.unit === "minutes" && now.second === 0 && now.minute % alarm.value === 0) send = true;
                if (alarm.unit === "hours" && now.minute === 0 && now.second === 0 && now.hour % alarm.value === 0) send = true;

                if (!send) continue;

                try {
                    const channel = await client.channels.fetch(alarm.channelId);
                    if (channel?.isTextBased()) {
                        await channel.send({
                            content: "@everyone ⏰ C'est l'heure du $p !",
                            allowedMentions: { parse: ["everyone"] }
                        });
                        console.log(`✅ Alarme ${alarm.id} envoyée (${guildId})`);
                    }
                } catch (e) {
                    console.error("❌ Envoi échoué :", e.message);
                }
            }
        }
    }, 1000);
}

// ========= LOGIN =========
client.login(TOKEN);
