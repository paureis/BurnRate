import { ImageResponse } from "next/og";
import { calculateBurnMetrics, formatCents } from "@/lib/burnrate";
import { decodeSyncPayload } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BurnRate share";

export default async function Image({ params }: { params: Promise<{ payload: string }> }) {
  const { payload } = await params;

  let monthlyBurnCents = 0;
  let topCategories: Array<{ category: string; monthlyCents: number; percentage: number }> = [];
  let subscriptionsCount = 0;
  let parseError = false;

  try {
    const data = decodeSyncPayload(payload);
    const metrics = calculateBurnMetrics(data.subscriptions);
    monthlyBurnCents = metrics.monthlyBurnCents;
    topCategories = metrics.categoryBreakdown.slice(0, 3);
    subscriptionsCount = data.subscriptions.length;
  } catch {
    parseError = true;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          background: "linear-gradient(135deg, #0f1115 0%, #1a1d24 100%)",
          color: "#f6f1e8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              width: "72px",
              height: "72px",
              borderRadius: "16px",
              background: "#ff5a3d",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "44px",
            }}
          >
            🔥
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "20px", letterSpacing: "0.18em", color: "#ffd166", textTransform: "uppercase" }}>
              BurnRate
            </span>
            <span style={{ fontSize: "28px", fontWeight: 800 }}>Public share</span>
          </div>
        </div>

        {parseError ? (
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <span style={{ fontSize: "48px", fontWeight: 800 }}>Invalid share link</span>
            <span style={{ fontSize: "24px", color: "#a9b0bc" }}>Ask for a fresh link.</span>
          </div>
        ) : (
          <>
            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "28px", color: "#ff5a3d", textTransform: "uppercase", letterSpacing: "0.18em" }}>
                Monthly burn
              </span>
              <span style={{ fontSize: "180px", fontWeight: 800, lineHeight: 1 }}>
                {formatCents(monthlyBurnCents, true)}
              </span>
              <span style={{ fontSize: "28px", color: "#a9b0bc", marginTop: "12px" }}>
                Across {subscriptionsCount} subscription{subscriptionsCount === 1 ? "" : "s"}
              </span>
            </div>

            <div style={{ marginTop: "32px", display: "flex", gap: "16px" }}>
              {topCategories.map((cat) => (
                <div
                  key={cat.category}
                  style={{
                    display: "flex",
                    flex: "1 1 0",
                    flexDirection: "column",
                    padding: "16px 20px",
                    border: "2px solid rgba(255,255,255,0.12)",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.14em" }}>
                    {cat.category}
                  </span>
                  <span style={{ fontSize: "44px", fontWeight: 800, marginTop: "8px" }}>
                    {formatCents(cat.monthlyCents, true)}
                  </span>
                  <span style={{ fontSize: "20px", color: "#ffd166", marginTop: "4px" }}>{cat.percentage}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    ),
    { ...size },
  );
}
