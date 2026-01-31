export function Footer() {
  return (
    <div className="flex justify-between max-w-360 mx-auto mb-20">
      <span className="text-[12px] text-exact-height">
        Powered by{" "}
        <a
          href="https://docs.withfabric.xyz"
          className="underline"
          style={{ textUnderlineOffset: "25%" }}
        >
          SPANDEX
        </a>
      </span>
      <div className="flex justify-between gap-20">
        <a
          href="https://docs.withfabric.xyz"
          className="text-[12px] underline text-secondary"
          style={{ textUnderlineOffset: "25%" }}
        >
          FAQ
        </a>
        <a
          href="https://docs.withfabric.xyz"
          className="text-[12px] underline text-secondary"
          style={{ textUnderlineOffset: "25%" }}
        >
          Docs
        </a>
      </div>
    </div>
  );
}
