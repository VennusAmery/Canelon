import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext.jsx";
import Navbar from "./components/Navbar/Navbar.jsx";
import Hero from "./components/Hero/Hero.jsx";
import ProductCarousel from "./components/ProductCarousel/ProductCarousel.jsx";
import About from "./components/About/About.jsx";
import FAQ from "./components/FAQ/FAQ.jsx";
import Social from "./components/Social/Social.jsx";
import Footer from "./components/Footer/Footer.jsx";
import CartDrawer from "./components/CartDrawer/CartDrawer.jsx";
import Login from "./pages/Login.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function goTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HomePage() {
  return (
    <>
      <Navbar />
      <Hero onSeeMenu={() => goTo("menu")} onOrder={() => goTo("redes")} />
      <ProductCarousel />
      <About />
      <FAQ />
      <Social />
      <Footer />
      <CartDrawer />
    </>
  );
}

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}