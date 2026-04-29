import { Logo0x } from "./logo/0x";
import { ArbitrumLogo } from "./logo/arbitrum";
import { AutoLogo } from "./logo/auto";
import { AvalancheLogo } from "./logo/avalanche";
import { BaseLogo } from "./logo/base";
import { BlastLogo } from "./logo/blast";
import { BnbChainLogo } from "./logo/bnbchain";
import { ClankerLogo } from "./logo/clanker";
import { DackieLogo } from "./logo/dackie";
import { FabricLogo } from "./logo/fabric";
import { FarcasterLogo } from "./logo/farcaster";
import { FlareLogo } from "./logo/flare";
import { GnosisLogo } from "./logo/gnosis";
import { InkLogo } from "./logo/ink";
import { KyberSwapLogo } from "./logo/kyberswap";
import { LifiLogo } from "./logo/lifi";
import { LiskLogo } from "./logo/lisk";
import { ModeLogo } from "./logo/mode";
import { NordsternLogo } from "./logo/nordstern";
import { OdosLogo } from "./logo/odos";
import { OkuLogo } from "./logo/oku";
import { OptimismLogo } from "./logo/optimism";
import { PlasmaLogo } from "./logo/plasma";
import { RelayLogo } from "./logo/relay";
import { RiftLogo } from "./logo/rift";
import { RoninLogo } from "./logo/ronin";
import { ScrollLogo } from "./logo/scroll";
import { SonicLogo } from "./logo/sonic";
import { TempoLogo } from "./logo/tempo";
import { UnichainLogo } from "./logo/unichain";
import { VeloraLogo } from "./logo/velora";
import { XdcLogo } from "./logo/xdc";
import Marquee from "./Marquee";

const logoLink =
  "text-secondary transition-colors duration-[125ms] ease-out hover:text-primary no-underline [&>svg]:max-md:[zoom:0.8] [&>img]:max-md:[zoom:0.8]";

const chainLogos = [
  { name: "Base", href: "https://base.org", Logo: BaseLogo },
  { name: "Arbitrum", href: "https://arbitrum.io", Logo: ArbitrumLogo },
  { name: "Optimism", href: "https://www.optimism.io", Logo: OptimismLogo },
  { name: "Scroll", href: "https://chain.scroll.io", Logo: ScrollLogo },
  { name: "Blast", href: "https://blast.io/en", Logo: BlastLogo },
  { name: "Mode", href: "https://www.mode.network", Logo: ModeLogo },
  { name: "Ink", href: "https://inkonchain.com", Logo: InkLogo },
  { name: "Unichain", href: "https://www.unichain.org", Logo: UnichainLogo },
  { name: "Plasma", href: "https://www.plasma.to/chain", Logo: PlasmaLogo },
  { name: "Tempo", href: "https://tempo.xyz", Logo: TempoLogo },
  { name: "Avalanche", href: "https://www.avax.network", Logo: AvalancheLogo },
  { name: "BNB Chain", href: "https://www.bnbchain.org", Logo: BnbChainLogo },
  { name: "Gnosis", href: "https://www.gnosis.io/chain", Logo: GnosisLogo },
  { name: "Ronin", href: "https://roninchain.com", Logo: RoninLogo },
  { name: "Lisk", href: "https://lisk.com/chain", Logo: LiskLogo },
  { name: "Flare", href: "https://flare.network", Logo: FlareLogo },
  { name: "Sonic", href: "https://www.soniclabs.com", Logo: SonicLogo },
  { name: "XDC", href: "https://xdc.org", Logo: XdcLogo },
] as const;

export function ProviderMarquee() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-10">
        <span className="agg">8 Aggregators—</span>
        <Marquee direction="rtl" gap={40}>
          <a href="https://0x.org" target="_blank" rel="noopener noreferrer" className={logoLink}>
            <Logo0x />
          </a>
          <a href="https://li.fi" target="_blank" rel="noopener noreferrer" className={logoLink}>
            <LifiLogo />
          </a>
          <a
            href="https://withfabric.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <FabricLogo />
          </a>
          <a
            href="https://kyberswap.com"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <KyberSwapLogo />
          </a>
          <a
            href="https://relay.link"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <RelayLogo />
          </a>
          <a href="https://odos.xyz" target="_blank" rel="noopener noreferrer" className={logoLink}>
            <OdosLogo />
          </a>
          <a
            href="https://nordstern.finance"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <NordsternLogo />
          </a>
          <a
            href="https://velora.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <VeloraLogo />
          </a>
        </Marquee>
      </section>

      <section className="flex flex-col gap-10">
        <span className="agg">40+ Chains—</span>
        <Marquee direction="ltr" gap={40}>
          {chainLogos.map(({ name, href, Logo }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={logoLink}
            >
              <Logo />
            </a>
          ))}
        </Marquee>
      </section>

      <section className="flex flex-col gap-10">
        <span className="agg">Trusted by—</span>
        <Marquee direction="rtl" gap={40}>
          <a
            href="https://farcaster.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <FarcasterLogo />
          </a>
          <a
            href="https://oku.trade"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <OkuLogo />
          </a>
          <a
            href="https://clanker.world"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <ClankerLogo />
          </a>
          <a
            href="https://dackieswap.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <DackieLogo />
          </a>
          <a
            href="https://www.rift.trade"
            target="_blank"
            rel="noopener noreferrer"
            className={logoLink}
          >
            <RiftLogo />
          </a>
          <a href="https://auto.fun" target="_blank" rel="noopener noreferrer" className={logoLink}>
            <AutoLogo />
          </a>
        </Marquee>
      </section>
    </div>
  );
}
