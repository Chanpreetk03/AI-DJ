import * as QRCode from "qrcode";

export async function renderInviteQr(canvas: HTMLCanvasElement, inviteUrl: string): Promise<void> {
  await QRCode.toCanvas(canvas, inviteUrl, {
    width: 240,
    margin: 2,
    color: { dark: "#17131f", light: "#fff8fc" },
  });
}
