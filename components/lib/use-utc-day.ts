"use client";

import { useEffect, useState } from "react";

// The day changes the query subscription key; the server still calculates today itself.
export function useUtcDay() {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const refresh = () => setDay(new Date().toISOString().slice(0, 10));
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return day;
}
