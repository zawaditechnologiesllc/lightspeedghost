import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

const DEFAULT_LEVEL = "undergrad_3_4";

interface UserProfile {
  academicLevel: string;
}

interface UseUserProfileReturn {
  academicLevel: string;
  profileLoaded: boolean;
  saveAcademicLevel: (level: string) => void;
}

export function useUserProfile(): UseUserProfileReturn {
  const [academicLevel, setAcademicLevel] = useState(DEFAULT_LEVEL);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    apiFetch("/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UserProfile | null) => {
        if (data?.academicLevel) setAcademicLevel(data.academicLevel);
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, []);

  function saveAcademicLevel(level: string) {
    setAcademicLevel(level);
    // Debounce — only persist after 600 ms of no further changes
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiFetch("/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicLevel: level }),
      }).catch(() => {});
    }, 600);
  }

  return { academicLevel, profileLoaded, saveAcademicLevel };
}
