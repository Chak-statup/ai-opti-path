import logoLight from "@/assets/statup-logo.png.asset.json";
import logoDark from "@/assets/statup-logo-dark.png.asset.json";

export function StatupLogo({ className = "" }: { className?: string }) {
  return (
    <>
      <img
        src={logoLight.url}
        alt="STAT UP"
        className={`exp-logo-img light ${className}`}
      />
      <img
        src={logoDark.url}
        alt="STAT UP"
        className={`exp-logo-img dark ${className}`}
      />
    </>
  );
}
