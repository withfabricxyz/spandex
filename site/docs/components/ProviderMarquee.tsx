import { Logo0x } from "../components/logo/0x";
import { FabricLogo } from "../components/logo/fabric";
import { KyberSwapLogo } from "../components/logo/kyberswap";
import { LifiLogo } from "../components/logo/lifi";
import { OdosLogo } from "../components/logo/odos";
import { RelayLogo } from "./logo/relay";

export function ProviderMarquee() {
  return (
    <div className="logos-marquee">
      <div className="logos-marquee__track">
        <Logos />
        <Logos />
      </div>
    </div>
  );
}

function Logos({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div className="logos logos--marquee" aria-hidden={ariaHidden}>
      <div className="logos__item">
        <Logo0x />
      </div>
      <div className="logos__item">
        <LifiLogo />
      </div>
      <div className="logos__item">
        <FabricLogo />
      </div>
      <div className="logos__item">
        <KyberSwapLogo />
      </div>
      <div className="logos__item">
        <RelayLogo />
      </div>
      <div className="logos__item">
        <OdosLogo />
      </div>
    </div>
  );
}
