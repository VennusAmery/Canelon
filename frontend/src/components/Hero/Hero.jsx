import React from "react";
import './Hero.css';

export default function Hero({ onSeeMenu, onOrder }) {
  return (
    <header id="inicio" className="hero">

      <video
        className="hero-video"
        autoPlay
        muted
        loop
        playsInline
        poster="/video/hero-poster.jpg"
      >
        <source src="/video/canelon-video.mp4" type="video/mp4" />
      </video>
      <div className="hero-overlay" />

      <div className="hero-content">
        
        <div className="hero-ctas">
        </div>
      </div>
    </header>
  );
}
