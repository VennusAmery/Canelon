import React, { useState } from "react";
import { X } from "lucide-react";
import { createOrder, API_ORIGIN } from "../../api/client.js";
import "./CheckoutModal.css";

function formatCardNumber(value) {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

function minFechaEntrega() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4);

  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function CheckoutModal({
  items,
  total,
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState("datos"); // datos | pago | listo

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");

  const [numero, setNumero] = useState("");
  const [nombreTarjeta, setNombreTarjeta] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvc, setCvc] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);

  const anticipo = Math.round(total * 0.5);
  const saldo = total - anticipo;

const [direccionEntrega, setDireccionEntrega] = useState("");
const [fechaEntrega, setFechaEntrega] = useState(minFechaEntrega());

const handleContinuar = (e) => {
  e.preventDefault();
  if (!cliente || !telefono || !direccionEntrega || !fechaEntrega) {
    setError("Completa todos los campos.");
    return;
  }
  setError("");
  setStep("pago");
};

  const handlePagar = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const data = await createOrder({
        cliente,
        telefono,
        items,
        direccionEntrega,
        fechaEntrega,
        tarjeta: {
          numero,
          nombre: nombreTarjeta,
          vencimiento,
          cvc,
        },
      });

      setResultado(data);
      setStep("listo");
    } catch (err) {
      setError(err.message || "No se pudo procesar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="checkout-overlay"
      onClick={step !== "listo" ? onClose : undefined}
    >
      <div
        className="checkout-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {step !== "listo" && (
          <button
            className="checkout-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        )}

        {step === "datos" && (
          <>
            <h2>Tus datos</h2>

            <p className="checkout-total">
              Total del pedido: <strong>Q{total}</strong>
            </p>

            <form onSubmit={handleContinuar}>
              <label>
                Nombre completo
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  required
                />
              </label>

              <label>
                Teléfono
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  required
                />
              </label>

              <label>
                Dirección de entrega
                <textarea
                    rows={2}
                    value={direccionEntrega}
                    onChange={(e) => setDireccionEntrega(e.target.value)}
                    required
                />
                </label>
                <label>
                Fecha de entrega deseada
                <input
                    type="date"
                    min={minFechaEntrega()}
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                    required
                />
                </label>
                <p className="checkout-note">Los pedidos deben solicitarse con al menos 3 días de anticipación.</p>

              {error && (
                <p className="checkout-error">
                  {error}
                </p>
              )}

              <button type="submit">
                Continuar al pago
              </button>
            </form>
          </>
        )}

        {step === "pago" && (
          <>
            <h2>Pago del anticipo</h2>

            <div className="checkout-summary">
              <div>
                <span>Total del pedido</span>
                <strong>Q{total}</strong>
              </div>

              <div className="checkout-summary-highlight">
                <span>Anticipo a pagar ahora (50%)</span>
                <strong>Q{anticipo}</strong>
              </div>

              <div>
                <span>Saldo restante</span>
                <strong>Q{saldo}</strong>
              </div>
            </div>

            <form onSubmit={handlePagar}>
              <label>
                Número de tarjeta
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0000 0000 0000 0000"
                  value={numero}
                  onChange={(e) =>
                    setNumero(formatCardNumber(e.target.value))
                  }
                  required
                />
              </label>

              <label>
                Nombre en la tarjeta
                <input
                  type="text"
                  value={nombreTarjeta}
                  onChange={(e) =>
                    setNombreTarjeta(e.target.value)
                  }
                  required
                />
              </label>

              <div className="checkout-row">
                <label>
                  Vencimiento
                  <input
                    type="text"
                    placeholder="MM/AA"
                    value={vencimiento}
                    onChange={(e) =>
                      setVencimiento(
                        formatExpiry(e.target.value)
                      )
                    }
                    required
                  />
                </label>

                <label>
                  CVC
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={cvc}
                    onChange={(e) =>
                      setCvc(
                        e.target.value.replace(/\D/g, "")
                      )
                    }
                    required
                  />
                </label>
              </div>

              {error && (
                <p className="checkout-error">
                  {error}
                </p>
              )}

              <button type="submit" disabled={loading}>
                {loading
                  ? "Procesando..."
                  : `Pagar Q${anticipo}`}
              </button>

              <p className="checkout-note">
                Esto es una simulación — no se realiza ningún
                cobro real.
              </p>
            </form>
          </>
        )}

        {step === "listo" && resultado && (
          <div className="checkout-success">
            <h2>¡Pago aprobado!</h2>

            <p>
              Tu anticipo fue procesado correctamente.
            </p>

                <div className="checkout-summary">
                <div><span>Código de transacción</span><strong>{resultado.codigoTransaccion}</strong></div>
                <div className="checkout-summary-highlight">
                    <span>Anticipo pagado</span><strong>Q{resultado.anticipo}</strong>
                </div>
                <div><span>Saldo restante</span><strong>Q{resultado.saldo}</strong></div>
                <div>
                    <span>Fecha de entrega</span>
                    <strong>
                    {new Date(resultado.fechaEntrega).toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" })}
                    </strong>
                </div>
            </div>

            <a
              className="checkout-receipt-link"
              href={`${API_ORIGIN}${resultado.comprobante}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver comprobante de pago
            </a>

            <button
              onClick={() => {
                onSuccess(resultado);
              }}
            >
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}