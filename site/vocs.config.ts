import { defineConfig } from "vocs";

export default defineConfig({
  title: "SpanDEX",
  sidebar: [
    {
      text: "Overview",
      items: [
        {
          text: "Why SpanDEX",
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
      text: "Core",
      items: [
        {
          text: "Getting Started",
          link: "/core/getting-started",
        },
        {
          text: "Functions",
          items: [
            {
              text: "getQuotes",
              link: "/core/functions/getQuotes",
            },
            {
              text: "getRawQuotes",
              link: "/core/functions/getRawQuotes",
            },
            {
              text: "prepareQuotes",
              link: "/core/functions/prepareQuotes",
            },
            {
              text: "selectQuote",
              link: "/core/functions/selectQuote",
            },
            {
              text: "executeQuote",
              link: "/core/functions/executeQuote",
            },
            {
              text: "createConfig",
              link: "/core/functions/createConfig",
            },
          ],
        },
      ],
    },

    {
      text: "React",
      items: [
        {
          text: "Getting Started",
          link: "/react/getting-started",
        },
        {
          text: "Hooks",
          items: [
            {
              text: "useQuotes",
              link: "/react/hooks/useQuotes",
            },
            {
              text: "useQuoteExecutor",
              link: "/react/hooks/useQuoteExecutor",
            },
            {
              text: "useRawQuotes",
              link: "/react/hooks/useRawQuotes",
            },
            {
              text: "useSpandexConfig",
              link: "/react/hooks/useSpandexConfig",
            },
          ],
        },
      ],
    },

    {
      text: "Configuration",
      items: [
        {
          text: "Options",
          link: "/configuration",
        },
        {
          text: "Providers",
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
    },

    {
      text: "Reference",
      collapsed: true,
      items: [
        {
          text: "ConfigParams",
          link: "/reference/ConfigParams",
        },
        {
          text: "SwapParams",
          link: "/reference/SwapParams",
        },
      ],
    },
  ],
});
