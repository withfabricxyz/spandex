import { defineConfig } from "vocs";

export default defineConfig({
  title: "SMAL",
  sidebar: [
    {
      text: "Guides",
      items: [
        {
          text: "Quick Start",
          link: "/getting-started",
        },
        {
          text: "Simulation",
          link: "/configuration",
        },
        {
          text: "React Hooks",
          link: "/react",
        },
      ],
    },

    {
      text: "Advanced",
      items: [
        {
          text: "Strategies",
          link: "/strategies",
        },
        {
          text: "Customization",
          link: "/fees",
        },
        {
          text: "Advanced Topics",
          link: "/advanced",
        },
        {
          text: "Approvals",
          link: "/approvals",
        },
      ],
    },
    {
      text: "Providers",
      collapsed: true,
      items: [
        {
          text: "Fabric",
          link: "/providers/soon",
        },
        {
          text: "0x",
          link: "/providers/soon",
        },
        {
          text: "KyberSwap",
          link: "/providers/soon",
        },
        {
          text: "Odos",
          link: "/providers/soon",
        },
        {
          text: "LiFi",
          link: "/providers/soon",
        },
        {
          text: "1inch",
          link: "/providers/soon",
        },
      ],
    },
  ],
  // vite: {
  // },
  // topNav: {
  // }
});
