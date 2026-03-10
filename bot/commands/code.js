const { postToDjango } = require('../utils/api');
const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'code',
    description: 'Generate an activation code: !code <duration_days>',
    async execute(message, args, context) {
        const { config } = context;

        const isAdmin = message.member && message.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isAdmin) {
            return message.reply('You do not have permission to generate activation codes.');
        }

        const durationArg = args && args.length > 0 ? args[0] : '';
        const days = durationArg ? parseInt(durationArg, 10) : 0;

        const payload = {
            duration_days: days,
            discord_id: message.author.id,
        };

        try {
            const result = await postToDjango('/api/discord/activation/create_manual/', payload, config.djangoApiBaseUrl, config.apiSecret);

            if (result && result.code) {
                if (!result.duration_days) {
                    result.duration_days = 'Lifetime';
                } else {
                    result.duration_days = `${result.duration_days} days`;
                }
                // Try to DM the user the code
                try {
                    await message.author.send(`Your activation code (${result.duration_days}):\n\n${result.code}`);
                    return message.reply('Activation code generated and sent to your DMs.');
                } catch (err) {
                    // If DM fails, reply in channel (but avoid leaking codes in public if channel is not a DM)
                    return message.reply(`Activation code generated: ${result.code} (could not DM you)`);
                }
            }

            return message.reply('Failed to generate activation code.');
        } catch (err) {
            console.error('code command error', err);
            return message.reply(`Error generating code: ${err.message || err}`);
        }
    },
};