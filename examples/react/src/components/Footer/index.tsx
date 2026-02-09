export function Footer() {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between max-w-360 mx-auto mb-20">
      <div className="flex items-center gap-4 mb-10 md:mb-0">
        <span className="text-[12px] text-exact-height">
          Built by{" "}
          <a
            href="https://withfabric.xyz"
            className="underline"
            style={{ textUnderlineOffset: "25%" }}
          >
            Fabric.
          </a>
        </span>
        <span className="text-[12px] text-exact-height">
          Powered by{" "}
          <a href="https://spandex.sh" className="underline" style={{ textUnderlineOffset: "25%" }}>
            spanDEX
          </a>
        </span>
      </div>
      <div className="flex justify-between gap-20">
        <a
          href="https://spandex.sh/overview"
          className="text-[12px] underline text-secondary"
          style={{ textUnderlineOffset: "25%" }}
        >
          FAQ
        </a>
        <a
          href="https://spandex.sh/getting-started"
          className="text-[12px] underline text-secondary"
          style={{ textUnderlineOffset: "25%" }}
        >
          Docs
        </a>
        <a
          href="https://benchmark.withfabric.xyz/"
          className="text-[12px] underline text-secondary"
          style={{ textUnderlineOffset: "25%" }}
        >
          Quotebench
        </a>
      </div>
    </div>
  );
}
