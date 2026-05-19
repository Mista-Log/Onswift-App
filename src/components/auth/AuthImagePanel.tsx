import { useState } from "react";

const AUTH_IMAGES = [
  "/assets/Auth%20Images/austin-kehmeier-lyiKExA4zQA-unsplash.avif",
  "/assets/Auth%20Images/mark-mcgregor-Ns8trMR4Om8-unsplash.avif",
  "/assets/Auth%20Images/microsoft-edge-6CNB3iD8M4E-unsplash-1.avif",
  "/assets/Auth%20Images/Redbull%20Fighter%20Jets.avif",
];

export function AuthImagePanel() {
  // Pick once per mount — random per route visit, not a slideshow
  const [image] = useState(
    () => AUTH_IMAGES[Math.floor(Math.random() * AUTH_IMAGES.length)]
  );

  return (
    <div className="relative hidden lg:flex lg:w-[44%] xl:w-[46%] flex-none flex-col overflow-hidden">
      {/* Portrait-cropped image — object-position biased toward top so faces/subjects show */}
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-[center_15%]"
      />

      {/* Right-edge fade — prevents image from competing with the form */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 to-black/60" />

      {/* Bottom vignette for legibility of branding copy */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Branding lockup */}
      <div className="relative mt-auto p-8 pb-10 xl:p-12">
        <img
          src="/onswift logo.png"
          alt="OnSwift"
          className="h-10 w-10 mb-4 object-contain"
        />
        <p className="text-white font-bold text-2xl xl:text-3xl leading-snug">
          Built for creators,<br />powered by talent.
        </p>
        <p className="text-white/60 text-sm xl:text-base mt-2 leading-relaxed max-w-xs">
          The platform where creative teams collaborate, hire, and get things done.
        </p>
      </div>
    </div>
  );
}
