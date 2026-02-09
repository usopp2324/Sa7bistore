const Discord = require('discord.js');
const {
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} = require('@discordjs/builders');

const { MessageFlags: DiscordMessageFlags } = Discord;

const MessageFlags = DiscordMessageFlags || {
  Ephemeral: 1 << 6,
  IsComponentsV2: 1 << 15,
};

function embedToContainer(embed) {
  if (!embed) {
    return null;
  }

  const data = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;
  const container = new ContainerBuilder();
  let hasComponent = false;

  const addSeparatorIfNeeded = () => {
    if (hasComponent) {
      container.addSeparatorComponents(new SeparatorBuilder());
    }
  };

  const addTextBlock = (block) => {
    if (!block) {
      return;
    }
    addSeparatorIfNeeded();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block));
    hasComponent = true;
  };

  const addSectionWithThumbnail = (text, thumbnailUrl) => {
    if (!text || !thumbnailUrl) {
      return false;
    }
    addSeparatorIfNeeded();
    const section = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
      .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: thumbnailUrl } }));
    container.addSectionComponents(section);
    hasComponent = true;
    return true;
  };

  const addImageGallery = (imageUrl, altText) => {
    if (!imageUrl) {
      return;
    }
    addSeparatorIfNeeded();
    const item = new MediaGalleryItemBuilder().setURL(imageUrl);
    if (altText) {
      item.setDescription(altText);
    }
    const gallery = new MediaGalleryBuilder().addItems(item);
    container.addMediaGalleryComponents(gallery);
    hasComponent = true;
  };

  const headerBlocks = [];
  if (data.author && data.author.name) {
    const authorLine = data.author.icon_url
      ? `${data.author.name} (${data.author.icon_url})`
      : data.author.name;
    headerBlocks.push(`**${authorLine}**`);
  }
  if (data.title) {
    headerBlocks.push(`**${data.title}**`);
  }
  if (data.description) {
    headerBlocks.push(data.description);
  }
  const headerText = headerBlocks.join('\n\n');

  const fieldsText = Array.isArray(data.fields) && data.fields.length
    ? data.fields.map((field) => `**${field.name}**\n${field.value}`).join('\n\n')
    : '';

  const thumbnailUrl = data.thumbnail && data.thumbnail.url ? data.thumbnail.url : '';
  if (!addSectionWithThumbnail(headerText, thumbnailUrl)) {
    addTextBlock(headerText);
  }

  addTextBlock(fieldsText);
  addImageGallery(data.image && data.image.url ? data.image.url : '', data.title || data.description);

  if (data.footer && data.footer.text) {
    addTextBlock(data.footer.text);
  }

  return container;
}

function toComponentsV2Payload(payload) {
  if (!payload) {
    return payload;
  }

  const embedInput = payload.embeds || payload.embed;
  const hasV2Flag = typeof payload.flags === 'number'
    && (payload.flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2;
  const contentText = payload.content;

  if (!embedInput) {
    if (hasV2Flag && contentText) {
      const textContainer = new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(contentText)
      );
      const { content: _unusedContent, components = [], ...rest } = payload;
      return {
        ...rest,
        components: [textContainer, ...components],
      };
    }
    return payload;
  }

  const embeds = Array.isArray(embedInput) ? embedInput : [embedInput];
  const containers = embeds.map(embedToContainer).filter(Boolean);
  const {
    embeds: _unusedEmbeds,
    embed: _unusedEmbed,
    components = [],
    flags = 0,
    ephemeral,
    ...rest
  } = payload;
  const mergedFlags = (flags || 0) |
    MessageFlags.IsComponentsV2 |
    (ephemeral ? MessageFlags.Ephemeral : 0);

  const nextComponents = [...containers, ...components];
  if (contentText) {
    nextComponents.unshift(
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(contentText)
      )
    );
  }

  return {
    ...rest,
    flags: mergedFlags,
    components: nextComponents,
  };
}

function patchMethod(proto, methodName, payloadIndex = 0) {
  if (!proto || typeof proto[methodName] !== 'function') {
    return;
  }

  if (proto[methodName].__componentsV2Patched) {
    return;
  }

  const original = proto[methodName];
  const wrapped = function (...args) {
    if (args.length > payloadIndex) {
      const payload = args[payloadIndex];
      if (payload && typeof payload.resolveBody === 'function') {
        if (!payload.__componentsV2ResolvePatched) {
          const originalResolveBody = payload.resolveBody.bind(payload);
          payload.resolveBody = () => toComponentsV2Payload(originalResolveBody());
          payload.__componentsV2ResolvePatched = true;
        }
      } else {
        args[payloadIndex] = toComponentsV2Payload(payload);
      }
    }
    return original.call(this, ...args);
  };

  wrapped.__componentsV2Patched = true;
  proto[methodName] = wrapped;
}

function patchComponentsV2() {
  if (Discord.__componentsV2Patched) {
    return;
  }

  Discord.__componentsV2Patched = true;

  let TextBasedChannel = null;
  try {
    TextBasedChannel = require('discord.js/src/structures/interfaces/TextBasedChannel');
  } catch (error) {
    TextBasedChannel = null;
  }

  patchMethod(Discord.Message && Discord.Message.prototype, 'reply');
  patchMethod(Discord.BaseGuildTextChannel && Discord.BaseGuildTextChannel.prototype, 'send');
  patchMethod(Discord.DMChannel && Discord.DMChannel.prototype, 'send');
  patchMethod(Discord.ThreadChannel && Discord.ThreadChannel.prototype, 'send');
  patchMethod(TextBasedChannel && TextBasedChannel.prototype, 'send');
  patchMethod(Discord.BaseInteraction && Discord.BaseInteraction.prototype, 'reply');
  patchMethod(Discord.BaseInteraction && Discord.BaseInteraction.prototype, 'editReply');
  patchMethod(Discord.BaseInteraction && Discord.BaseInteraction.prototype, 'update');
  patchMethod(Discord.BaseInteraction && Discord.BaseInteraction.prototype, 'followUp');
  patchMethod(Discord.InteractionResponses && Discord.InteractionResponses.prototype, 'reply');
  patchMethod(Discord.InteractionResponses && Discord.InteractionResponses.prototype, 'editReply');
  patchMethod(Discord.InteractionResponses && Discord.InteractionResponses.prototype, 'update');
  patchMethod(Discord.InteractionResponses && Discord.InteractionResponses.prototype, 'followUp');
  patchMethod(Discord.InteractionWebhook && Discord.InteractionWebhook.prototype, 'editMessage', 1);
  patchMethod(Discord.Webhook && Discord.Webhook.prototype, 'editMessage', 1);
}

module.exports = {
  embedToContainer,
  toComponentsV2Payload,
  patchComponentsV2,
};
