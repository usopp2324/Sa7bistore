const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'partnership',
    description: 'Send the partnership announcement embed with invite button',
    async execute(message, args, context) {
        // Replace these URLs with your own hosted images if desired
        const THUMBNAIL_URL = 'https://media.discordapp.net/attachments/1479662632507146320/1479677472998953134/IMG-20260130-WA0003.png?ex=69ace888&is=69ab9708&hm=b59fcdae7e732dd10ad9a9a1e1768978d586352600db16984d2ca496f62e5cee&=&format=webp&quality=lossless';
        const IMAGE_URL = 'https://media.discordapp.net/attachments/1479662632507146320/1479677429936295986/IMG-20260130-WA0004.png?ex=69ace87e&is=69ab96fe&hm=04f8a7a2495f26b8f25adcd9d6c70fbb94f9ff22dfb726301979f9c45a0c485e&=&format=webp&quality=lossless';
        const INVITE_URL = 'https://discord.gg/W7fQHq4sZf';

          const descriptionText = `  
# <a:1065038164068151396:1479899404910461030>  __**PARTNERSHIP ANNOUNCEMENT – Big Collab Unlocked!** __ <a:1065038164068151396:1479899404910461030>  
> ## <:11pm_dot1:1479899278792200313> Big news for the server!

> ## <:11pm_dot1:1479899278792200313>  We’ve officially partnered with __**Uruxn**__ — one of the cleanest and most trusted names in the Discord Bots and Websites Developers.

> ## <:11pm_dot1:1479899278792200313>  From now on, you can get __ **everything you need**__ to level up your Discord & online presence right here:

> ###  <:number_one:1469745913391091876>  Custom Discord bots made exactly how you want them  
> ### (tickets • moderation • economy • music • leveling • giveaways • AI features… literally anything!)

> ### <:number_two:1469745916360659123>   Beautiful, fast-loading websites built from scratch  
> ### (bot dashboards • landing pages • portfolios • stores • anything that looks clean & modern)

> ### <:number_three:1469745918738829393>  Clean code • Mobile-friendly • Lightning fast • Lifetime support • Always delivered on time

> **Whether you want a full server makeover, a professional bot, a dope dashboard for your project, or a slick storefront — they've got you covered.**

> **Want to start? ** 
> **Check out their discord server:**
> https://discord.gg/W7fQHq4sZf

> ### Let’s build something insane.

> ### Lock. Click. Build. <a:emoji_01:1479900507890782218> \n `;

            const MENTION = '\n@everyone';
            let truncatedDescription = descriptionText;
            if (truncatedDescription.length > 1024 - MENTION.length) {
                truncatedDescription = truncatedDescription.slice(0, 1024 - MENTION.length - 3) + '...';
            }
            const finalDescription = truncatedDescription + MENTION;

        const embed = new EmbedBuilder()
            .setColor(0x7b2cff)
                .setDescription(finalDescription)
            .addFields({ name: '\u200B', value: `[Join Uruxn](${INVITE_URL})` })
            .setThumbnail(THUMBNAIL_URL)
            .setImage(IMAGE_URL)
            .setFooter({ text: 'Lock. Click. Build. 💜' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Join Uruxn')
                .setStyle(ButtonStyle.Link)
                .setURL(INVITE_URL)
        );

        try {
            await message.channel.send({ embeds: [embed], components: [row], allowedMentions: { parse: ['everyone'] } });
        } catch (err) {
            console.error('Failed to send partnership embed:', err);
            await message.reply('Sorry, I could not post the partnership announcement.');
        }
    },
};
