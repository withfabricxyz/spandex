import { defineConfig } from "vocs";

export default defineConfig({
  title: "spanDEX",
  titleTemplate: "%s - spanDEX",
  baseUrl: process.env.VERCEL_ENV === "production" ? "https://spandex.sh" : process.env.VERCEL_URL,
  logoUrl: {
    light: "/logo-light.svg",
    dark: "/logo-dark.svg",
  },
  description: "DEX meta-aggregator library for optimal token swaps",
  ogImageUrl: "https://spandex.sh/api/og?logo=%logo&title=%title&description=%description",
  sidebar: [
    {
      text: "Overview",
      items: [
        {
          text: "Why spanDEX",
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
              text: "createConfig",
              link: "/core/functions/createConfig",
            },
            {
              text: "getQuote",
              link: "/core/functions/getQuote",
            },
            {
              text: "executeQuote",
              link: "/core/functions/executeQuote",
            },
          ],
        },
        {
          text: "Advanced",
          collapsed: true,
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
              text: "simulateQuote",
              link: "/core/functions/simulateQuote",
            },
            {
              text: "simulateQuotes",
              link: "/core/functions/simulateQuotes",
            },
          ],
        },
        {
          text: "Utils",
          collapsed: true,
          items: [
            {
              text: "netOutputs",
              link: "/core/functions/netOutputs",
            },
            {
              text: "newQuoteStream",
              link: "/core/functions/newQuoteStream",
            },
            {
              text: "decodeQuoteStream",
              link: "/core/functions/decodeQuoteStream",
            },
            {
              text: "sortQuotesByPerformance",
              link: "/core/functions/sortQuotesByPerformance",
            },
            {
              text: "getPricing",
              link: "/core/functions/getPricing",
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
              text: "useQuote",
              link: "/react/hooks/useQuote",
            },
            {
              text: "useQuotes",
              link: "/react/hooks/useQuotes",
            },
            {
              text: "useQuoteExecutor",
              link: "/react/hooks/useQuoteExecutor",
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
              text: "Relay",
              link: "/providers/relay",
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
