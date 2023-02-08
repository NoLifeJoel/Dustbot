const { SlashCommandBuilder } = require("discord.js");

const publicRoles = [
  // dustforce-related
  "bingo",
  "mapmakers",
  "multiplayer",
  "racers",
  "randomizer",
  "weekinreview",
  "map-releases",

  // miscellaneous
  "amongus",
  "melee",
  "outer wilds",
  "strive",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Add or remove roles made for everybody in the server.")
    .addRoleOption(option => option.setName("add").setDescription("Select a role to add."))
    .addRoleOption(option => option.setName("remove").setDescription("Select a role to remove.")),

  async execute(interaction) {
    const setRole = async (type, role) => {
      if (publicRoles.includes(role.name.toLowerCase())) {
        await interaction.member.roles[type](role).then(async () => {
          await interaction.reply(`${(type === "remove" ? "Removed" : "Added")} \`${role.name}\` role.`);
        }).catch(e => console.error(e));
      }
      else {
        await interaction.reply(`${role.name} is not an available role.`);
      }
    };

    const addRole = interaction.options.getRole("add");
    const removeRole = interaction.options.getRole("remove");
    if (addRole) {
      setRole("add", addRole);
    }
    if (removeRole) {
      setRole("remove", removeRole);
    }
  },
};
