import Image from "next/image";

export function BrandLogo() {
  return (
    <>
      <Image
        className="brand-logo"
        src="/brand/inovalogix-logo.png"
        alt="InovaLogix"
        width={375}
        height={144}
        loading="eager"
        unoptimized
      />
      <small>CRM COMERCIAL</small>
    </>
  );
}
