window.SPU_CONTENT_BRAND = {
  name: "SPU / SPUIC",
  primaryAspectRatio: "4:5",
  palette: {
    magenta: "#ec168c",
    deepNavy: "#061b3a",
    white: "#ffffff",
    coolGray: "#f4f6f8"
  },
  styleDNA: [
    "premium international higher-education campaign",
    "modern editorial layout",
    "strong headline hierarchy",
    "authentic international student photography",
    "clean grid and generous whitespace",
    "SPU magenta + deep navy + white",
    "mobile-first social media composition",
    "professional but youthful",
    "clear CTA"
  ],
  avoid: [
    "dashboard-like poster",
    "web UI screenshot style",
    "huge white overlay box",
    "dense paragraphs",
    "generic corporate stock poster",
    "random QR codes",
    "fake campus buildings",
    "fake rankings or accreditations",
    "invented dates or scholarship amounts",
    "placeholder text",
    "raw form labels",
    "internal prompt text"
  ],
  qualityGate: {
    minimumScore: 7.5,
    retryRecommendedVariantOnce: true
  },
  variants: [
    {
      key: "recommended",
      label: "แนะนำ",
      direction: "best-balanced premium editorial poster; clear hierarchy; practical for real SPUIC social use"
    },
    {
      key: "alternative",
      label: "ทางเลือก",
      direction: "different composition from recommended; still clean, premium and brand-safe"
    },
    {
      key: "creative",
      label: "สร้างสรรค์",
      direction: "bolder art direction and stronger visual personality while remaining professional and readable"
    }
  ]
};
