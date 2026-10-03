import React from "react";
import "./Hero.css";

export default function Hero() {
  return (
    <header id="inicio" className="hero">
      <video
        className="hero-bg"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-label="Canelón"
      >
        <source src="/video/canelon-video.mp4" type="video/mp4" />
      </video>
    </header>
  );
}