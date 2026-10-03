import React from "react";
import { Link } from "react-router-dom";
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <Link to="/admin/login" className="brand">Canelon</Link>
        <p>© {new Date().getFullYear()} Canelon · Horneando felicidad en cada bocado</p>
      </div>
    </footer>
  );
}