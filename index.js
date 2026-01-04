require("dotenv").config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const { DateTime } = require("luxon");
const fs = require("fs");

// ================= CONFIG =================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const CONFIG_FILE = "./config.json";
const TIMEZONE = "Europe/Paris";

// ================ LOAD CONFIG =============
let configs = {};
if (fs.existsSync(CONFIG_FILE)) {
    configs = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

// Sauvegarde persistante
function saveConfigs() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

// ================= CLIENT =================
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// ============== SLASH COMMANDS ============
const commands = [
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configurer les alertes")
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("Heures paires ou impaires")
                .setRequired(true)
                .addChoices(
                    { name: "Heures paires", value: "even" },
                    { name: "Heures impaires", value: "odd" }
                )
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("Salon d'envoi")
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName("edit")
        .setDescription("Modifier la configuration")
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("Heures paires ou impaires")
                .addChoices(
                    { name: "Heures paires", value: "even" },
                    { name: "Heures impaires", value: "odd" }
                )
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("Nouveau salon")
        ),

    new SlashCommandBuilder()
        .setName("status")
        .setDescription("Voir la configuration actuelle")
].map(cmd => cmd.toJSON());

// Enregistrement global
const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands enregistrées");
})();

// ================= READY ==================
client.once("ready", () => {
    console.log(`🤖 Bot connecté : ${client.user.tag}`);
    startScheduler();
});

// ============ COMMAND HANDLING ============
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const guildId = interaction.guildId;
    console.log(`📥 Commande /${interaction.commandName} par ${interaction.user.tag}`);

    if (interaction.commandName === "setup") {
        configs[guildId] = {
            type: interaction.options.getString("type"),
            channelId: interaction.options.getChannel("channel").id
        };
        saveConfigs();

        await interaction.reply({
            content: "✅ Configuration enregistrée",
            ephemeral: true
        });
    }

    if (interaction.commandName === "edit") {
        if (!configs[guildId]) {
            return interaction.reply({ content: "❌ Aucune config existante", ephemeral: true });
        }

        const type = interaction.options.getString("type");
        const channel = interaction.options.getChannel("channel");

        if (type) configs[guildId].type = type;
        if (channel) configs[guildId].channelId = channel.id;

        saveConfigs();

        await interaction.reply({
            content: "✏️ Configuration mise à jour",
            ephemeral: true
        });
    }

    if (interaction.commandName === "status") {
        const cfg = configs[guildId];
        if (!cfg) {
            return interaction.reply({ content: "❌ Pas de configuration", ephemeral: true });
        }

        await interaction.reply({
            content: `⚙️ Type : ${cfg.type === "even" ? "Heures paires" : "Heures impaires"}\n📢 Salon : <#${cfg.channelId}>`,
            ephemeral: true
        });
    }
});

// ============ SCHEDULER (PILE À L'HEURE) ============
function startScheduler() {
    setInterval(async () => {
        const now = DateTime.now().setZone(TIMEZONE);

        // pile à l'heure
        if (now.minute !== 0 || now.second !== 0) return;

        for (const guildId in configs) {
            const cfg = configs[guildId];
            const hour = now.hour;

            if (cfg.type === "even" && hour % 2 !== 0) continue;
            if (cfg.type === "odd" && hour % 2 === 0) continue;

            try {
                const channel = await client.channels.fetch(cfg.channelId);
                if (channel?.isTextBased()) {
                    await channel.send({
                        content: "@everyone ⏰ C'est l'heure du $p !",
                        allowedMentions: { parse: ["everyone"] }
                    });
                    console.log(`✅ Message envoyé (${guildId}) à ${now.toFormat("HH:mm:ss")}`);
                }
            } catch (err) {
                console.error("❌ Erreur envoi :", err.message);
            }
        }
    }, 1000);
}

// ================= LOGIN =================
client.login(TOKEN);
