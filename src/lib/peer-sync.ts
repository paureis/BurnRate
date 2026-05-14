// v6 Feature 2: WebRTC peer-sync transport with manual signaling.
//
// Two devices exchange offer/answer strings (typically copied/pasted by the
// user or scanned via QR). Once the data channel opens, a single BR5.
// payload is sent and a single response acknowledgment is sent back.
//
// Pure transport — no UI. The PeerSyncFlow component wires this to the
// existing sync modal (Merge / Replace / Cancel).

import { bytesToBase64Url, base64UrlToBytes } from "./crypto";

export type PeerRole = "host" | "guest";
export type PeerState =
  | "idle"
  | "awaiting-offer"
  | "awaiting-answer"
  | "connecting"
  | "connected"
  | "closed"
  | "failed";

export interface PeerSession {
  role: PeerRole;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  state: PeerState;
}

export interface PeerOptions {
  stunUrl?: string;
  iceGatherTimeoutMs?: number;
}

const DEFAULT_STUN = "stun:stun.l.google.com:19302";
const DEFAULT_GATHER_TIMEOUT_MS = 2000;

/**
 * Pack an RTCSessionDescription (sdp + candidates) into a compact, URL-safe
 * string suitable for QR or paste.
 */
export function packDescription(desc: RTCSessionDescriptionInit): string {
  const json = JSON.stringify({
    t: desc.type,
    s: desc.sdp ?? "",
  });
  return bytesToBase64Url(new TextEncoder().encode(json));
}

export function unpackDescription(token: string): RTCSessionDescriptionInit {
  const bytes = base64UrlToBytes(token);
  const json = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(json) as { t: RTCSdpType; s: string };
  if (!parsed.t || typeof parsed.s !== "string") throw new Error("Invalid peer description");
  return { type: parsed.t, sdp: parsed.s };
}

/**
 * Wait for the peer connection's ICE gathering phase to finish (best-effort).
 */
export async function waitForIceComplete(
  pc: RTCPeerConnection,
  timeoutMs: number = DEFAULT_GATHER_TIMEOUT_MS,
): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  return new Promise<void>((resolve) => {
    const handler = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", handler);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", handler);
    setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", handler);
      resolve();
    }, timeoutMs);
  });
}

/**
 * Initiate as the host: open a data channel, create the offer, gather ICE,
 * and return the packed offer for the user to deliver to the guest.
 */
export async function createHostSession(opts: PeerOptions = {}): Promise<{ session: PeerSession; offer: string }> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: opts.stunUrl ?? DEFAULT_STUN }] });
  const channel = pc.createDataChannel("burnrate");
  const session: PeerSession = { role: "host", pc, channel, state: "awaiting-answer" };
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceComplete(pc, opts.iceGatherTimeoutMs ?? DEFAULT_GATHER_TIMEOUT_MS);
  const description = pc.localDescription ?? offer;
  return { session, offer: packDescription(description as RTCSessionDescriptionInit) };
}

/**
 * Accept the host's offer as the guest: set remote, create answer, gather
 * ICE, and return the packed answer for the user to deliver back.
 */
export async function acceptHostOffer(
  packedOffer: string,
  opts: PeerOptions = {},
): Promise<{ session: PeerSession; answer: string }> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: opts.stunUrl ?? DEFAULT_STUN }] });
  const session: PeerSession = { role: "guest", pc, channel: null, state: "connecting" };
  pc.addEventListener("datachannel", (event) => {
    session.channel = event.channel;
    session.state = "connected";
  });
  const offer = unpackDescription(packedOffer);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceComplete(pc, opts.iceGatherTimeoutMs ?? DEFAULT_GATHER_TIMEOUT_MS);
  const description = pc.localDescription ?? answer;
  return { session, answer: packDescription(description as RTCSessionDescriptionInit) };
}

/**
 * Host: feed the guest's answer back to complete the handshake.
 */
export async function completeHostHandshake(session: PeerSession, packedAnswer: string): Promise<void> {
  if (session.role !== "host") throw new Error("completeHostHandshake requires a host session");
  const answer = unpackDescription(packedAnswer);
  await session.pc.setRemoteDescription(answer);
  session.state = "connecting";
}

/**
 * Send a payload over the data channel. Resolves when the channel has
 * confirmed the buffered amount has drained (best-effort).
 */
export async function sendPayload(session: PeerSession, payload: string): Promise<void> {
  if (!session.channel) throw new Error("Data channel not open");
  if (session.channel.readyState !== "open") {
    await waitForChannelOpen(session.channel);
  }
  session.channel.send(payload);
}

/**
 * Subscribe to incoming payloads. Returns an unsubscribe function.
 */
export function onPayload(session: PeerSession, cb: (payload: string) => void): () => void {
  const handler = (event: MessageEvent<string>) => {
    cb(typeof event.data === "string" ? event.data : "");
  };
  if (session.channel) {
    session.channel.addEventListener("message", handler);
    return () => session.channel?.removeEventListener("message", handler);
  }
  // Guest sessions get a channel via the `datachannel` event; wait for it.
  const channelHandler = (event: RTCDataChannelEvent) => {
    event.channel.addEventListener("message", handler);
  };
  session.pc.addEventListener("datachannel", channelHandler);
  return () => {
    session.pc.removeEventListener("datachannel", channelHandler);
    session.channel?.removeEventListener("message", handler);
  };
}

/**
 * Close a peer session and release the underlying connection.
 */
export function closeSession(session: PeerSession): void {
  try {
    session.channel?.close();
  } catch {
    /* ignore */
  }
  try {
    session.pc.close();
  } catch {
    /* ignore */
  }
  session.state = "closed";
}

async function waitForChannelOpen(channel: RTCDataChannel, timeoutMs: number = 5000): Promise<void> {
  if (channel.readyState === "open") return;
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Channel open timed out")), timeoutMs);
    channel.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export const PEER_DEFAULT_STUN = DEFAULT_STUN;
