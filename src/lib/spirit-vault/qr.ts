import QRCode from "qrcode";

// Server-side QR → inline SVG string. Inline (not an <img src>) so it survives the
// placemat's standalone print HTML and the print-to-PDF path with no external
// fetch. Fixed width/height are stripped so CSS controls the box; the viewBox stays.
export async function qrSvg(text: string): Promise<string> {
  const svg = await QRCode.toString(text, {
    type: "svg",
    margin: 0, // quiet zone is added by the surrounding white box in the layout
    errorCorrectionLevel: "M",
    color: { dark: "#17130C", light: "#FFFFFF" },
  });
  return svg
    .replace(/<svg([^>]*?)\s+width="[^"]*"/, "<svg$1")
    .replace(/<svg([^>]*?)\s+height="[^"]*"/, "<svg$1");
}
