const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ContainerBuilder,
    MessageFlags,
    PermissionFlagsBits,
    TextDisplayBuilder,
} = require('discord.js');

const TICKET_PREFIX = 'ticket-order-';

function buildOrderContainer(order) {
    const items = Array.isArray(order.items) ? order.items : [];

    const productLines = items.length ?
        items.map((item) => {
            const label = item.subscription_label;
            const days = Number.isFinite(item.duration_days) ? item.duration_days : null;
            let durationText = '';
            if (label) {
                durationText = ` (${label})`;
            } else if (days) {
                durationText = ` (${days} days)`;
            }
            return `• ${item.name} ×${item.quantity} — $${item.price}${durationText}`;
        }).join('\n') :
        'No items provided';

    const discordUser =
        order.discord_tag ||
        order.discord_username ||
        'Unknown';

    const header = new TextDisplayBuilder().setContent(
        '<a:Shopelmaystro:1469316983358226535> **New Order Ticket**'
    );

    const info = new TextDisplayBuilder().setContent(
        `<:ID_Card:1469315397948805254> **Order ID**\n\`\`\`${order.order_id || 'Unknown'}\`\`\`\n` +
        `<:websiteWick:1469315394153222289> **Website User**\n\`\`\`${order.website_username || 'Unknown'}\`\`\`\n` +
        `<:user:1469315391921852528> **Discord User**\n\`\`\`${discordUser}\`\`\``
    );

    const products = new TextDisplayBuilder().setContent(
        `<:Product:1469315195586478170> **Product(s)**\n${productLines}`
    );

    const payment = new TextDisplayBuilder().setContent(
        `<:money:1470435536446689280> **Total:** $${order.total_price || '0.00'}\n` +
        `<a:Money:1469315193262837801> **Payment:** Discord\n` +
        `<a:carregando2:1456027616267075657> **Status:** ${order.status || 'Pending'}`
    );

    const footer = new TextDisplayBuilder().setContent(
        'ℹ️ Use `!pay <order_id>` to confirm payment'
    );

    return new ContainerBuilder().addTextDisplayComponents(
        header,
        info,
        products,
        payment,
        footer
    );
}

function buildOpenTicketButton(orderId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
        .setCustomId(`open_order_ticket:${orderId}`)
        .setLabel('Open Ticket')
        .setStyle(ButtonStyle.Primary)
    );
}

async function findTicketChannel(guild, orderId) {
    if (!guild) {
        return null;
    }

    const name = `${TICKET_PREFIX}${orderId}`;
    const cached = guild.channels.cache.find((ch) => ch.name === name);
    if (cached) {
        return cached;
    }

    await guild.channels.fetch().catch(() => null);
    return guild.channels.cache.find((ch) => ch.name === name) || null;
}

async function createTicketChannel({ client, guildId, supportRoleId, categoryId, order }) {
    const guild = await client.guilds.fetch(guildId);
    const existing = await findTicketChannel(guild, order.order_id);
    if (existing) {
        return existing;
    }

    const channelName = `${TICKET_PREFIX}${order.order_id}`;
    const permissionOverwrites = [{
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
    }, ];

    if (order.discord_id) {
        permissionOverwrites.push({
            id: order.discord_id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    if (supportRoleId) {
        permissionOverwrites.push({
            id: supportRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
            ],
        });
    }

    if (client.user.id) {
        permissionOverwrites.push({
            id: client.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
            ],
        });
    }

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId || undefined,
        topic: `Order ${order.order_id} • ${order.website_username || 'Unknown'}`,
        permissionOverwrites,
    });

    const embed = buildOrderContainer(order);
    try {
        const clientMention = order.discord_id ? `<@${order.discord_id}>` : 'Client';
        await channel.send({ content: `<@&${"1455988549395415050"}>` });
        await channel.send({ content: `${clientMention}` });
        const orderContainer = buildOrderContainer(order);

        await channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
                orderContainer
            ],
        });
    } catch (error) {
        await channel.send({
            content: `Order ${order.order_id} ticket created for <@${order.discord_id}>.`,
        });
    }

    return channel;
}

async function updateTicketStatus(guild, orderId, status) {
    const channel = await findTicketChannel(guild, orderId);
    if (!channel) {
        return null;
    }

    const baseTopic = (channel.topic || `Order ${orderId}`).replace(/\s+•\s+Status:\s+.*$/i, '').trim();
    const nextTopic = `${baseTopic} • Status: ${status}`;
    try {
        await channel.setTopic(nextTopic);
    } catch (error) {
        console.warn('Failed to update ticket topic:', error.message);
    }

    return channel;
}

module.exports = {
    buildOrderContainer,
    createTicketChannel,
    findTicketChannel,
    updateTicketStatus,
};