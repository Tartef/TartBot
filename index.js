const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, TextChannel } = require("discord.js");
const { DateTime } = require("luxon");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const configs = {};

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const commands = [
    new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Configurer les alertes du bot")
        .addIntegerOption(option =>
            option
                .setName("interval")
                .setDescription("Intervalle entre deux alertes (en heures)")
                .setMinValue(1)
                .setMaxValue(24)
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Salon où envoyer les alertes")
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName("status")
        .setDescription("Voir la configuration actuelle du serveur")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);
(async () => {
    try {
        console.log("⏳ Enregistrement des slash commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("✅ Slash commands enregistrées !");
    } catch (err) {
        console.error("❌ Erreur lors de l'enregistrement des slash commands :", err);
    }
})();

client.once("ready", () => {
    console.log(`🤖 Bot connecté : ${client.user.tag}`);
    startLoop();
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guildId) return;

    const guildId = interaction.guildId;

    if (interaction.commandName === "setup") {
        const interval = interaction.options.getInteger("interval");
        const channel = interaction.options.getChannel("channel");

        configs[guildId] = {
            intervalHours: interval,
            channelId: channel.id
        };

        await interaction.reply({
            content: `✅ Configuration enregistrée pour ce serveur\n⏱ Intervalle : ${interval}h\n📢 Salon : <#${channel.id}>`,
            ephemeral: true
        });
    }

    if (interaction.commandName === "status") {
        const cfg = configs[guildId];
        if (!cfg) {
            await interaction.reply({
                content: "❌ Aucune configuration trouvée pour ce serveur.",
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `⚙️ Configuration actuelle :\n⏱ Intervalle : ${cfg.intervalHours}h\n📢 Salon : <#${cfg.channelId}>`,
                ephemeral: true
            });
        }
    }
});

function startLoop() {
    setInterval(async () => {
        const now = DateTime.now().setZone("Europe/Paris");

        if (now.minute !== 0) return;

        for (const guildId in configs) {
            const cfg = configs[guildId];

            if (now.hour % cfg.intervalHours !== 0) continue;

            try {
                const channel = await client.channels.fetch(cfg.channelId);

                if (channel && channel.isTextBased()) {
                    await channel.send({
                        content: `@everyone ⏰ C'est l'heure du $p !`,
                        allowedMentions: { parse: ["everyone"] }
                    });
                }
            } catch (err) {
                console.error(`Erreur envoi message (${guildId}):`, err);
            }
        }
    }, 60 * 1000);
}

client.login(TOKEN);
