"use client";
import { useEffect } from "react";

export default function GetStartedCompat() {
  useEffect(() => {
    window.location.replace("/#get-started");
  }, []);
  return null;
}
