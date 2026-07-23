(function () {
  const bannerConfig = {
    enabled: true,
    message: "THÔNG BÁO MỚI: Đã hỗ trợ chọn nhiều nhân viên và in nhiều biên bản cùng lúc",
    speedSeconds: 14,
    blinkSeconds: 0.9,
    textColor: "#ff0037",
    backgroundColor: "#ffffff"
  };

  function showBanner() {
    const banner = document.getElementById("siteBanner");
    const text = document.getElementById("siteBannerText");
    if (!banner || !text || !bannerConfig.enabled || !bannerConfig.message.trim()) return;

    text.textContent = bannerConfig.message.trim();
    text.style.color = bannerConfig.textColor;
    banner.style.backgroundColor = bannerConfig.backgroundColor;
    banner.style.setProperty("--banner-duration", `${Math.max(4, Number(bannerConfig.speedSeconds) || 14)}s`);
    banner.style.setProperty("--banner-blink-duration", `${Math.max(0.3, Number(bannerConfig.blinkSeconds) || 0.9)}s`);
    banner.classList.add("is-visible");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showBanner);
  } else {
    showBanner();
  }
})();
