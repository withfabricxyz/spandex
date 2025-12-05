import { defineConfig } from "vocs";

export default defineConfig({
  title: "SMAL",
  sidebar: [
    {
      text: "Overview",
      items: [
        {
          text: "Why SMAL",
          link: "/overview",
        },
        {
          text: "Installation",
          link: "/installation",
        },
        {
          text: "Getting Started",
          link: "/getting-started",
        },
        {
          text: "Examples",
          link: "/examples",
        },
      ],
    },

    {
      text: "Configuration",
      items: [
        {
          text: "Meta Aggregator",
          link: "/strategies",
        },
        {
          text: "Clients",
          link: "/fees",
        },
      ],
    },
    {
      text: "Providers",
      collapsed: true,
      items: [
        {
          text: "Fabric",
          link: "/providers/fabric",
        },
        {
          text: "0x",
          link: "/providers/0x",
        },
        {
          text: "KyberSwap",
          link: "/providers/kyberswap",
        },
        {
          text: "Odos",
          link: "/providers/odos",
        },
        {
          text: "LiFi",
          link: "/providers/lifi",
        },
        {
          text: "1inch",
          link: "/providers/1inch",
        },
      ],
    },
  ],
  // vite: {
  // },
  // topNav: {
  // }
});
