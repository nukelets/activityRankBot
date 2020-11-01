const guildMemberModel = require('../../models/guild/guildMemberModel.js');
const guildModel = require('../../models/guild/guildModel.js');
const rankModel = require('../../models/rankModel.js');
const fct = require('../../../util/fct.js');
const Discord = require('discord.js');
const errorMsgs = require('../../../const/errorMsgs.js');

module.exports = (msg,targetChannelId,args) => {
  return new Promise(async function (resolve, reject) {
    try {
      // Check Command cooldown

      await guildMemberModel.cache.load(msg.member);
      const myGuild = await guildModel.storage.get(msg.guild);

      const isPremiumGuild = fct.isPremiumGuild(msg.guild);
      const cd = isPremiumGuild ? 5 : 30;
      const premiumLowersCooldownString = isPremiumGuild ? '' : errorMsgs.premiumLowersCooldown;

      const toWait = fct.getMemberActionCooldown(msg.member,'lastStatsCmdDate',cd);
      if (toWait > 0) {
        await msg.channel.send(errorMsgs.activeStatsCooldown(cd,toWait) + premiumLowersCooldownString);
        return resolve();
      }

      // Extract options

      args = args.map(t => t.toLowerCase());
      const page = fct.extractPage(args,myGuild.entriesPerPage);
      const time = fct.extractTime(args);

      if (page.number < 1 || page.number > 100) {
        await msg.channel.send('Pagenumber needs to be within 1 and 100.');
        return resolve();
      }

      if (!targetChannelId)
        targetChannelId = msg.channel.id;

      msg.member.appData.lastStatsCmdDate = Date.now() / 1000;

      await sendChannelMembersEmbed(msg,myGuild,targetChannelId,time,page.from,page.to);

    } catch (e) { reject(e); }
    resolve();
  });
}

function sendChannelMembersEmbed(msg,myGuild,targetChannelId,time,from,to) {
  return new Promise(async function (resolve, reject) {
    try {
      const targetChannel = msg.guild.channels.cache.get(targetChannelId);
      if (!targetChannel) {
        await msg.channel.send('Could not find channel.');
        return resolve();
      }

      let type;
      let header = 'Toplist for channel ' + targetChannel.name + ' from ' + from + ' to ' + to + ' | ' + time;

      if (targetChannel.type == 'voice')
        type = 'voiceMinute';
      else if (targetChannel.type == 'text')
        type = 'textMessage';
      else {
        await msg.channel.send('Channel is not of type voice or text.');
        return resolve();
      }

      const channelMemberRanks = await rankModel.getChannelMemberRanks(msg.guild,targetChannel.id,type,time,from,to);

      if (!channelMemberRanks || channelMemberRanks.length == 0) {
        await msg.channel.send('No entries found for this page.');
        return resolve();
      }

      await fct.addGuildMemberNamesToRanks(msg.guild,channelMemberRanks);

      let description = '';

      if (msg.guild.appData.bonusUntilDate > Date.now() / 1000)
        description = '**!! Bonus XP Active !!** (' + (Math.round(((msg.guild.appData.bonusUntilDate - Date.now() / 1000)/60/60)*10)/10)+'h left) \n';

      let embed = new Discord.MessageEmbed()
          .setTitle(header)
          .setAuthor('')
          .setDescription(description)
          .setColor('#4fd6c8')
          .setFooter(msg.client.appData.settings.footer);

      let str = '',guildMemberName;
      for (let i = 0; i < channelMemberRanks.length;i++) {
        if (type == 'voiceMinute')
          str = ':microphone2: ' + (Math.round(channelMemberRanks[i][time] / 60 * 10) / 10)
        else
          str = ':writing_hand: ' + channelMemberRanks[i][time];

        guildMemberName = await fct.getGuildMemberName(msg.guild,channelMemberRanks[i].userId);
        embed.addField('#' + (from + i) + '  ' + guildMemberName, str,true);
      }

      await msg.channel.send(embed);
    } catch (e) { reject(e); }
    resolve();
  });
}