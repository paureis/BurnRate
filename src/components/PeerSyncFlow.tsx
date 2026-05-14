"use client";

import { useState } from "react";
import { Copy, Send, Smartphone } from "lucide-react";
import {
  acceptHostOffer,
  completeHostHandshake,
  createHostSession,
  onPayload,
  sendPayload,
  type PeerSession,
} from "@/lib/peer-sync";
import { encodeQr } from "@/lib/qrcode";

interface PeerSyncFlowProps {
  /** Provide the BR5. payload to send. Called only on host path after handshake. */
  buildPayload: () => string;
  /** Receive an incoming BR5. payload from the peer (guest path). */
  onPayloadReceived: (payload: string) => void;
}

export function PeerSyncFlow({ buildPayload, onPayloadReceived }: PeerSyncFlowProps) {
  const [role, setRole] = useState<null | "host" | "guest">(null);
  const [session, setSession] = useState<PeerSession | null>(null);
  const [offerToken, setOfferToken] = useState("");
  const [answerToken, setAnswerToken] = useState("");
  const [status, setStatus] = useState<string>("Idle");
  const [error, setError] = useState<string | null>(null);

  async function startHost() {
    setRole("host");
    setStatus("Creating offer…");
    setError(null);
    try {
      const { session: pcSession, offer } = await createHostSession();
      setSession(pcSession);
      setOfferToken(offer);
      setStatus("Share the offer; paste the answer when received.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start host session.");
    }
  }

  async function startGuest() {
    setRole("guest");
    setStatus("Paste the offer the host gave you.");
  }

  async function acceptOffer(offer: string) {
    setStatus("Generating answer…");
    setError(null);
    try {
      const { session: pcSession, answer } = await acceptHostOffer(offer);
      setSession(pcSession);
      setAnswerToken(answer);
      setStatus("Share the answer back with the host; waiting for connection.");
      onPayload(pcSession, (payload) => {
        onPayloadReceived(payload);
        setStatus("Received payload from host.");
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid offer.");
    }
  }

  async function completeHost(answer: string) {
    if (!session) return;
    setStatus("Completing handshake…");
    setError(null);
    try {
      await completeHostHandshake(session, answer);
      setStatus("Connecting…");
      // After channel opens, send payload.
      const send = async () => {
        try {
          await sendPayload(session, buildPayload());
          setStatus("Payload sent.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to send.");
        }
      };
      // Schedule shortly to let the data channel open.
      window.setTimeout(() => void send(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid answer.");
    }
  }

  function copyToken(value: string) {
    void navigator.clipboard?.writeText(value);
  }

  const offerQr = offerToken ? encodeQr(offerToken) : null;
  const answerQr = answerToken ? encodeQr(answerToken) : null;

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Smartphone aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
        <h2 className="text-xl font-extrabold">Peer-to-peer sync</h2>
      </div>
      <p className="mb-3 text-xs text-[color:var(--muted)]">
        Pair two BurnRate devices over WebRTC. The handshake exchanges short tokens — copy/paste them or scan the QR
        when small enough. SDP offers may include your local network address; only share with someone you trust.
      </p>

      {role === null && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="button-primary" onClick={() => void startHost()}>
            <Send aria-hidden="true" size={16} />
            Send (host)
          </button>
          <button type="button" className="button-secondary" onClick={() => void startGuest()}>
            <Smartphone aria-hidden="true" size={16} />
            Receive (guest)
          </button>
        </div>
      )}

      {role === "host" && (
        <div className="grid gap-3">
          <p className="text-xs font-bold text-[color:var(--muted)]">Step 1 — Share this offer with the other device:</p>
          {offerToken ? (
            <>
              <textarea readOnly className="input min-h-24 font-mono text-xs" value={offerToken} />
              <button type="button" className="button-secondary text-xs" onClick={() => copyToken(offerToken)}>
                <Copy aria-hidden="true" size={13} />
                Copy offer
              </button>
              {offerQr?.ok && (
                <div
                  className="mx-auto max-w-xs"
                  dangerouslySetInnerHTML={{ __html: offerQr.svg }}
                  aria-label={`Pairing offer QR code, version ${offerQr.version}`}
                />
              )}
              {offerQr && !offerQr.ok && (
                <p className="text-xs text-[color:var(--muted)]">
                  Offer is too large for a QR — copy/paste instead.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm">Waiting…</p>
          )}
          <p className="text-xs font-bold text-[color:var(--muted)]">Step 2 — Paste the answer the receiver gave you:</p>
          <PasteForm placeholder="Paste answer here" onSubmit={(value) => void completeHost(value)} />
        </div>
      )}

      {role === "guest" && (
        <div className="grid gap-3">
          <p className="text-xs font-bold text-[color:var(--muted)]">Step 1 — Paste the offer the host gave you:</p>
          <PasteForm placeholder="Paste offer here" onSubmit={(value) => void acceptOffer(value)} />
          {answerToken && (
            <>
              <p className="text-xs font-bold text-[color:var(--muted)]">Step 2 — Send this answer back to the host:</p>
              <textarea readOnly className="input min-h-24 font-mono text-xs" value={answerToken} />
              <button type="button" className="button-secondary text-xs" onClick={() => copyToken(answerToken)}>
                <Copy aria-hidden="true" size={13} />
                Copy answer
              </button>
              {answerQr?.ok && (
                <div
                  className="mx-auto max-w-xs"
                  dangerouslySetInnerHTML={{ __html: answerQr.svg }}
                  aria-label={`Pairing answer QR code, version ${answerQr.version}`}
                />
              )}
            </>
          )}
        </div>
      )}

      <p className="mt-3 text-xs font-bold text-[color:var(--accent-2)]">{status}</p>
      {error && <p className="mt-1 text-xs font-bold text-[color:var(--accent)]">{error}</p>}
    </section>
  );
}

function PasteForm({ placeholder, onSubmit }: { placeholder: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value.trim()) return;
        onSubmit(value.trim());
      }}
    >
      <textarea
        className="input min-h-24 font-mono text-xs"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className="button-primary text-xs">
        Continue
      </button>
    </form>
  );
}
