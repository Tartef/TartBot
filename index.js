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
        .addIntegerOption(opt =>
            opt.setName("value")
                .setDescription("Valeur de l'intervalle")
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(opt =>
            opt.setName("unit")
                .setDescription("Unité de temps")
                .setRequired(true)
                .addChoices(
                    { name: "Secondes", value: "seconds" },
                    { name: "Minutes", value: "minutes" },
                    { name: "Heures", value: "hours" }
                )
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("Salon d'envoi")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("edit")
        .setDescription("Modifier l'alarme")
        .addIntegerOption(opt =>
            opt.setName("value")
                .setDescription("Nouvelle valeur")
                .setMinValue(1)
        )
        .addStringOption(opt =>
            opt.setName("unit")
                .setDescription("Nouvelle unité")
                .addChoices(
                    { name: "Secondes", value: "seconds" },
                    { name: "Minutes", value: "minutes" },
                    { name: "Heures", value: "hours" }
                )
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("Nouveau salon")
        ),

    new SlashCommandBuilder()
        .setName("delete")
        .setDescription("Supprimer l'alarme"),

    new SlashCommandBuilder()
        .setName("status")
        .setDescription("Voir l'alarme actuelle")
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

    if (interaction.commandName === "setup") {
        configs[guildId] = {
            value: interaction.options.getInteger("value"),
            unit: interaction.options.getString("unit"),
            channelId: interaction.options.getChannel("channel").id
        };
        saveConfigs();
        return interaction.reply({ content: "✅ Alarme créée", ephemeral: true });
    }

    if (interaction.commandName === "edit") {
        if (!configs[guildId]) {
            return interaction.reply({ content: "❌ Aucune alarme", ephemeral: true });
        }

        const cfg = configs[guildId];
        const value = interaction.options.getInteger("value");
        const unit = interaction.options.getString("unit");
        const channel = interaction.options.getChannel("channel");

        if (value) cfg.value = value;
        if (unit) cfg.unit = unit;
        if (channel) cfg.channelId = channel.id;

        saveConfigs();
        return interaction.reply({ content: "✏️ Alarme modifiée", ephemeral: true });
    }

    if (interaction.commandName === "delete") {
        if (!configs[guildId]) {
            return interaction.reply({ content: "❌ Aucune alarme à supprimer", ephemeral: true });
        }

        delete configs[guildId];
        saveConfigs();
        return interaction.reply({ content: "🗑️ Alarme supprimée", ephemeral: true });
    }

    if (interaction.commandName === "status") {
        const cfg = configs[guildId];
        if (!cfg) {
            return interaction.reply({ content: "❌ Aucune alarme configurée", ephemeral: true });
        }

        return interaction.reply({
            content: `⏱️ Toutes les ${cfg.value} ${cfg.unit}\n📢 Salon : <#${cfg.channelId}>`,
            ephemeral: true
        });
    }
});

// ========= SCHEDULER =========
function startScheduler() {
    setInterval(async () => {
        const now = DateTime.now().setZone(TIMEZONE);

        for (const guildId in configs) {
            const cfg = configs[guildId];
            let shouldSend = false;

            if (cfg.unit === "seconds" && now.second % cfg.value === 0) shouldSend = true;
            if (cfg.unit === "minutes" && now.second === 0 && now.minute % cfg.value === 0) shouldSend = true;
            if (cfg.unit === "hours" && now.minute === 0 && now.second === 0 && now.hour % cfg.value === 0) shouldSend = true;

            if (!shouldSend) continue;

            try {
                const channel = await client.channels.fetch(cfg.channelId);
                if (channel?.isTextBased()) {
                    await channel.send({
                        content: "@everyone ⏰ C'est l'heure du $p !",
                        allowedMentions: { parse: ["everyone"] }
                    });
                    console.log(`✅ Message envoyé (${guildId})`);
                }
            } catch (err) {
                console.error("❌ Erreur :", err.message);
            }
        }
    }, 1000);
}

// ========= LOGIN =========
client.login(TOKEN);
